-- V1 Milestone 2, Sections 4.4 and 6: ai_inference_logs telemetry table.
--
-- Written exclusively by InferenceExecutionWrapper (features/ai/inference-wrapper.ts)
-- via its injected InferenceLogWriter, never by the model and never directly by the
-- UI. Declarative monthly partitioning by created_at (Section 6.4). Append-only:
-- UPDATE and DELETE are rejected unconditionally at the database boundary, per the
-- Section 4.4 doctrine ("Postgres aborts the mutation... immune to application-layer
-- bypass") applied here to telemetry integrity rather than the HITL gate itself.
--
-- Naming note: Section 6 refers to this table as `inference_logs`; it is created here
-- as `ai_inference_logs` per explicit runtime instruction.
--
-- FK note: workspace_id / project_id / mission_id use ON DELETE RESTRICT, not the
-- CASCADE already used elsewhere (workspaces -> projects -> missions). CASCADE was
-- considered and rejected: an ON DELETE CASCADE from workspaces/projects/missions
-- would itself fire this table's own BEFORE DELETE trigger for every cascaded row,
-- and that trigger rejects all deletes unconditionally (append-only enforcement,
-- below) -- so CASCADE would make deleting a workspace/project/mission that ever
-- had an AI call throw a trigger exception instead of cleanly cascading. RESTRICT
-- avoids that ambiguity entirely: deletion of a workspace/project/mission with any
-- inference log rows fails immediately with a foreign-key-violation, before ever
-- touching ai_inference_logs. Combined with the append-only trigger, this is an
-- intentional consequence, not an oversight: once a workspace/project/mission has
-- an AI call logged against it, it can no longer be deleted at all, by anyone,
-- including via cascade -- the audit trail cannot be destroyed by destroying its
-- container. Section 6.1 explicitly leaves RESTRICT vs CASCADE as an
-- implementation decision; this is that decision, and it is reversible.

create table public.ai_inference_logs (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  mission_id uuid not null references public.missions(id) on delete restrict,
  task_type text not null
    check (task_type in ('summarize', 'classify', 'draft_response')),
  status text not null
    check (status in ('success', 'failed', 'refused')),
  prompt_tokens integer
    check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer
    check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer
    check (total_tokens is null or total_tokens >= 0),
  model_identifier text,
  latency_ms integer not null check (latency_ms >= 0),
  cost_usd_micros bigint
    check (cost_usd_micros is null or cost_usd_micros >= 0),
  failure_reason text,
  created_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

create index idx_ai_inference_logs_mission
  on public.ai_inference_logs (mission_id);

create index idx_ai_inference_logs_workspace_created
  on public.ai_inference_logs (workspace_id, created_at desc);

-- Monthly partition provisioning helper. Bootstraps the current and next
-- calendar month below so inserts do not fail immediately after this
-- migration runs. Provisioning further months requires a scheduled call to
-- this function (e.g. pg_cron on the 1st of each month); that schedule is an
-- open operational item, not part of this migration.
create or replace function private.ai_inference_logs_ensure_partition(p_month_start date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamptz := date_trunc('month', p_month_start)::timestamptz;
  v_end timestamptz := (date_trunc('month', p_month_start) + interval '1 month')::timestamptz;
  v_partition_name text := format('ai_inference_logs_%s', to_char(v_start, 'YYYY_MM'));
begin
  execute format(
    'create table if not exists public.%I partition of public.ai_inference_logs
       for values from (%L) to (%L)',
    v_partition_name,
    v_start,
    v_end
  );
end;
$$;

revoke all on function private.ai_inference_logs_ensure_partition(date)
  from public, anon, authenticated;

select private.ai_inference_logs_ensure_partition(date_trunc('month', now())::date);
select private.ai_inference_logs_ensure_partition(
  (date_trunc('month', now()) + interval '1 month')::date
);

-- Append-only enforcement. Row-level triggers defined on a partitioned table
-- (Postgres 11+) are automatically applied to every partition, present and
-- future, so a single trigger pair here covers the whole table.
create or replace function private.reject_ai_inference_logs_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ai_inference_logs is append-only: % is not permitted', tg_op;
end;
$$;

revoke all on function private.reject_ai_inference_logs_mutation()
  from public, anon, authenticated;

create trigger ai_inference_logs_block_update
before update on public.ai_inference_logs
for each row execute function private.reject_ai_inference_logs_mutation();

create trigger ai_inference_logs_block_delete
before delete on public.ai_inference_logs
for each row execute function private.reject_ai_inference_logs_mutation();

alter table public.ai_inference_logs enable row level security;

create policy ai_inference_logs_select_admin
on public.ai_inference_logs
for select
to authenticated
using (private.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy ai_inference_logs_insert_member
on public.ai_inference_logs
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.missions m
    join public.projects p on p.id = m.project_id
    where m.id = ai_inference_logs.mission_id
      and p.id = ai_inference_logs.project_id
      and p.workspace_id = ai_inference_logs.workspace_id
  )
);

-- No update/delete grant at all: belt-and-suspenders alongside the triggers
-- above, mirroring the existing append-only posture already used for
-- public.messages (`grant select, insert` only, no update/delete).
grant usage on schema public to authenticated;
grant select, insert on public.ai_inference_logs to authenticated;

-- M2 Class B canonical conformance, ratified by Tiago under Part 18 on
-- 24 September 2026. This is deliberately a forward migration: repository
-- evidence cannot prove that the original telemetry migration never reached a
-- persistent environment, so applied migration history is preserved.
--
-- Only identifiers change. Existing rows, ON DELETE RESTRICT foreign keys,
-- append-only enforcement, RLS, grants, partitioning, and cost semantics remain
-- unchanged.

begin;

alter table public.ai_inference_logs rename to inference_logs;

-- PostgreSQL does not rename constraint identifiers with their table.
alter table public.inference_logs
  rename constraint ai_inference_logs_pkey to inference_logs_pkey;
alter table public.inference_logs
  rename constraint ai_inference_logs_workspace_id_fkey to inference_logs_workspace_id_fkey;
alter table public.inference_logs
  rename constraint ai_inference_logs_project_id_fkey to inference_logs_project_id_fkey;
alter table public.inference_logs
  rename constraint ai_inference_logs_mission_id_fkey to inference_logs_mission_id_fkey;
alter table public.inference_logs
  rename constraint ai_inference_logs_task_type_check to inference_logs_task_type_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_status_check to inference_logs_status_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_prompt_tokens_check to inference_logs_prompt_tokens_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_completion_tokens_check to inference_logs_completion_tokens_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_total_tokens_check to inference_logs_total_tokens_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_latency_ms_check to inference_logs_latency_ms_check;
alter table public.inference_logs
  rename constraint ai_inference_logs_cost_usd_micros_check to inference_logs_cost_usd_micros_check;

alter index public.idx_ai_inference_logs_mission
  rename to idx_inference_logs_mission;
alter index public.idx_ai_inference_logs_workspace_created
  rename to idx_inference_logs_workspace_created;

-- Rename every existing monthly partition, including any provisioned after the
-- original migration. The parent relationship is used instead of a date list so
-- no persistent environment can retain a stale partition identifier.
do $$
declare
  v_partition record;
  v_canonical_name text;
begin
  for v_partition in
    select child_namespace.nspname as schema_name, child.relname as relation_name
    from pg_catalog.pg_inherits inheritance
    join pg_catalog.pg_class parent on parent.oid = inheritance.inhparent
    join pg_catalog.pg_class child on child.oid = inheritance.inhrelid
    join pg_catalog.pg_namespace child_namespace
      on child_namespace.oid = child.relnamespace
    where parent.oid = 'public.inference_logs'::regclass
      and child.relname like 'ai_inference_logs\_%' escape '\'
    order by child.relname
  loop
    v_canonical_name := regexp_replace(
      v_partition.relation_name,
      '^ai_inference_logs_',
      'inference_logs_'
    );

    execute format(
      'alter table %I.%I rename to %I',
      v_partition.schema_name,
      v_partition.relation_name,
      v_canonical_name
    );
  end loop;
end;
$$;

-- Partition index identifiers are independent objects and are not renamed with
-- their parent table/index. Rename every remaining telemetry index, including
-- partition primary-key and attached index clones.
do $$
declare
  v_index record;
  v_canonical_name text;
begin
  for v_index in
    select index_namespace.nspname as schema_name, index_relation.relname as relation_name
    from pg_catalog.pg_class index_relation
    join pg_catalog.pg_namespace index_namespace
      on index_namespace.oid = index_relation.relnamespace
    where index_relation.relkind in ('i', 'I')
      and index_relation.relname like '%ai_inference_logs%'
    order by index_relation.relname
  loop
    v_canonical_name := replace(
      v_index.relation_name,
      'ai_inference_logs',
      'inference_logs'
    );

    execute format(
      'alter index %I.%I rename to %I',
      v_index.schema_name,
      v_index.relation_name,
      v_canonical_name
    );
  end loop;
end;
$$;

alter function private.ai_inference_logs_ensure_partition(date)
  rename to inference_logs_ensure_partition;

create or replace function private.inference_logs_ensure_partition(p_month_start date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamptz := date_trunc('month', p_month_start)::timestamptz;
  v_end timestamptz := (date_trunc('month', p_month_start) + interval '1 month')::timestamptz;
  v_partition_name text := format('inference_logs_%s', to_char(v_start, 'YYYY_MM'));
begin
  execute format(
    'create table if not exists public.%I partition of public.inference_logs
       for values from (%L) to (%L)',
    v_partition_name,
    v_start,
    v_end
  );
end;
$$;

revoke all on function private.inference_logs_ensure_partition(date)
  from public, anon, authenticated;

alter function private.reject_ai_inference_logs_mutation()
  rename to reject_inference_logs_mutation;

create or replace function private.reject_inference_logs_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'inference_logs is append-only: % is not permitted', tg_op;
end;
$$;

revoke all on function private.reject_inference_logs_mutation()
  from public, anon, authenticated;

alter trigger ai_inference_logs_block_update on public.inference_logs
  rename to inference_logs_block_update;
alter trigger ai_inference_logs_block_delete on public.inference_logs
  rename to inference_logs_block_delete;

alter policy ai_inference_logs_select_admin on public.inference_logs
  rename to inference_logs_select_admin;
alter policy ai_inference_logs_insert_member on public.inference_logs
  rename to inference_logs_insert_member;

-- Reassert the ratified least-privilege surface after the rename. Table renames
-- preserve ACLs, but these statements keep the security intent explicit.
revoke all on public.inference_logs from anon, authenticated;
grant select, insert on public.inference_logs to authenticated;

commit;

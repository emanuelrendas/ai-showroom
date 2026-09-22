-- V1 Milestone 2, Sections 4.2 and 4.4: mission_ai_drafts.
--
-- Architecture Decision (ratified, Option B): a dedicated table for AI-generated
-- drafts, separate from `missions`. Milestone 1's `missions` table (FROZEN) is not
-- altered by this migration: no new columns, no status values added to it. A
-- mission may accumulate several drafts over time, each with its own independent
-- review/approval lifecycle.
--
-- Status scope note: Section 4.4's literal text guards transitions to "applied" OR
-- "completed" on "the missions/tasks table". This table only ever uses
-- ('pending_review', 'applied', 'dismissed') -- 'completed' is mission-level
-- vocabulary that belongs to `missions.status` (untouched, FROZEN), not to a
-- draft's own lifecycle, so only 'applied' is guarded here.
--
-- Anti-spoofing note (ratified): approved_by/approved_at are never writable by a
-- direct client UPDATE (see the RLS policy below). The only path that can move a
-- row to 'applied' is the SECURITY DEFINER public.approve_mission_ai_draft(uuid)
-- RPC, which sets approved_by = auth.uid() and approved_at = now() itself, from
-- inside a function body the client cannot parameterize. The BEFORE UPDATE trigger
-- is the second, independent layer: it rejects ANY row landing on status =
-- 'applied' without both fields populated, regardless of which code path (RLS-
-- governed client, the RPC, or a direct service-role/SQL statement) produced it.

create table public.mission_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  schema_version text not null check (schema_version = '1.0.0'),
  summary text not null,
  suggested_actions text[] not null
    -- cardinality(), not array_length(): array_length() of '{}' is NULL, and
    -- NULL passes a CHECK constraint, which would silently let an empty
    -- array through despite SingleModelOutputSchema requiring .nonempty().
    check (cardinality(suggested_actions) >= 1),
  confidence_score double precision not null
    check (confidence_score >= 0 and confidence_score <= 1),
  confidence_tier text not null
    check (confidence_tier in ('HIGH', 'MEDIUM', 'LOW')),
  is_ai_generated boolean not null default true,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'applied', 'dismissed')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mission_ai_drafts_mission
  on public.mission_ai_drafts (mission_id);

create index idx_mission_ai_drafts_workspace_status
  on public.mission_ai_drafts (workspace_id, status);

create trigger mission_ai_drafts_touch_updated_at
before update on public.mission_ai_drafts
for each row execute function private.touch_updated_at();

-- Section 4.4 database-level HITL enforcement. Fires on every UPDATE, not only
-- the pending_review -> applied edge, so a row already 'applied' cannot later
-- be corrupted into carrying null approval fields by some other write path.
create or replace function private.enforce_mission_ai_draft_hitl_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'applied' and new.is_ai_generated then
    if new.approved_by is null or new.approved_at is null then
      raise exception
        'mission_ai_drafts: status "applied" requires a valid approved_by and approved_at';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_mission_ai_draft_hitl_gate()
  from public, anon, authenticated;

create trigger mission_ai_drafts_enforce_hitl_gate
before update on public.mission_ai_drafts
for each row execute function private.enforce_mission_ai_draft_hitl_gate();

-- SECURITY DEFINER: runs as the function owner, exempt from the restrictive
-- UPDATE policy below by ordinary table-ownership RLS exemption (no FORCE ROW
-- LEVEL SECURITY is set on this table). All authorization is therefore done
-- explicitly in the function body, not left to RLS.
create or replace function public.approve_mission_ai_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select workspace_id, status
    into v_workspace_id, v_status
  from public.mission_ai_drafts
  where id = p_draft_id
  for update;

  if v_workspace_id is null then
    raise exception 'Draft not found';
  end if;

  if not private.is_workspace_member(v_workspace_id) then
    raise exception 'Not authorized to approve this draft';
  end if;

  if v_status <> 'pending_review' then
    raise exception 'Draft is not pending review';
  end if;

  update public.mission_ai_drafts
  set status = 'applied',
      approved_by = (select auth.uid()),
      approved_at = now()
  where id = p_draft_id;
end;
$$;

revoke all on function public.approve_mission_ai_draft(uuid) from public, anon;
grant execute on function public.approve_mission_ai_draft(uuid) to authenticated;

alter table public.mission_ai_drafts enable row level security;

create policy mission_ai_drafts_select_member
on public.mission_ai_drafts
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy mission_ai_drafts_insert_member
on public.mission_ai_drafts
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
  and status = 'pending_review'
  and is_ai_generated = true
  and approved_by is null
  and approved_at is null
  and exists (
    select 1
    from public.missions m
    join public.projects p on p.id = m.project_id
    where m.id = mission_ai_drafts.mission_id
      and p.id = mission_ai_drafts.project_id
      and p.workspace_id = mission_ai_drafts.workspace_id
  )
);

-- Direct client UPDATE is deliberately narrow: only a row that is still
-- pending_review may be touched, and the result may only be pending_review
-- (content edits) or dismissed -- never applied, and never with approval
-- fields populated. Approval only ever happens through the RPC above.
create policy mission_ai_drafts_update_member
on public.mission_ai_drafts
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and status = 'pending_review'
)
with check (
  private.is_workspace_member(workspace_id)
  and status in ('pending_review', 'dismissed')
  and approved_by is null
  and approved_at is null
);

-- Explicit REVOKE, not just an absent GRANT: this Supabase project's default
-- privileges give anon/authenticated ALL DML on every new public table
-- (verified directly against a real local instance). DELETE is never
-- intended here -- drafts are dismissed via status, never physically
-- removed -- so it must be revoked explicitly, the same reasoning applied to
-- ai_inference_logs.
revoke all on public.mission_ai_drafts from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on public.mission_ai_drafts to authenticated;

-- V1 Milestone 2 remediation, SHOULD-FIX item 1 of the 2026-09-26 independent
-- pre-merge audit (`claude/2026-09-26-m2-pre-merge-audit.md`, Section 4,
-- findings 4e/4f). New migration, does not rewrite `20260922140000`.
--
-- What was wrong, re-derived from source, not from the audit's prose:
-- 1. The HITL gate trigger created in `20260922140000` is `BEFORE UPDATE`
--    only. An INSERT landing directly on status = 'applied' with null
--    approval fields is untouched by it. Its own header comment claims
--    coverage "regardless of which code path ... or a direct
--    service-role/SQL statement", which is false for INSERT. That header
--    is left as written -- this migration does not touch the original
--    file -- and this comment block is the documented correction: the
--    original claim was wrong for INSERT until this migration closed it.
-- 2. The gate condition was `new.status = 'applied' and new.is_ai_generated`.
--    `is_ai_generated` is an ordinary mutable column with no protection of
--    its own, so a row could reach `applied` with null approval fields by
--    flipping `is_ai_generated = false` in the same statement that sets
--    status. Unreachable through RLS for a plain `authenticated` session
--    today (the UPDATE policy's own WITH CHECK still blocks `applied`
--    outright), but reachable by any RLS-bypassing writer (service_role,
--    postgres, a future migration or seed, the Supabase SQL editor), and a
--    security discriminator should not depend on a column with no
--    protection of its own.
--
-- What this migration does, all three layers, defense in depth:
-- (a) Replace the gate function so it no longer keys off `is_ai_generated`
--     at all -- ANY row landing on status = 'applied' must carry both
--     approval fields, full stop.
-- (b) Re-point the trigger at BEFORE INSERT OR UPDATE, so a direct INSERT
--     of a spoofed 'applied' row is rejected the same way an UPDATE is.
-- (c) Add a table-level CHECK as a third, independent layer that survives
--     even if a future migration drops the trigger by mistake -- exactly
--     the class of gap SHOULD-FIX item 1 exists to close.
-- (d) Tighten `mission_ai_drafts_update_member`'s WITH CHECK so a member
--     cannot use an otherwise-permitted content edit (still pending_review
--     or moving to dismissed) to launder `is_ai_generated`, `created_by`,
--     `workspace_id`, `project_id`, or `mission_id` to a different value in
--     the same statement. None of these fields have a legitimate reason to
--     change after insert; the application never sends such a payload.
--
-- Preserves the existing intended authenticated flow unchanged: a normal
-- insert (pending_review, is_ai_generated = true, null approval fields) and
-- the normal member edit/dismiss path (still pending_review or moving to
-- dismissed, still no approval fields) are untouched by any of the four
-- changes above. Only the RPC `public.approve_mission_ai_draft` can still
-- move a row to 'applied', exactly as before.

-- (a) Drop the is_ai_generated discriminator; gate is now unconditional on
-- status alone.
create or replace function private.enforce_mission_ai_draft_hitl_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'applied' then
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

-- (b) Re-point the existing trigger at BEFORE INSERT OR UPDATE. Same name,
-- same function, now also fires on INSERT.
drop trigger if exists mission_ai_drafts_enforce_hitl_gate
  on public.mission_ai_drafts;

create trigger mission_ai_drafts_enforce_hitl_gate
before insert or update on public.mission_ai_drafts
for each row execute function private.enforce_mission_ai_draft_hitl_gate();

-- (c) Table-level CHECK, independent of the trigger and of any future RLS
-- policy change: no row can ever be stored at rest with status = 'applied'
-- and a null approval field, even if the trigger above is later dropped or
-- disabled by an RLS-bypassing writer.
alter table public.mission_ai_drafts
  add constraint mission_ai_drafts_approval_state_check
  check (status <> 'applied' or (approved_by is not null and approved_at is not null));

-- (d) Tighten the direct-UPDATE policy: the five security-sensitive
-- identity/provenance columns must be unchanged from the row's current
-- (pre-update) value. The subquery reads the current row by primary key;
-- it is evaluated against the query's own snapshot (this UPDATE's WHERE
-- targets a single row by id, so there is no self-visibility ambiguity),
-- and it is itself governed by `mission_ai_drafts_select_member`, which the
-- acting member already satisfies via the USING clause below.
drop policy if exists mission_ai_drafts_update_member on public.mission_ai_drafts;

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
  and is_ai_generated = (
    select d.is_ai_generated from public.mission_ai_drafts d where d.id = mission_ai_drafts.id
  )
  and created_by = (
    select d.created_by from public.mission_ai_drafts d where d.id = mission_ai_drafts.id
  )
  and workspace_id = (
    select d.workspace_id from public.mission_ai_drafts d where d.id = mission_ai_drafts.id
  )
  and project_id = (
    select d.project_id from public.mission_ai_drafts d where d.id = mission_ai_drafts.id
  )
  and mission_id = (
    select d.mission_id from public.mission_ai_drafts d where d.id = mission_ai_drafts.id
  )
);

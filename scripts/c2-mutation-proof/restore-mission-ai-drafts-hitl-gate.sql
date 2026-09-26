-- C2 / Block 3 mutation proof — RESTORE step.
--
-- Companion to disable-mission-ai-drafts-hitl-gate.sql (RED-1) and
-- disable-mission-ai-drafts-approval-check.sql (RED-2). Recreates BOTH
-- protections in one deterministic, idempotent pass, regardless of which
-- RED step(s) actually ran or how far they got:
--
--   1. The trigger, bound BEFORE INSERT OR UPDATE (not BEFORE UPDATE only --
--      see the 26 Sep 2026 Option B delta re-audit, finding F2: the
--      previous version of this file silently downgraded the trigger to
--      BEFORE UPDATE only, reopening finding 4e at the trigger layer on
--      every mutation-proof run. Fixed here.).
--   2. The table-level CHECK constraint
--      (mission_ai_drafts_approval_state_check).
--
-- exactly as both are defined in
-- supabase/migrations/20260926130000_harden_mission_ai_drafts_hitl_gate.sql
-- (parts (b) and (c)), so the local stack's schema is back to the ratified
-- post-20260926130000 migration state after the mutation-proof test runs.
-- "Byte-for-byte back to the ratified migration state" is claimed here
-- because it is now true of both protections, not just the trigger's
-- function body -- the previous header made that claim while only
-- restoring the trigger, and only as BEFORE UPDATE, which was false the
-- moment the CHECK-drop step (now RED-2) existed. This version's claim is
-- true because both `create trigger` and `add constraint` below are
-- copied verbatim from the migration.
--
-- Called unconditionally from the E4 mutation-proof test's `finally` block
-- in tests/e2e/milestone-2-security-boundary.spec.ts, so it runs whether the
-- test's own assertions passed or failed, and regardless of whether the
-- test reached RED-1 only or RED-1 + RED-2. `drop trigger if exists` and
-- `drop constraint if exists` make every step here idempotent: safe to
-- re-run by hand (see the runbook) if the automated restore itself is ever
-- interrupted (e.g. the test process is killed mid-run) — running this file
-- alone returns the local stack to the correct, ratified state, whether it
-- starts from GREEN, RED-1, or RED-2, PROVIDED no row with status =
-- 'applied' and a null approval field (approved_by or approved_at) exists
-- at the time this file runs. If one does, `ADD CONSTRAINT` fails with a
-- violated-check error, and because the `DO $$ ... $$` block below is a
-- single atomic statement, the trigger recreate above is rolled back too --
-- this restore does not partially apply. Clear any such row first, e.g.:
--   delete from public.mission_ai_drafts
--   where status = 'applied' and (approved_by is null or approved_at is null);
-- (the E2E test's own `finally` block does exactly this for the one row it
-- is responsible for -- the deliberately forged RED-2 row -- before calling
-- this file.)
--
-- This does not touch the hosted Supabase project (yljvselkecxdfrqwyums stays
-- paused throughout, per the dispatch's NO HOSTED SUPABASE RESTORE
-- constraint). It runs only against the local stack started by
-- `npx supabase start`, via `supabase db query --local --file <this file>`.
--
-- Single `DO $$ ... $$` block, not four top-level statements: `supabase db
-- query --local --file` submits the file's contents through a path that
-- uses the Postgres extended query protocol (Parse a single prepared
-- statement, then Bind/Execute), which rejects more than one SQL command
-- per Parse with "cannot insert multiple commands into a prepared
-- statement" -- confirmed directly against a real Postgres 16 instance via
-- the same protocol family (node-postgres' named-statement form). A `DO`
-- block is itself exactly one SQL command to the parser, so the four
-- drop/create/drop/add statements inside it travel as a single Parse
-- regardless of transport. PL/pgSQL passes DDL it does not itself recognize
-- straight through to the SQL engine via SPI, so DROP TRIGGER, CREATE
-- TRIGGER, and ALTER TABLE ... DROP/ADD CONSTRAINT are all valid directly
-- inside this block without EXECUTE.

do $$
begin
  -- Trigger: drop if present (RED-1/RED-2 leave it dropped; a bare GREEN
  -- re-run leaves it present), then recreate BEFORE INSERT OR UPDATE.
  drop trigger if exists mission_ai_drafts_enforce_hitl_gate
    on public.mission_ai_drafts;

  create trigger mission_ai_drafts_enforce_hitl_gate
  before insert or update on public.mission_ai_drafts
  for each row execute function private.enforce_mission_ai_draft_hitl_gate();

  -- CHECK constraint: drop if present, then recreate exactly as migration
  -- 20260926130000 defines it. drop-then-add (rather than a bare add) keeps
  -- this idempotent whether RED-2 ran or not.
  alter table public.mission_ai_drafts
    drop constraint if exists mission_ai_drafts_approval_state_check;

  alter table public.mission_ai_drafts
    add constraint mission_ai_drafts_approval_state_check
    check (status <> 'applied' or (approved_by is not null and approved_at is not null));
end;
$$;

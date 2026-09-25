-- C2 / Block 3 mutation proof — GREEN / restore step.
--
-- Companion to disable-mission-ai-drafts-hitl-gate.sql. Recreates the DB-
-- level HITL enforcement trigger exactly as it is defined in
-- supabase/migrations/20260922140000_create_mission_ai_drafts.sql (lines
-- 83-85), so the local stack's schema is byte-for-byte back to the ratified
-- migration state after the mutation-proof test runs.
--
-- Called unconditionally from the E4 mutation-proof test's `finally` block
-- in tests/e2e/milestone-2-security-boundary.spec.ts, so it runs whether the
-- test's own assertions passed or failed. `drop trigger if exists` first
-- makes this idempotent: safe to re-run by hand (see the runbook) if the
-- automated restore itself is ever interrupted (e.g. the test process is
-- killed mid-run) — running this file alone, at any time, returns the local
-- stack to the correct, ratified state.
--
-- This does not touch the hosted Supabase project (yljvselkecxdfrqwyums stays
-- paused throughout, per the dispatch's NO HOSTED SUPABASE RESTORE
-- constraint). It runs only against the local stack started by
-- `npx supabase start`, via `supabase db query --local --file <this file>`.
--
-- Single `DO $$ ... $$` block, not two top-level statements: `supabase db
-- query --local --file` submits the file's contents through a path that
-- uses the Postgres extended query protocol (Parse a single prepared
-- statement, then Bind/Execute), which rejects more than one SQL command
-- per Parse with "cannot insert multiple commands into a prepared
-- statement" -- confirmed directly against a real Postgres 16 instance via
-- the same protocol family (node-postgres' named-statement form). A `DO`
-- block is itself exactly one SQL command to the parser, so the drop/create
-- pair inside it travels as a single Parse regardless of transport. Nothing
-- inside the block changes: same `drop trigger if exists` first for
-- idempotency, same trigger definition, byte-for-byte, as the migration.

do $$
begin
  drop trigger if exists mission_ai_drafts_enforce_hitl_gate on public.mission_ai_drafts;

  create trigger mission_ai_drafts_enforce_hitl_gate
  before update on public.mission_ai_drafts
  for each row execute function private.enforce_mission_ai_draft_hitl_gate();
end;
$$;

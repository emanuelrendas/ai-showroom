-- Block 2B remediation, Class B, ratified under Part 18 (falsification pass
-- performed against a real Postgres 16 instance replaying the actual
-- migration chain through 20260924124625, not accepted on report alone;
-- see docs/evidencia/2026-09-25-block-2b-inference-logs-acl-remediation.md).
--
-- Root cause, verified directly against source: 20260922130000 and
-- 20260924124625 both REVOKE/GRANT only the parent relation
-- (public.ai_inference_logs / public.inference_logs). PostgreSQL partitions
-- created with CREATE TABLE ... PARTITION OF do not inherit the parent's ACL;
-- they instead pick up this project's schema-level
-- ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated,
-- which both ensure_partition() calls in 20260922130000 triggered before
-- either migration's own REVOKE ever ran. Net effect measured on a clean
-- replay: 28 unintended privilege rows (SELECT, INSERT, UPDATE, DELETE,
-- TRUNCATE, REFERENCES, TRIGGER x anon/authenticated x 2 partitions).
--
-- Severity note for the record: this is not only an ACL hygiene gap. RLS
-- does not govern TRUNCATE, and the append-only BEFORE UPDATE/DELETE row
-- triggers created in 20260922130000 do not fire on TRUNCATE either.
-- Verified directly: with the pre-remediation grants in place, `set role
-- authenticated; truncate table public.inference_logs_2026_09;` succeeds
-- unconditionally and destroys existing rows -- a live bypass of the
-- append-only doctrine via direct partition access, not merely a
-- theoretical excess grant. The "no demonstrated data leak" finding in
-- Block 2B covered SELECT only; it does not extend to this write path,
-- which is closed by the same remediation below.
--
-- Preserves, unchanged: parent authenticated SELECT + INSERT through
-- public.inference_logs, anon has no access to the parent, RLS, the
-- append-only triggers, ON DELETE RESTRICT, and partitioning itself.
-- Verified directly: with every child partition's anon/authenticated grants
-- revoked to zero, an authenticated workspace member can still INSERT and
-- SELECT entirely through the parent (PostgreSQL checks privileges on the
-- named relation in the query, the parent when accessed via
-- public.inference_logs, not on the partition PostgreSQL routes the row
-- into), while direct SELECT/TRUNCATE against the partition by name is
-- correctly rejected with permission denied.
--
-- No historical migration is edited. No hosted Supabase, no production, no
-- merge.

begin;

-- 1) Existing partitions (current + next, and any provisioned since
--    20260924124625): drop every unintended anon/authenticated grant.
--    Iterates pg_inherits rather than naming partitions, so this also
--    remediates any partition created between that migration and this one.
do $$
declare
  v_partition regclass;
begin
  for v_partition in
    select inhrelid::regclass
    from pg_catalog.pg_inherits
    where inhparent = 'public.inference_logs'::regclass
  loop
    execute format('revoke all on %s from anon, authenticated', v_partition);
  end loop;
end;
$$;

-- 2) Future partitions: private.inference_logs_ensure_partition(date) must
--    apply the same least-privilege posture at creation time, since this
--    project's schema-level default privileges grant anon/authenticated ALL
--    on every new public table and CREATE TABLE ... PARTITION OF does not
--    inherit the parent's ACL. Signature, search_path hardening, and the
--    idempotent create-if-not-exists behavior are unchanged; only the
--    trailing revoke is new.
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

  execute format(
    'revoke all on public.%I from anon, authenticated',
    v_partition_name
  );
end;
$$;

revoke all on function private.inference_logs_ensure_partition(date)
  from public, anon, authenticated;

commit;

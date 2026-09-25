# Block 2B Remediation: `inference_logs` Child-Partition ACLs

**Date:** 25 September 2026
**Branch:** `feature/milestone-2-single-model`
**Base HEAD (input to this remediation):** `1c36ab95cf90e4bd3b14ae102614834d1820e025`
**Class:** B (ACL hygiene, forward-only, no application/RLS/trigger change)
**Writer:** Claude Code (Sonnet 5)
**Status:** Implemented, self-verified locally against a real Postgres 16 replay. NOT yet verified by Tiago. E2E stays blocked until his clean replay confirms this migration.

This record documents an independent falsification pass under Part 18. Tiago's Block 2B finding is treated as CLAIM until re-derived from source and from a live database, not as FACTO on report alone.

## Environment constraint (disclosed, not worked around)

This session runs in a cloud sandbox where the Docker daemon cannot start (`ulimit`/container restrictions), so `npx supabase db reset --local`, `supabase db lint --local`, the local security advisor CLI, and `npm run test:rls` could not be executed here. In their place, a standalone PostgreSQL 16 instance was built by hand (`initdb` + `pg_ctl`, no Supabase CLI, no Docker) with a minimal but faithful `anon` / `authenticated` / `service_role` / `authenticator` role set, an `auth.users` stub, and this project's actual `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated` (the real cause of the excess grants). The **actual migration files** in `supabase/migrations/` were then replayed against it with `psql -v ON_ERROR_STOP=1`, in order, unmodified. Every FACTO below comes from querying `pg_catalog` / `information_schema` directly against that replay, not from re-reading Tiago's report.

What this does **not** substitute for: the real advisor tool's own output, and the committed `test:rls` Vitest suite. Tiago's clean replay on his isolated Windows clone, per the mission's own gate, is what closes that gap — this record narrows what he needs to re-check, it does not replace it.

## Root cause (FACTO, read directly from source)

Both `20260922130000_create_ai_inference_logs.sql` and `20260924124625_rename_ai_inference_logs_to_inference_logs.sql` issue `revoke all on public.<table> from anon, authenticated` / `grant select, insert on public.<table> to authenticated` against the **parent relation name only**. PostgreSQL does not propagate a parent's ACL to a partition created with `CREATE TABLE ... PARTITION OF`; the partition instead receives whatever this project's schema-level `ALTER DEFAULT PRIVILEGES` already grants — `ALL` to `anon` and `authenticated` on every new `public` table. Both `ensure_partition()` calls in `20260922130000` run *before* that migration's own revoke, so the current and next partitions were created with the default-privilege grant and never had it removed.

## Severity finding beyond Tiago's report (FACTO, verified directly)

Tiago's check was SELECT-only (`anon-visible = 0`, `authenticated-visible = 0`), correctly showing no read leak because RLS governs SELECT. RLS does **not** govern `TRUNCATE`, and the append-only `BEFORE UPDATE` / `BEFORE DELETE` row triggers from `20260922130000` do not fire on `TRUNCATE` either. Verified on the pre-remediation replay: with a real row present in `inference_logs_2026_09`, `set role authenticated; truncate table public.inference_logs_2026_09;` succeeded unconditionally and the row count went from 1 to 0. The excess child-partition grants are therefore a demonstrated write/destruction path, not only a hygiene gap — Block 2B is correctly classified HOLD, not merely INFO-adjacent.

## Remediation

New forward migration `20260925130000_lock_down_inference_logs_partition_acls.sql`, after `20260924124625`, no historical migration edited:

1. A `DO` block iterates `pg_inherits` against `public.inference_logs` (not a hardcoded partition list) and `REVOKE ALL ... FROM anon, authenticated` on every existing child partition.
2. `private.inference_logs_ensure_partition(date)` is replaced (same signature, same `search_path = ''`, same idempotent `CREATE TABLE IF NOT EXISTS ... PARTITION OF` body) with one added statement: immediately after creating a partition, `REVOKE ALL ON public.<new partition> FROM anon, authenticated`. The function's own execute privilege revoke is reasserted.

No change to RLS policies, append-only triggers, `ON DELETE RESTRICT`, partitioning, or the parent's own `SELECT, INSERT` grant to `authenticated`.

## Evidence

All of the below reproduced against a **clean** replay of the full real migration chain (all 8 prior migrations plus the new one, in order, unmodified) on a throwaway local database — not the hand-poked instance used to first characterize the defect.

**A — current + next partitions have no unintended child ACLs.**
`information_schema.role_table_grants` for `anon`/`authenticated` against `inference_logs_2026_09` and `inference_logs_2026_10`: **0 rows** (was 28).

**B — a freshly-created future test partition also receives no unintended ACLs.**
Called `private.inference_logs_ensure_partition()` for a month two months out; the function created `inference_logs_2026_11`. `role_table_grants` for `anon`/`authenticated` against it: **0 rows** at creation time, no follow-up statement needed.

**C — parent `authenticated` SELECT/INSERT behavior is preserved.**
With zero grants on any child partition, an `authenticated` role acting as a real workspace owner (`auth.uid()` matching `workspace_members.user_id`, role `owner`) successfully `INSERT`s through `public.inference_logs` and then `SELECT`s it back (`visible_to_owner = 1`). A non-member `authenticated` user querying the same parent sees `visible_to_outsider = 0` (RLS unaffected). `anon` remains fully denied at the parent (`permission denied for table inference_logs`, unchanged from before this migration).

**D — no regression in append-only / RLS / direct-partition access.**
- `UPDATE`/`DELETE` through the parent as `authenticated`: still `permission denied` (pre-existing, from the original `grant select, insert`-only ACL — untouched by this migration).
- Direct `TRUNCATE` on `inference_logs_2026_09` as `authenticated`: now `permission denied` (was: succeeded and destroyed data — this is the fix for the severity finding above).
- Direct `SELECT` on a partition by name as `authenticated`: now `permission denied` (forces all access through the parent, where RLS applies).

**E — advisor result after clean replay.**
The literal Supabase advisor CLI could not run in this sandbox (Docker unavailable, see disclosure above). Its two underlying checks were reproduced directly by SQL against the clean replay: the excessive-ACL condition is **0 rows** (evidence A/B), and the `rls_enabled_no_policy` INFO condition (RLS enabled, zero partition-level policies) is unchanged and still present on every partition — expected, since partitions correctly rely on the parent's policies and this migration does not touch RLS. Tiago's own `supabase db advisor` run against his real local stack is the authoritative confirmation of E and remains required before this closes.

## What Tiago still needs to verify

This record does not substitute for his clean replay. It narrows it to: confirm the migration file applies cleanly after `20260924124625` on his machine, confirm his own advisor run shows 0 ERROR / 0 WARN / exactly the 2 pre-existing INFO (no new findings), and re-run `npm run test:rls` for 31/31 (this migration touches only GRANT/REVOKE statements and the partition-creation helper, not any RLS policy, table structure, or trigger the existing suite exercises, so no regression is expected — but it was not run against the actual suite in this session and must not be assumed).

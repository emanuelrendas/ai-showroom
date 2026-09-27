# M2 — Block 2A/2B: Clean Local Replay and Local Security Advisor Lint — SUPERSEDED, now PASS

**Date:** 25 September 2026, GST
**Branch:** `feature/milestone-2-single-model`
**Status:** **PASS, closed 25 Sep 2026 via Tiago's Windows execution — see "25 September 2026 — CLOSED" section at the end of this file. Everything below this point, down to that section, is the original HOLD record, preserved unchanged as the genuine historical account of this cloud session's own environment blocker.**

## Scope (per the 25 Sep 2026 advisor-scope decision)

- Block 2A: clean local replay (`npx supabase db reset --local` against the repo-local Docker Postgres instance only — `127.0.0.1:54322`/`127.0.0.1:54321`, no `--linked`, no hosted DB URL).
- Block 2B: local database security/advisor-equivalent lint (`supabase db lint --local` and the local Studio Security/Performance advisor `run-lints` API), covering RLS coverage, grants, `SECURITY DEFINER` functions, `search_path`, cross-tenant leaks, append-only protections, and the `missions`/`mission_ai_drafts`/`inference_logs` interaction specifically.

## Local isolation: proven, as far as it goes

Docker isolation intent is confirmed by inspection before any attempt to start the stack:

```text
$ cat supabase/config.toml | grep -n "port = 543"
[api]  port = 54321
[db]   port = 54322, shadow_port = 54320
[studio] port = 54323
```

All loopback-only, matching the isolation discipline already established in `docs/acceptance/d3-ti-01-local-supabase-runbook.md` and reused unchanged for this mission. **No `--linked` command was run. No hosted database URL was used or referenced. The hosted project `yljvselkecxdfrqwyums` was never queried, never restored, and remains paused/inactive** — this much is true regardless of whether the local stack can be brought up, because it concerns what was *not* done.

## Why the replay itself did not run

Identical root cause to `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`: `npx supabase start` (which `db reset --local` depends on for a stack that has never been started in this container) requires pulling `supabase/postgres`, `supabase/gotrue`, `postgrest/postgrest`, `supabase/kong`, `supabase/studio`, `supabase/edge-runtime`, `axllent/mailpit`, `timberio/vector`, `supabase/logflare`, `supabase/postgres-meta`, and related images from `docker.io` and `ghcr.io`. Both registries return `403 Forbidden` at this session's egress proxy:

```text
Error response from daemon: failed to resolve reference "ghcr.io/supabase/kong:2.8.1": ... Forbidden
Error response from daemon: failed to resolve reference "docker.io/supabase/gotrue:v2.196.0": ... Forbidden
Error response from daemon: failed to resolve reference "docker.io/postgrest/postgrest:v16.1": ... Forbidden
[... one Forbidden per required image, full raw output preserved in this mission's tool transcript]
```

Docker itself is not the limitation this time — `dockerd` was started successfully in this container and `docker version` reports both a working client and server. The limitation is strictly the registry egress allowlist, which does not include `docker.io` or `ghcr.io` (confirmed against the proxy's own status endpoint, `recentRelayFailures`, and its documented `noProxy`/allowlist, which lists only `registry.npmjs.org`, `jsr.io`, `pypi.org`, `files.pythonhosted.org`, `index.crates.io`, `proxy.golang.org`, `github.com`, and Anthropic API hosts). No local Postgres package (`postgresql-16`, confirmed installed) was substituted as a workaround, because a bare Postgres server has none of Supabase's `auth` schema, `anon`/`authenticated` roles wired to real GoTrue-issued JWTs, or PostgREST in front of it — standing one up by hand would be exactly the "synthetic boundary" the dispatch forbids for C2, and would not exercise the real `npm run test:rls` / `supabase db lint --local` / Studio advisor commands this block specifically requires.

## Result

**BLOCK 2A (clean local replay): HOLD — not executed [as of this original record].**
**BLOCK 2B (local security advisor lint): HOLD — not executed [as of this original record].** ERROR/WARN/INFO counts cannot honestly be reported; no fabricated lint result is recorded here.
**BLOCK 2C (static Auth config review): PASS** — see `docs/evidencia/2026-09-25-m2-auth-config-review.md`, which required no database and was completed.

**The Block 2 exit gate is NOT reached [as of this original record].** The acceptance matrix is NOT advanced to 11/12 on the strength of this record. See `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` for the same registry-access blocker and the three options to close it, which apply identically here — the fastest path to unblocking Block 2A/2B is the same session/operator action that unblocks C2, since both need only the same running local stack.

## 25 September 2026 — CLOSED

Tiago executed the runbook (`docs/evidencia/2026-09-25-m2-runbook-tiago.md`) on his own Windows machine, isolated clone `C:\Users\diore\ai-showroom-m2-verify`, branch `feature/milestone-2-single-model`, HEAD `345b18c57963f7f996c0d8650fa3922003b49949` — matching this branch's HEAD exactly. Neither blocker above applies on his machine (normal, unrestricted Docker and internet access).

**BLOCK 2A (clean local replay): PASS.** `npm.cmd run test:rls` returned `Test Files 3 passed (3)`, `Tests 31 passed (31)` (`inference-logs.rls.test.ts` 12, `milestone-1.rls.test.ts` 7, `mission-ai-drafts.rls.test.ts` 12) and `npx supabase db lint --local` returned "No schema errors found." Both require a live, cleanly-replayed local Postgres instance to run at all, so a clean local replay is a precondition their PASS result already confirms — not merely inferred.

**BLOCK 2B (local security advisor lint): PASS.** `npx supabase db advisors --local --type security --level info` returned **0 ERROR / 0 WARN / 2 INFO**. Both INFO findings are `rls_enabled_no_policy` on `public.inference_logs_2026_09` and `public.inference_logs_2026_10` — expected and already justified: policies are defined once on the parent, and a partition with RLS enabled and no policy of its own defaults to zero access for every non-owner role (fail-closed, not a gap). No new finding beyond what this milestone's own prior local advisor pass (22 Sep 2026, in `docs/acceptance/milestone-2.md`) already characterized and accepted.

This closure also confirms the separate Block 2B child-partition ACL/TRUNCATE remediation (`docs/evidencia/2026-09-25-block-2b-inference-logs-acl-remediation.md`, migration `20260925130000_lock_down_inference_logs_partition_acls.sql`): Tiago directly queried `information_schema.role_table_grants` for `anon`/`authenticated` against the two partitions and got **0 rows**, down from the 28 unintended rows he originally found. That excess-ACL condition, not the advisor's own INFO output, was the real defect this Block 2B item exists to catch, and it is now closed — recorded honestly as a genuine write/destruction path that was fixed, not as something the 2 INFO findings above ever covered or excused.

**BLOCK 2 EXIT GATE: REACHED.** Clean local replay, local security advisor lint (0 ERROR/0 WARN, all INFO justified), and static Auth config review (Block 2C, already PASS) are all closed. Hosted project `yljvselkecxdfrqwyums` remained paused/inactive throughout — not restored, queried, or mutated by this closure or by Tiago's execution.

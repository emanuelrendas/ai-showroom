# M2 — F1/F2 fix verification (Option 1, layered mutation proof)

- **Date:** 26 September 2026, GST
- **Branch:** `feature/milestone-2-single-model`
- **Session:** Claude Code, Sonnet 5, effort high, bounded Writer Slot for this mission only
- **Authorization:** Emanuel Rendas, dispatch of 26 Sep 2026, "Implement Emanuel's selected Option 1 — layered mutation proof", closed scope items 1–5
- **Prior audit:** `claude/2026-09-26-m2-option-b-delta-reaudit.md` (Claude Fable 5.1, HOLD, findings F1–F6)
- **Raw command output:** `docs/evidencia/raw/2026-09-26-f1-f2-fix/*.log`, genuine, unedited except for the two truncations noted inline below (both noted at the point of truncation, nothing removed that changes a result)

## Result: implementation complete and self-verified where this sandbox allows. Required live gates (`test:rls`, `test:e2e`) could not execute — FAIL CLOSED, per the mission's own instruction. 12/12 is NOT claimed. DEPLOY and MERGE remain HOLD.

This is not a new finding: it is the same Docker-registry egress block already disclosed in `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` ("Why this has not been executed") and in the 26 Sep delta re-audit's own environment section. This record exists to (a) reconfirm it with fresh, dated evidence from this session rather than reuse the old record, and (b) report exactly what *could* be verified for real in this sandbox, and how.

## What this session implemented (F1, F2, regression tests, docs)

1. **F1 — layered mutation proof**, `tests/e2e/milestone-2-security-boundary.spec.ts`: replaced the single RED/GREEN test (invalid at this HEAD, per delta re-audit finding F1) with GREEN → RED-1 → RED-2 → RESTORE → GREEN, matching Emanuel's selected Option 1 exactly. See that file's mutation-proof test for the full sequence and comments.
2. **F2 — script fixes**, `scripts/c2-mutation-proof/`:
   - `disable-mission-ai-drafts-hitl-gate.sql` — re-purposed as RED-1 (drop trigger only), header rewritten to describe the layered design accurately.
   - `disable-mission-ai-drafts-approval-check.sql` — **new**, RED-2 (drop the CHECK, on top of RED-1).
   - `restore-mission-ai-drafts-hitl-gate.sql` — rewritten to recreate **both** the trigger (`BEFORE INSERT OR UPDATE`, not the previous silent downgrade to `BEFORE UPDATE` only — finding F2) and the CHECK constraint, in one idempotent `DO $$ ... $$` block, safe to run from GREEN, RED-1, or RED-2 state.
3. **Permanent regression coverage**, `tests/rls/mission-ai-drafts.rls.test.ts`, per finding F3: 8 new pinned tests — service-role INSERT straight at `applied` with missing approvals (finding 4e); service-role UPDATE to `applied` while flipping `is_ai_generated=false` (finding 4f); a positive-control ordinary member content edit; and five parameterized tests, one per pinned column (`is_ai_generated`, `created_by`, `workspace_id`, `project_id`, `mission_id`), each proving a member cannot launder that column through an otherwise-permitted edit, and that the bundled edit itself is rejected wholesale, not just the pinned column.
4. **Documentation addendum**, `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`: dated, additive "26 September 2026" section appended after the historical "PASS" record, which is preserved byte-for-byte unchanged. Explains the three-layer defense-in-depth boundary, the new layered proof design, and a real bug this fix's own verification caught (below).

## A real bug caught by this session's own verification, before handoff

While self-verifying the RESTORE step (see the bare-Postgres replay below), the first pass failed: `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` validates every existing row by default, and RED-2 deliberately leaves behind a row in exactly the forbidden state (`status='applied'`, both approval fields null) to prove its point. RESTORE, called immediately after, tried to re-add the CHECK against a table that still held that row, and failed with `check constraint "mission_ai_drafts_approval_state_check" is violated by some row` (`raw/2026-09-26-f1-f2-fix/08-bare-postgres-replay.log`, first run, not included in the log below — only the fixed, passing re-run is captured, since the log file was overwritten in place; the failing transcript is described verbatim in `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`'s new addendum). Fixed by deleting the RED-2 fixture row (via the same admin/service-role client already used throughout the test) immediately after asserting RED-2 succeeded, before calling RESTORE — applied to both the Playwright spec and the replay driver. Re-run after the fix: full pass, see below. This is exactly the class of defect Evidence Before Authority exists to catch: static reasoning about the SQL would not have surfaced it; running it did, on the first real attempt.

## Verification actually executed in this sandbox (genuine, fresh, this session)

| Gate | Result | Raw log |
|---|---|---|
| `npx next typegen` + `npm run typecheck` | **PASS**, exit 0, 0 errors | `raw/.../01-typecheck.log`, re-confirmed after the RED-2 fix in `raw/.../09-final-recheck.log` |
| `npm run lint` | **PASS**, exit 0, 0 errors, 6 pre-existing warnings (all in `tests/unit/obsidian-sync-canary-runner.test.ts`, unrelated to this mission's files, unchanged from the 26 Sep delta re-audit's own baseline) | `raw/.../02-lint.log`, `09-final-recheck.log` |
| `npm test` (unit) | **PASS**, 308/308, 32 files | `raw/.../03-unit-test.log`, `09-final-recheck.log` |
| Bare-Postgres replay of the actual RED-1/RED-2/RESTORE SQL (native PostgreSQL 16.13, **not** the official `test:rls`/`test:e2e` gate) | **PASS**, all 9 assertions matched expected behavior after the RED-2 fix above, including the two post-restore catalog checks | `raw/.../08-bare-postgres-replay.log` |
| `npm run test:rls` | **BLOCKED**, genuine `fetch failed` against `http://127.0.0.1:54321` (no local Supabase API running) — 3 files, 39 tests skipped (31 pre-existing + 8 new) | `raw/.../06-test-rls-attempt.log` |
| `npm run test:e2e` | **BLOCKED**, two independent failures: (1) `npx playwright test --list` without the env-file flag reports missing Supabase env vars, benign artifact of how it was invoked directly; (2) the actual `npm run test:e2e` (env-file loaded correctly) fails at Playwright's `webServer` startup with `npm.cmd: not found` — `playwright.config.ts`'s `webServer.command` is hardcoded to `npm.cmd`, a pre-existing, unrelated Windows-only assumption, out of this mission's closed scope to fix (see "Out of scope" below) | `raw/.../07-test-e2e-attempt.log` |
| `npx supabase start` | **BLOCKED**, every required container image (`supabase/postgres`, `gotrue`, `postgrest`, `kong`, `realtime`, `storage-api`, `postgres-meta`, `studio`, `mailpit`, `vector`, `edge-runtime`) rejected by the egress proxy with `403 Forbidden` from `registry-1.docker.io` | `raw/.../05-supabase-start.log` |
| `docker pull hello-world` (generic control, confirms this is an org-wide registry policy, not Supabase-specific) | **BLOCKED**, `403 Forbidden`, confirmed again via `curl http://127.0.0.1:38241/__agentproxy/status` (`recentRelayFailures`, `connect_rejected`, `registry-1.docker.io:443`, timestamped `2026-09-26T09:37:47Z`) | `raw/.../04-docker-registry-block.log` |

Docker daemon itself (`dockerd`) starts and runs fine in this sandbox (`docker ps` succeeds) — the block is specifically outbound registry access, confirming this is the same organization-level egress policy already documented on 25 Sep 2026, not a container-runtime limitation.

## Why the bare-Postgres replay is reported, and what it does and does not prove

It is **not** a substitute for `npm run test:rls` or `npm run test:e2e`, and this record does not claim it is. It is a native PostgreSQL 16.13 instance (`apt-get install postgresql`, no Docker, no container), running the exact SQL text of `disable-mission-ai-drafts-hitl-gate.sql`, `disable-mission-ai-drafts-approval-check.sql`, and `restore-mission-ai-drafts-hitl-gate.sql` verbatim (schema-retargeted from `public.mission_ai_drafts` to a minimal `f1_replay.mission_ai_drafts` table carrying only the columns the trigger and CHECK touch), against the exact trigger function body from the migration. It genuinely executes the RED-1/RED-2/RESTORE mechanism end to end, including the post-restore catalog checks (`pg_get_triggerdef`, `pg_constraint`) the mission's "REQUIRED VERIFICATION" section asks for directly. What it does **not** exercise: RLS, the `authenticated`/`anon`/`service_role` role boundary, PostgREST, GoTrue/`auth.users`, the RPC (`approve_mission_ai_draft`), or the app's own write paths — those require the full stack and remain unverified by live execution in this session. This is the same class of evidence the 26 Sep Fable 5.1 delta re-audit itself used ("bare `initdb`, Supabase-shape shim... empirical replay... sufficient to establish F1 and F2 as deterministic") for exactly this reason: the trigger/CHECK mechanism is pure SQL and does not need the container stack to verify, while the RLS/RPC/app-boundary layer does.

## Confirmations requested by "REQUIRED VERIFICATION"

- **CHECK exists after tests:** confirmed, by the bare-Postgres replay's catalog check 2 (`raw/.../08-bare-postgres-replay.log`). Not confirmed against the real `public.mission_ai_drafts` table via the official gate (blocked, as above).
- **Trigger definition is `BEFORE INSERT OR UPDATE`:** confirmed, by the bare-Postgres replay's catalog check 1, and functionally, by the post-restore forged-INSERT assertion (rejected). Not confirmed against the real table via the official gate (blocked, as above).
- **Protected GREEN transition rejects forged approval / intended RPC approval still succeeds:** the RPC path (`approve_mission_ai_draft`) specifically was not replayed (it is SECURITY DEFINER PL/pgSQL against the full schema, workspace/project/mission FKs, and RLS — out of scope for a minimal bare-table replay); it is covered by the existing RLS test `"approves a pending draft through approve_mission_ai_draft and stamps approved_by/approved_at"`, unchanged by this fix, but not executed in this session for the same live-stack reason.

## Out of scope, observed but not touched

- `playwright.config.ts`'s `webServer.command: "npm.cmd run dev -- --hostname 127.0.0.1"` only works on Windows. This is why the previous close-out (`docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`, "25 September 2026 — CLOSED") could only ever run `npm run test:e2e` from Tiago's Windows machine, independent of the Docker registry block — even with a working local Supabase stack, this sandbox's Linux shell would still fail at the `webServer` step. Not fixed here: unrelated to F1/F2/regression-tests/docs, and the dispatch's HARD OUT OF SCOPE excludes unrelated refactor/cleanup. Flagged for Emanuel's decision.

## What was NOT done

No merge, no PR, no deploy, no hosted Supabase access or mutation (`yljvselkecxdfrqwyums` untouched, not queried), no removal of the CHECK constraint, no change to the intended application approval flow, no unrelated refactor. `.env.test.local` was created locally from `.env.test.example` to attempt the live gates for real (pointed at `http://127.0.0.1:54321` rather than the example's placeholder remote URL, so the resulting failure is the genuine "no local stack running" error rather than a DNS/placeholder-key error) — it is gitignored and not committed.

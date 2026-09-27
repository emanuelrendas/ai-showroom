# M2 — C2: Security Boundary Test and Mutation Proof — SUPERSEDED, now PASS

**Date:** 25 September 2026, GST (implementation completed and handed off same day; execution completed later the same day)
**Branch:** `feature/milestone-2-single-model`
**Status:** **PASS, closed 25 Sep 2026 via Tiago's Windows execution — see "25 September 2026 — CLOSED" section at the end of this file. Everything below this point, down to that section, is the original HOLD record, preserved unchanged as the genuine historical account of this cloud session's own environment blocker and of the two E2E-harness defects Tiago's own runs first surfaced (both fixed, see the closing section).**

## 25 September 2026 update — implementation is real, not a plan

Everything below the "Test plan" and "Required mutation proof" headings was originally drafted as a description of what *would* be built. It is no longer a description — the test file exists, is committed, typechecks clean, lints clean, and its test list is confirmed loadable by Playwright:

- **`tests/e2e/milestone-2-security-boundary.spec.ts`** implements every item in the test plan below as real, page-less Playwright tests, plus the required RED/GREEN mutation proof as its own test:
  - `E2 — no shortcuts` — outsider RPC rejection, direct spoofing UPDATE rejection, and proof that `public.missions` cannot represent a fabricated AI-approved state (no such columns exist under Option B).
  - `E3 — tenant isolation` — a user outside the workspace cannot see or mutate the Mission, `mission_ai_drafts`, or `inference_logs`.
  - `E4 — mission window sealed` (two tests): direct `public.missions` mutation refusal from the real `authenticated` boundary, and the mutation proof itself.
- **The mutation-proof test** runs the exact GREEN → RED → GREEN sequence from this record's "Required mutation proof" section, via `npx supabase db query --local --file <path>` against two new committed SQL fixtures:
  - `scripts/c2-mutation-proof/disable-mission-ai-drafts-hitl-gate.sql` — `drop trigger if exists mission_ai_drafts_enforce_hitl_gate on public.mission_ai_drafts;`
  - `scripts/c2-mutation-proof/restore-mission-ai-drafts-hitl-gate.sql` — the exact inverse, recreating the trigger byte-for-byte as defined in `supabase/migrations/20260922140000_create_mission_ai_drafts.sql`.
  The disable/restore pair is wrapped in try/finally in the test so the trigger is restored even if an assertion fails mid-test, with a loud `console.error` fallback naming the manual restore command if the finally-block restore itself throws.
- **`tests/e2e/milestone-2-hitl-deterministic.spec.ts`** (Block 3, E1) and its supporting `features/ai/provider.ts` deterministic-stub gate plus `tests/unit/provider-deterministic-stub.test.ts` were built alongside this (see `docs/evidencia/2026-09-25-m2-runbook-tiago.md` for the full picture) — E1 is a separate file, referenced here only because Tiago runs it in the same session as this proof.
- Confirmed in this session, without a live database (so these checks do not themselves close C2, but do confirm the implementation is sound): `npm run typecheck` exit 0, `npm run lint` 0 errors, `npm test` 308/308 (up from 304 — the 4 new deterministic-stub unit tests), and `npx playwright test --list` correctly enumerates all 5 new E1–E4 tests across both spec files with no parse or load errors.

What is still genuinely missing, and all this update changes, is **execution against a live local Postgres** — the Docker registry blocker below is unchanged and this session still cannot produce it. That is why status stays HOLD, not PASS: an unexecuted test, however well-built, is not evidence of the boundary holding.

## Real credential/path under test (derived from C1, not invented)

Per `docs/evidencia/2026-09-25-m2-c1-missions-write-map.md`, the only real, reachable AI/server execution boundary in M2 is the Postgres `authenticated` role, exercised through `lib/supabase/server.ts`'s `createServerClient` (publishable key, session-bound cookies) — the exact client construction used by `generateMissionAiDraftAction` and every other M2 server action. There is no separate "AI role," service context, or elevated credential anywhere in this call chain; C1 confirmed this by exhaustive code search rather than assumption. This record does **not** invent a synthetic boundary production/app code never uses, per the dispatch's explicit safeguard.

## Test plan (implemented in `tests/e2e/milestone-2-security-boundary.spec.ts`, not yet executed)

1. **Direct Mission INSERT from the `authenticated` boundary**, using a signed-in test client (same construction pattern as `tests/rls/mission-ai-drafts.rls.test.ts`): confirm `missions_insert_member` RLS still requires `created_by = auth.uid()` and workspace membership (already covered by production code's existing behavior; new assertion needed only to pin it as a regression guard).
2. **Direct Mission UPDATE from the `authenticated` boundary** attempting to set any hypothetical AI-approval-shaped value: since `public.missions` has no `is_ai_generated`/`approved_by`/`approved_at` columns under the ratified Option B architecture, this step proves the negative directly — such an UPDATE is rejected at the schema level (unknown column) before RLS is even evaluated, which is itself evidence that no AI-approval spoofing surface exists on `missions` at all under Option B.
3. **The actual Section-4.4-equivalent boundary under Option B: `mission_ai_drafts`.** Re-run, as a new pinned regression test (not merely re-citing the 12 existing tests in `tests/rls/mission-ai-drafts.rls.test.ts`), the direct-client and direct-service-role spoofing attempts against `mission_ai_drafts.status = 'applied'` with forged `approved_by`/`approved_at`, confirming both RLS (`mission_ai_drafts_update_member`'s `with check`) and the independent `BEFORE UPDATE` trigger (`private.enforce_mission_ai_draft_hitl_gate()`) reject them.
4. **Authorized human path remains functional**: `approve_mission_ai_draft(uuid)` still succeeds for a legitimate workspace member against a `pending_review` draft they're authorized to see.

## Required mutation proof (implemented as a single test, not yet executed)

Per the dispatch's required pattern:

1. **GREEN baseline** — run the new pinned test file against the schema as committed (trigger `mission_ai_drafts_enforce_hitl_gate` active): direct-client and direct-service-role spoofing attempts fail; the RPC path succeeds.
2. **RED** — temporarily, on the local/disposable database only, `DROP TRIGGER mission_ai_drafts_enforce_hitl_gate ON public.mission_ai_drafts;` (the exact, single protection under test, isolated from the RLS layer which is a separate, independently-tested mechanism) — re-run the same test file and confirm the direct-service-role spoofing attempt (which bypasses RLS by construction, per the existing test's own comment) now **succeeds** where it should have failed, proving the trigger — not RLS — is what the test is actually detecting.
3. **Restore** — re-create the trigger exactly as `20260922140000_create_mission_ai_drafts.sql` defines it (or simply re-run `supabase db reset --local` to replay the committed migration chain from scratch) and re-run the test file, confirming **GREEN** again.
4. **Final state** — the local/disposable database is left in the clean, migrated state (or torn down entirely); no committed migration file is edited for this exercise.

## Why this has not been executed

This mission's execution environment has full `docker` CLI and a working `dockerd` (started and verified operational during this mission — `docker version` succeeds, both client and server report). However, **every image pull required to bring up the local Supabase stack (`supabase start`) is blocked by this session's outbound network policy**, independent of Supabase specifically:

```text
$ docker pull hello-world
Error response from daemon: failed to resolve reference "docker.io/library/hello-world:latest":
failed to do request: Head "https://registry-1.docker.io/v2/library/hello-world/manifests/latest": Forbidden
```

The session's egress proxy status endpoint confirms this is a policy denial, not a transient failure:

```json
{
  "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "registry-1.docker.io:443"
}
```

`ghcr.io` (used for `supabase/studio`, among others) is denied the same way. Neither `docker.io` nor `ghcr.io` appears in this session's outbound allowlist (`registry.npmjs.org`, `jsr.io`, `pypi.org`, `files.pythonhosted.org`, `index.crates.io`, `proxy.golang.org`, `github.com`, and the Anthropic API hosts are the only allowlisted destinations). No cached copies of any of the required images (`supabase/postgres`, `supabase/gotrue`, `postgrest/postgrest`, `supabase/kong`, `supabase/studio`, etc.) exist in this container (`docker images` returns empty).

**This is the same class of environment limitation the dispatch itself anticipated for Block 2A** ("If Codex cannot access Docker's named pipe, do not modify Docker ACLs... the human operator may perform ONLY the local reset bridge if required"), except here the daemon itself is reachable — the blocker is the image registries, not the socket. Per that same fail-closed discipline, this record does **not** attempt a workaround: it does not route around the egress policy, does not substitute a hand-built minimal Postgres+RLS shim standing in for GoTrue/PostgREST/Kong (which would itself be exactly the kind of "synthetic boundary production/app code never uses" the dispatch explicitly forbids for C2, and would not actually exercise `npm run test:rls` / the real Supabase-js/PostgREST call path this proof needs to test), and does not mark this PASS on the strength of static reasoning alone.

## What is needed to close this

**Emanuel's decision, 25 September 2026: option 2, below.** Tiago runs the already-committed, already-implemented test suite on his own machine (no registry blocker there) and returns the raw output. The exact steps he needs are in `docs/evidencia/2026-09-25-m2-runbook-tiago.md`.

1. ~~This session's outbound egress policy is extended...~~ — not pursued; superseded by option 2.
2. **A human operator runs the equivalent local sequence** — `npx supabase start` (or `db reset --local`), then `npx playwright test tests/e2e/milestone-2-security-boundary.spec.ts`, which executes the RED/GREEN sequence above as part of its own test run — from this exact branch/commit, and returns the raw output for this record. **This is now in progress: Tiago is running this on his Windows machine per the runbook.**
3. If Tiago's environment also cannot produce a clean run, fall back to Emanuel accepting this Class-C item as CONDITIONAL (unchanged from its pre-mission state) rather than CLOSED.

## Result [as of this original record]

**C2: HOLD.** No RED result, no GREEN result — neither executed **in this session**. The test that will produce them is fully implemented, committed, typechecked, linted, and confirmed loadable by Playwright — only the live-database execution step remains, and it is now with Tiago. **The acceptance matrix is NOT advanced to 10/12 on the strength of this record.** C1 and C3 evidence stand on their own and are unaffected by this HOLD.

## 25 September 2026 — CLOSED

Tiago's first two Windows runs surfaced two real E2E-harness defects — not application, RLS, or HITL defects — both since fixed on this branch:

1. **`npx.cmd` EINVAL.** `runSupabaseDbQueryFile()` in `tests/e2e/milestone-2-security-boundary.spec.ts` invoked `npx.cmd` directly via `execFileSync`, which Windows rejects (`spawnSync npx.cmd EINVAL`). Fixed by spawning `cmd.exe` directly instead, preserving argv-array safety (no shell-injection regression, every argument a fixed repo-controlled literal). Commit `90c0115b7dc6d9a2db39a87df0636fb51583f060`.
2. **Multi-statement restore SQL rejected under the extended query protocol.** `scripts/c2-mutation-proof/restore-mission-ai-drafts-hitl-gate.sql` had two top-level statements (`drop trigger`, `create trigger`); `supabase db query --local --file` submits file contents via the Postgres extended query protocol, which rejects more than one command per Parse ("cannot insert multiple commands into a prepared statement"). This occurred *after* the trigger had already been disabled for the RED step; Tiago manually restored it and independently verified `mission_ai_drafts_enforce_hitl_gate` was back (`1 row`). Fixed by wrapping both statements in a single `DO $$ ... $$` block — one SQL command to the parser regardless of what it contains — reproduced and confirmed against a real Postgres 16 instance via node-postgres' named-statement (extended-protocol) form before being applied here. A second, unrelated nondeterminism source was fixed in the same commit: the E1 test's static Mission title collided with legitimate `ON DELETE RESTRICT` residue from repeated runs, causing `.single()` to fail nondeterministically; fixed via a `runId`-unique title. Commit `345b18c57963f7f996c0d8650fa3922003b49949` (this branch's current HEAD).

With both fixes in place, Tiago reran on Windows:

```
npm.cmd run test:e2e -- tests/e2e/milestone-2-hitl-deterministic.spec.ts tests/e2e/milestone-2-security-boundary.spec.ts
```

**RESULT: 5 passed.** E1 (full deterministic generate → review → approve → DB verification), E2 (no shortcuts), E3 (tenant isolation), E4 (direct `public.missions` mutation refused), and the E4 mutation proof itself — GREEN (trigger active, spoofing rejected) → RED (trigger dropped via `disable-mission-ai-drafts-hitl-gate.sql`, spoofing attempt now succeeds, proving the trigger — not RLS — is what the test detects) → RESTORE (single `DO` block) → GREEN again (spoofing rejected once more).

Tiago then built the app (`npm.cmd run build`, PASS, Next.js 16.3.3/Turbopack, 6/6 static pages) and started the production artifact (`next start`, port 3000), and reran the same two spec files against that live production-build server: **5 passed** again, independently, with Playwright reusing the running production server rather than its own dev instance.

## Result

**C2: PASS.** Real, executed RED/GREEN evidence exists (via Tiago's Windows run, not this session's own execution — this session's Docker/registry blocker is unchanged and disclosed above). The mutation proof specifically isolated the trigger as the protection under test, independent of RLS. This acceptance-matrix item is now closed; see `docs/acceptance/milestone-2.md`, "M2 FINAL ACCEPTANCE CLOSURE." C1 and C3 evidence stand on their own and were independently re-verified as part of that same closure. Hosted project `yljvselkecxdfrqwyums` remained paused/inactive throughout — not restored, queried, or mutated.

## 26 September 2026 — dated additive reconciliation (does not rewrite the above)

Everything above this heading is preserved unchanged as the genuine historical record of the 25 Sep 2026 close-out, including its own PASS verdict, which was correct **for the boundary that existed at that HEAD** (`345b18c57963f7f996c0d8650fa3922003b49949`). This section adds what changed since, without editing a single line above.

**What changed.** The independent Fable 5.1 delta re-audit of 26 Sep 2026 (`claude/2026-09-26-m2-option-b-delta-reaudit.md`) reviewed a later HEAD, `4a94eb86ee35dd98e0913d76d9a4896e2c4e5faa`, which added migration `20260926130000_harden_mission_ai_drafts_hitl_gate.sql` as SHOULD-FIX remediation for findings 4e/4f from the 26 Sep pre-merge audit. That migration is substantively correct and adds a third, independent layer: a table-level CHECK constraint (`mission_ai_drafts_approval_state_check`) that survives even if a future migration or an RLS-bypassing writer drops the trigger. The delta re-audit's finding F1 was that this made the *statement* "the trigger, not RLS, is the exact, single protection under test" (see the "Required mutation proof" heading above, step 2, and the "Result" line just above this section) **materially incomplete** at the new HEAD, not false about the HEAD it was written against, but no longer a complete description of the boundary as it now stands.

**The boundary today is defense-in-depth, three layers, not one:**

1. **RLS / `WITH CHECK`** — for an `authenticated` session, `mission_ai_drafts_update_member`'s `with check` blocks a direct client UPDATE from ever setting `status = 'applied'` at all (unchanged since `20260922140000`), and, as of `20260926130000` part (d), additionally pins `is_ai_generated`, `created_by`, `workspace_id`, `project_id`, and `mission_id` to their pre-update value via correlated subselects, so a member cannot launder any of those five columns through an otherwise-permitted content edit.
2. **The HITL trigger** (`private.enforce_mission_ai_draft_hitl_gate()`, bound `BEFORE INSERT OR UPDATE` since `20260926130000` part (b), previously `BEFORE UPDATE` only) — rejects any row reaching `status = 'applied'` without both `approved_by` and `approved_at` set, for any writer, RLS-governed or not, on both INSERT and UPDATE.
3. **The table-level CHECK constraint** (`mission_ai_drafts_approval_state_check`, added `20260926130000` part (c)) — the same rule as layer 2, enforced independently at the storage layer, so it holds even if the trigger above is later dropped or disabled by an RLS-bypassing writer, by mistake or otherwise.

**The mutation proof is now layered to match.** The single RED/GREEN sequence described above (drop the trigger, expect the forged transition to succeed) is no longer a valid test at HEADs on or after `20260926130000`: with the CHECK in place, dropping the trigger alone no longer lets the forged transition through, so that RED step's own assertion (`expect(redResult.error).toBeNull()`) now fails by construction — this was delta re-audit finding F1, fixed in the same commit as this addendum. The replacement, implemented in `tests/e2e/milestone-2-security-boundary.spec.ts`'s mutation-proof test and mirrored in three scripts under `scripts/c2-mutation-proof/`, is:

- **RED-1** — drop *only* the trigger (`disable-mission-ai-drafts-hitl-gate.sql`). Attempt the forged transition. Assert it is **still rejected**, and specifically that the error matches `/approval_state_check/i` rather than the trigger's own message — proving the CHECK is independently load-bearing, not merely present alongside the trigger.
- **RED-2** — additionally drop the CHECK (`disable-mission-ai-drafts-approval-check.sql`), on top of RED-1's already-dropped trigger. Attempt the same forged transition. Assert it **now succeeds** — proving the trigger and the CHECK together, not RLS (bypassed by the service-role client by construction throughout this test), not app code, not coincidence, are exactly what stood between a privileged writer and a forged `applied` row. The forged row this step creates is then **deleted** before RESTORE runs — see the caught-bug note immediately below.
- **RESTORE** — one idempotent pass (`restore-mission-ai-drafts-hitl-gate.sql`, a single `DO $$ ... $$` block) that recreates the trigger as `BEFORE INSERT OR UPDATE` and re-adds the CHECK constraint, safe to run from GREEN, RED-1, or RED-2 state alike.

**A real bug this layered design surfaced, and fixed, before handoff.** `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` validates every existing row by default. RED-2 deliberately forges a row into exactly the state the CHECK forbids (`status = 'applied'`, both approval fields null) to prove its point — and that row is still sitting in the table when RESTORE tries to re-add the CHECK immediately afterward. Left alone, RESTORE would fail with `check constraint "mission_ai_drafts_approval_state_check" is violated by some row`, and the mutation-proof test would never reach its final GREEN assertions. This was caught empirically, not by inspection: a bare-Postgres replay of the exact SQL in the three `scripts/c2-mutation-proof/*.sql` files (real PostgreSQL 16.13, native, run during this fix's own verification — see `docs/evidencia/2026-09-26-m2-f1-f2-fix-verification.md`) hit this failure on the first pass. The fix, applied to both the Playwright spec and the replay driver before either was considered done: delete the RED-2 fixture row (an admin/service-role delete, the same client already used throughout this test) immediately after asserting RED-2 succeeded, before calling RESTORE. This is also a preview, at unit scale, of delta re-audit finding F5's deploy-time concern (a pre-existing `applied` row with null approvals would make this same migration fail to apply against a real database) — the fix pattern is the same: find and clear any row in that forbidden state before the CHECK is (re-)added.
- **GREEN, reasserted** — after RESTORE, the forged transition is rejected again, checked via both an UPDATE (trigger's normal path) and a direct INSERT landing straight on `applied` (proving the restored trigger genuinely covers INSERT, not just UPDATE — the exact gap finding 4e closed).

This also fixes delta re-audit finding F2: the previous `restore-mission-ai-drafts-hitl-gate.sql` recreated the trigger as `BEFORE UPDATE` only, silently reopening finding 4e at the trigger layer on every mutation-proof run, while its own header claimed a "byte-for-byte" restoration to the ratified migration state. That claim is now true of both the trigger's binding (`BEFORE INSERT OR UPDATE`) and the CHECK constraint, because the restore script now recreates both, verbatim, from the migration.

**Permanent regression coverage added** (delta re-audit finding F3) in `tests/rls/mission-ai-drafts.rls.test.ts`, pinning findings 4e and 4f and the pinned-field tightening directly, independent of the E2E mutation-proof test above: a service-role INSERT landing on `applied` with missing approvals is rejected; a service-role UPDATE to `applied` that also flips `is_ai_generated = false` is rejected; an ordinary member content edit while `pending_review` still succeeds (positive control); and a member attempt to mutate each of the five pinned columns (`is_ai_generated`, `created_by`, `workspace_id`, `project_id`, `mission_id`), bundled into an otherwise-permitted edit, is rejected with the bundled edit itself also failing to land.

**What this addendum does not claim.** It does not assert that `npm run test:rls` or `npm run test:e2e` executed successfully against a live local Supabase stack in the session that wrote it — see `docs/evidencia/2026-09-26-m2-f1-f2-fix-verification.md` for the exact, fresh, genuine verification status of that session, including which gates ran for real and which remained blocked by this sandbox's Docker registry egress policy (the same class of blocker disclosed earlier in this file, confirmed again with fresh evidence). Nothing in this section reconciles the M2 acceptance matrix; that reconciliation, if any, is recorded only in `docs/acceptance/milestone-2.md` and only on the strength of an execution that actually ran.

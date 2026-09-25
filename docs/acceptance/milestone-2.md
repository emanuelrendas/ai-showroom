# V1 Milestone 2 - Acceptance Checklist

**Milestone:** Single-Model AI
**Release state:** FROZEN for M2 acceptance, 25 September 2026. All 12 of 12 Section 5 criteria are evidenced and closed. Merge and deploy are explicitly separate future gates and are NOT authorized by this freeze — see "25 September 2026 — M2 FINAL ACCEPTANCE CLOSURE" near the end of this document for the closing record and full evidence.
**Report date:** 22 September 2026 (updated 24 September 2026 to distinguish manual success, automated attempts, observed failures, and inferred causes; updated 25 September 2026 — see the two dated 25 September update sections near the end of this document. The first 25 September section, "M2 Final Acceptance Closure Attempt," recorded a genuine environment-blocked HOLD at 9/12 + 1 conditional and is preserved below as historical record, now superseded. The second, "M2 FINAL ACCEPTANCE CLOSURE," records the real Tiago Windows execution evidence that closed the remaining items and reached 12/12.)
**Design document:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`

Only mark an item complete when supported by manual, automated, database, or advisor evidence, per the same discipline `docs/acceptance/milestone-1.md` already established. As of 25 September 2026, all twelve Section 5 criteria have that evidence and canonical alignment — see the Acceptance Matrix and the "M2 FINAL ACCEPTANCE CLOSURE" section below.

## Implementation Commits

| SHA | Commit |
|---|---|
| `84e605d0609bb7d0736f73d4ccc499a5b72d38d6` | feat(ai): implement Section 3.3.1 strict input and output Zod schemas |
| `5b1750dd903bcd8acb651dbe5bd85b3086f3be9e` | feat(ai): implement Section 3.3.2 InferenceExecutionWrapper with cost ceiling and fail-closed handling |
| `87d043d3dbfd7f8c832e6b7a6432f7e0218c6d88` | feat(ai): implement ai_inference_logs schema, append-only trigger, and Supabase adapter |
| `f8773fbb822c25b4ce63997aad7c67a83267cf2b` | feat(ai): implement mission_ai_drafts schema, HITL trigger, and approval RPC |
| `724e91b0c6582cf1446d89eb6513ed2b6f629824` | feat(ai): implement draft application layer, pure generation core, server actions, and provider stub |
| `16973505b0f71da19e8bc88347f5d925a5b3f27a` | feat(ai): implement HITL review UI, MissionAiDraftsPanel, and mission page integration |
| `f1ba8cf4bc8da1abeac1352946f3bbf1e9e8202f` | docs(milestone-2): sync design spec decisions and generate acceptance matrix |
| `54c8f501ac9485ae053e43c5d43bf0e2a3b4b951` | fix(security): enforce explicit DML revokes on AI tables and verify live Postgres RLS |
| `0be3583d2e060d5e5dade5aae5fbce3a4cee6e1c` | docs(acceptance): record clean local db lint evidence for milestone 2 |
| `99f997acb0dcd3547f7e41ff6f4d0556fc02de00` | feat(ai): wire gemini-1.5-flash provider adapter and calibrated cost estimator |
| `961a7b1d1df161b48f67f188c6ae8cc8866ada29` | feat(ai): calibrate gemini-3.6-flash provider, pricing micros, and HITL prompt guards |

## Acceptance Matrix (Section 5 of the design document, in order)

- [x] `SingleModelInputSchema` and `SingleModelOutputSchema` implemented with `.strict()`, matching Section 3.3.1 exactly.
- [x] `InferenceExecutionWrapper` implemented per Section 3.3.2, telemetry never sourced from model-reported text.
- [x] A test proves `safeParse()` rejects a malformed model response with `MODEL_SCHEMA_VIOLATION` and HTTP 422, no silent coercion path exists.
- [x] Model call functional against a dedicated test or bancada Supabase project, never against production during development. **Executed 22 Sep 2026: real gemini-3.6-flash call via the browser UI against the local Supabase instance, approved through the full HITL flow. See below for the exact inference log and draft rows.**
- [x] Zero write path exists from this feature to any `raioc-os` table, verified by code search, not by claim.
- [x] The current Option B implementation has a Postgres `BEFORE UPDATE` trigger on `mission_ai_drafts` and recorded direct-SQL bypass evidence; canonical Section 4.4 is amended for M2 to place this load-bearing boundary there. **CHECKED 25 Sep 2026: Emanuel ratified Option B; C1 (write-path map), C2 (mutation proof, executed on Tiago's Windows machine), and C3 (Section 4.4 addendum) all PASS. See "M2 FINAL ACCEPTANCE CLOSURE" below.**
- [x] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [x] `inference_logs` implements the Section 6 structural fields, foreign keys, canonical indices, bigint cost accounting, monthly partitioning, `ON DELETE RESTRICT`, and append-only hardening. **Verified 24 Sep 2026 after Docker Desktop 4.92 recovery and a human-run clean local replay (`npx supabase db reset --local`, run twice from the repository root).** The complete migration chain applied through `20260924124625_rename_ai_inference_logs_to_inference_logs.sql`; post-reset catalog, privileges, RLS policies, append-only triggers, partition helpers, and `npm run test:rls` all passed locally. The clean accounting query returned `0` accumulated micros, `20000000` budget micros, and `20000000` remaining micros. No hosted or linked project was used.
- [x] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass. **CHECKED 25 Sep 2026: all six pass on Tiago's Windows execution at HEAD `345b18c57963f7f996c0d8650fa3922003b49949` — unit 308/308, RLS 31/31, typecheck clean, lint 0 errors (6 pre-existing unrelated warnings), build PASS (Next.js 16.3.3/Turbopack, 6/6 static pages), test:e2e 5/5 (run twice: once as the deterministic suite, once again against the running production-build server). See "M2 FINAL ACCEPTANCE CLOSURE" below.**
- [x] Supabase security advisors show no new finding introduced by this milestone. **CHECKED 25 Sep 2026 under Emanuel's ratified local-only advisor scope** (`docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`): the hosted Platform/Auth-category advisor is explicitly deferred to the deploy milestone, not part of M2's acceptance scope. Local advisor result on Tiago's final run: 0 ERROR / 0 WARN / 2 INFO, both INFO findings justified (`rls_enabled_no_policy` on the two `inference_logs` monthly partitions — expected, since policies live on the parent and partitions correctly default to zero direct access). Full local Security + Performance advisor detail from the 22 Sep run remains below (19 findings, 0 errors, none a new regression) as the fuller historical record.
- [x] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [x] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

**12 of 12 checked, as of 25 September 2026, with evidence recorded below for each.** (An earlier version of this line read "8 of 12" — an arithmetic error against the matrix above, which had 9 of 12 checked at that report date, not 8; both counts are now moot and preserved here only for the record.)

## Evidence Recorded

### Zod contract strictness (checked)

`features/ai/schemas.ts` (`84e605d`). `tests/unit/ai-schemas.test.ts`: 17 automated tests, including explicit `unrecognized_keys` assertions proving `.strict()` rejects extra fields on both schemas. Re-run 22 Sep 2026 as part of the full suite (see below): pass.

### InferenceExecutionWrapper (checked)

`features/ai/inference-wrapper.ts` (`5b1750d`). `tests/unit/inference-wrapper.test.ts`: 7 automated tests covering the happy path, input validation rejection, cost-ceiling abort (both the negative and the positive "within ceiling" case), and the three fail-closed scenarios below. All usage/telemetry fields are sourced from `providerResult.usage`, never from parsed model text.

### `MODEL_SCHEMA_VIOLATION` / HTTP 422 (checked)

Covered by the "fails closed on a malformed model output" test in `inference-wrapper.test.ts`, and again at the application layer in `tests/unit/generate-mission-ai-draft.test.ts`. Both assert `failure.code === "MODEL_SCHEMA_VIOLATION"` and `failure.httpStatus === 422`.

### Model call against a real provider (checked)

`features/ai/provider.ts` wires `gemini-3.6-flash` via native `fetch()` (no new SDK dependency), with a `costEstimator` calibrated to its real per-token pricing feeding the $0.02 hard ceiling. **Executed 22 Sep 2026**, end-to-end, through the real browser UI, against the local Supabase instance (`http://127.0.0.1:54321`, never production) — not a script, not a mock: signed in as a real test user, submitted a real prompt through `GenerateDraftForm`, and approved the resulting draft through `MissionAiDraftCard`'s Approve button, which calls the `approve_mission_ai_draft` RPC.

**`inference_logs` telemetry row for this exact call (captured before the canonical rename):**

```text
id:                 8d85e0a6-b09d-4aca-abe1-d0208e4bfe1c
status:             success
model_identifier:   gemini-3.6-flash
prompt_tokens:      60
completion_tokens:  97
total_tokens:       157
cost_usd_micros:    45
latency_ms:         5027
task_type:          summarize
created_at:         2026-09-22 13:52:10.373747+00
```

Cost reconciles exactly: `60 * 0.10 + 97 * 0.40 = 44.8`, `Math.ceil(44.8) = 45`. 45 micros is $0.000045 -- orders of magnitude under the 20,000-micro ($0.02) ceiling.

**`mission_ai_drafts` row this call produced, after approval:**

```text
id:            49676b8c-dcb6-4f02-bd00-5cf0b2c3b21b
mission_id:    e197a0a4-4044-4a01-856f-68d97449e70f
status:        applied
confidence_score: 0.95
confidence_tier:  HIGH
approved_by:   cb8ce9d8-aa07-43ef-877c-0442eb7ccead
approved_at:   2026-09-22 13:52:51.455912+00
created_by:    cb8ce9d8-aa07-43ef-877c-0442eb7ccead
created_at:    2026-09-22 13:52:10.383824+00
```

`created_at` on the draft (13:52:10.38) matches the inference log's `created_at` (13:52:10.37) to the second -- same call, same origin. `approved_at` is ~41s later -- the real time it took a human to read the draft and click Approve, not an automated or fabricated timestamp.

Both rows were queried directly from the telemetry table (now `public.inference_logs`) and `public.mission_ai_drafts` via `docker exec supabase_db_ai-showroom psql`, not through the application layer, so this is independent of any bug the app itself might have in how it reports its own success.

A second row in the telemetry table from the same test session (`12da0217-...`, `status: failed`, `failure_reason: PROVIDER_ERROR`, no cost/tokens/model recorded) shows the fail-closed path also held during real usage, not only in mocks -- a call that didn't complete left an honest failure record, not a fabricated success.

### Zero write path to `raioc-os` (checked)

Run 22 Sep 2026:

```text
grep -rn "raioc-os\|raioc_os" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
-> 0 matches
```

### Postgres HITL trigger on `mission_ai_drafts` (implementation evidence; Class C — CHECKED 25 Sep 2026, see resolution below)

`supabase/migrations/20260922140000_create_mission_ai_drafts.sql` implements `private.enforce_mission_ai_draft_hitl_gate()`. **Executed 22 Sep 2026** against a local Docker Postgres instance (`supabase db reset`, full migration chain replayed from Milestone 1 forward, zero errors): `tests/rls/mission-ai-drafts.rls.test.ts`, all 12 tests pass, including a direct service-role `UPDATE` attempt that bypasses RLS entirely — proving the trigger itself, not merely RLS, is the enforcement boundary. Raw result:

```text
❯ tests/rls/mission-ai-drafts.rls.test.ts (12 tests) — all pass
```

Hand review before execution had already caught two real bugs (the `array_length`/`cardinality` empty-array gap and the CASCADE/trigger conflict). Live execution then caught a third issue, unrelated to this trigger specifically: see the telemetry grant finding below.

**Architecture placement — RESOLVED 25 Sep 2026.** The placement question this item originally left open (canonical Section 4.4 names `missions`/`tasks`, the implementation binds to `mission_ai_drafts`) was closed by Emanuel's Option B ratification: see `docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`, the Section 4.4 addendum in the design document (`docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`, dated 25 Sep 2026, purely additive, original 21 Sep text preserved unchanged), `docs/evidencia/2026-09-25-m2-c1-missions-write-map.md` (C1: exactly one write path to `public.missions` exists, entirely human-driven, zero AI/server-originated mutation), and `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` (C2: mutation proof executed on Tiago's Windows machine, GREEN → RED → RESTORE → GREEN, confirming the `mission_ai_drafts` trigger — not RLS — is what blocks the spoofing attempt). All three conditions the ratification made this item's closure conditional on (C1, C2, C3) are PASS.

### Fail-closed under timeout / malformed output / rate limit (checked)

Three dedicated tests in `inference-wrapper.test.ts`, plus the same three (plus cost ceiling and input validation) re-verified at the application layer in `generate-mission-ai-draft.test.ts`, asserting `draftWriter.write` is never called on any non-`ok` wrapper result. All pass under `npm test`.

### `inference_logs` schema (Class B conformance and clean local replay checked)

`supabase/migrations/20260922130000_create_ai_inference_logs.sql` originally implemented every structural requirement in Section 6 under the former table identifier: strict FKs (`ON DELETE RESTRICT`), immutable cost-accounting columns, both mandatory indices, declarative monthly partitioning, and (beyond the original spec) an append-only trigger. **Executed 22 Sep 2026** against local Postgres. The preserved historical output was:

```text
select table_name from information_schema.tables where table_schema='public';
-> ai_inference_logs, ai_inference_logs_2026_09, ai_inference_logs_2026_10, ...
```

The two monthly partitions materialized exactly as the original helper was designed to do (current + next calendar month), confirmed by direct SQL, not by reading the function body.

On 24 Sep 2026, `supabase/migrations/20260924124625_rename_ai_inference_logs_to_inference_logs.sql` was added as a forward-only migration because repository and linked-project metadata could not prove the original migration was confined to disposable databases. It renames the parent table, every extant monthly partition, constraints, canonical indices, partition helper, rejection function, triggers, and RLS policies while retaining rows, RLS, ACLs, `RESTRICT`, and append-only semantics. Application types, adapter, unit/RLS/E2E tests, and accounting queries now use `inference_logs`.

Docker Desktop was recovered in place to `4.92.0 (240144)`, resolving the host startup blocker. The Codex execution context still could not access Docker's named pipe, so the human operator ran `npx supabase db reset --local` twice from `C:\Users\diore\ai-showroom`; both completed successfully. The only warning was non-fatal: no files matched `supabase/seed.sql`. The final clean replay applied, in order, `20260901151420`, `20260901152700`, `20260901152756`, `20260901165904`, `20260912082700`, `20260922130000`, `20260922140000`, and `20260924124625`.

Post-reset direct local verification used only `127.0.0.1:54322`: `public.inference_logs` exists; `public.ai_inference_logs` and all `ai_inference_logs_*` partitions are absent; the canonical partitions are `inference_logs_2026_09` and `inference_logs_2026_10`; `idx_inference_logs_mission` and `idx_inference_logs_workspace_created` exist; workspace, project, and mission foreign keys are `ON DELETE RESTRICT`; `private.reject_inference_logs_mutation()` backs the UPDATE and DELETE triggers; RLS is enabled with `inference_logs_select_admin` and `inference_logs_insert_member`; `authenticated` has SELECT and INSERT only and `anon` has no table privileges; and only `private.inference_logs_ensure_partition(date)` exists. The clean `$20.00` query returned `accumulated_cost_usd_micros = 0`, `budget_usd_micros = 20000000`, and `remaining_budget_usd_micros = 20000000`.

The full local RLS suite then passed: `3` test files, `31/31` tests, exit code `0`, including `tests/rls/inference-logs.rls.test.ts` and `tests/rls/mission-ai-drafts.rls.test.ts`. The earlier transient `JWT issued at future` error occurred at `ownerClient.rpc("create_workspace_with_owner")` after temporary-user creation and sign-in. A same-window clock check observed Windows/Node/Auth/PostgREST/Postgres within approximately `0.8s`; WSL and Docker-runtime clock reads remained inaccessible to the Codex execution context. No clock-tolerance, auth-code, test, or Class-C changes were made, so that earlier transient cause remains unresolved rather than inferred. Provider-calling E2E remains intentionally unrun.

Non-database conformance verification on 24 Sep 2026: the four telemetry/schema/application unit files passed (`32/32`); `npm run typecheck` passed; `npm run lint` completed with zero errors and six pre-existing warnings in `obsidian-sync-canary-runner.test.ts`. The full unit run passed `302/304`; its two unrelated failures were both in `obsidian-sync-runner-retirement.test.ts`, where a spawned `tsx` process failed before test logic with Node `uv_os_get_passwd returned ENOMEM`. The post-reset RLS suite is recorded above. Provider-calling E2E was intentionally not run for this identifier-only change.

The canonical `$20.00` development bancada ceiling is objectively trackable from these integer rows without adding a production runtime blocker:

```sql
select
  coalesce(sum(cost_usd_micros), 0)::bigint as accumulated_cost_usd_micros,
  20000000::bigint as budget_usd_micros,
  20000000::bigint - coalesce(sum(cost_usd_micros), 0)::bigint
    as remaining_budget_usd_micros
from public.inference_logs;
```

Run this only against the isolated Milestone 2 test/bancada database. `20,000,000` micros USD equals `$20.00`; this query tracks the development ceiling but does not introduce an autonomous production blocking policy.

**A related but distinct defect, found and fixed during the 25 Sep 2026 closure cycle:** the `REVOKE`-based fix below closed the gap for `UPDATE`/`DELETE`/`TRUNCATE` at the parent-table grant level on 22 Sep, but did not reach the child partitions created by `private.inference_logs_ensure_partition()`, which received Postgres's schema-level default-privilege grant (`ALL` to `anon`/`authenticated`) instead of inheriting the parent's restricted grant — 28 unintended privilege rows across the two extant partitions, independently confirmed to include a working `TRUNCATE` bypass (RLS does not govern `TRUNCATE`, and the append-only triggers do not fire on it either). This is recorded honestly as a real write/destruction path, not reduced to harmless INFO — see `docs/evidencia/2026-09-25-block-2b-inference-logs-acl-remediation.md` for the full root cause, severity finding, and remediation (migration `20260925130000_lock_down_inference_logs_partition_acls.sql`), and the "M2 FINAL ACCEPTANCE CLOSURE" section below for Tiago's post-remediation confirmation (0 unintended rows).

**Live execution also caught a real bug hand review had missed:** `information_schema.role_table_grants` showed `authenticated`/`anon` held `UPDATE`/`DELETE`/`TRUNCATE` on the telemetry table despite the migration only issuing `grant select, insert`. This Supabase project's default privileges grant full DML to `anon`/`authenticated` on every new `public` table; a `GRANT` is additive and never revokes that pre-existing grant. The security boundary itself had not been broken — RLS with no `UPDATE`/`DELETE` policy silently matches zero rows rather than erroring, and the row was confirmed unchanged — but the intended defense-in-depth (a hard `permission denied`, not an implicit RLS no-op) was missing. Fixed with an explicit revoke (and the equivalent for `mission_ai_drafts`, which had the same gap for `DELETE`) before the `grant select, insert` line. Re-verified after the fix, via a full `supabase db reset` replay; the query below now targets the canonical name:

```text
select grantee, privilege_type from information_schema.role_table_grants
where table_name='inference_logs' and grantee in ('anon','authenticated');
-> authenticated: INSERT, SELECT only. anon: nothing.
```

### Full command suite (CHECKED 25 Sep 2026 — 6 of 6 pass, see "M2 FINAL ACCEPTANCE CLOSURE" below for the closing run)

Original 22 Sep 2026 run, preserved as historical record (5 of 6 passed at that date; `npm run build` and `npm run test:e2e` are superseded below by Tiago's 25 Sep Windows execution, which passed clean):

```text
npm test         -> 304/304 passed (31 files)
npm run typecheck -> clean
npm run lint      -> 0 errors, 0 new warnings
npm run build     -> compiles clean, /w/[workspaceSlug]/projects/[projectId]/missions/[missionId] generated as dynamic
npm run test:rls  -> 3 passed (3), 31 passed (31), exit code 0 -- against real local Docker Postgres
npm run test:e2e  -> Run 3x against a production build (npm run build && npm run start). No run
                     reproduced the Turbopack dev-server crash. All three stopped at draft
                     generation: one observed HTTP 503; two recorded latency_ms 15012 and 15015
                     before timing out. No run completed the full automated flow, and these
                     observations do not isolate provider, network, or client as the sole cause.
```

`test:rls` raw final run:

```text
> ai-showroom@0.1.0 test:rls
> node --env-file=.env.test.local ./node_modules/vitest/vitest.mjs run --config vitest.rls.config.ts

 Test Files  3 passed (3)
      Tests  31 passed (31)
   Start at  14:50:20
   Duration  1.61s

EXIT_CODE:0
```

Getting here required two live-execution fixes beyond the original hand-reviewed migrations: applying the migrations that a stale local Docker volume had silently skipped (`supabase migration up`, then a full `supabase db reset` to verify from a clean slate), and the `REVOKE` fix above. Also required pointing `.env.test.local` at the local Docker instance (`http://127.0.0.1:54321`) instead of the value it held before this session, which was the **hosted production project** (`yljvselkecxdfrqwyums`) — a real near-miss caught and stopped before any request could complete; see `docs/acceptance/d3-ti-01-local-supabase-runbook.md` for why that project must never be a test target. `.env.test.local` is gitignored; this change is local-only and was never committed.

### Supabase security advisors (CHECKED 25 Sep 2026 under Emanuel's ratified local-only advisor scope — full local Security + Performance advisor evidence)

**Run 22 Sep 2026** two ways against the local Docker instance, per explicit instruction to stay strictly local (no disposable cloud project authorized): `supabase db lint --local` (CLI), and the local Studio's actual Security Advisor / Performance Advisor pages (`http://127.0.0.1:54323/project/default/advisors/{security,performance}`), read directly from the same `run-lints` API call those pages make (`http://127.0.0.1:54323/api/platform/projects/default/run-lints`), not by eyeballing the rendered UI.

```text
supabase db lint --local
-> No schema errors found, {"results":[],"message":"db lint"}, EXIT_CODE:0
```

The Studio pages report non-zero counts the bare CLI summary doesn't surface (0 errors / 1 warning / 2 info for Security; 0 / 0 / 16 for Performance) — here is every one of the 19 findings, in full, not just the counts:

**Security (3 findings, 0 errors):**

| Level | Finding | Detail |
|---|---|---|
| INFO | `rls_enabled_no_policy` | `public.ai_inference_logs_2026_09` has RLS enabled, no policies exist |
| INFO | `rls_enabled_no_policy` | `public.ai_inference_logs_2026_10` has RLS enabled, no policies exist |
| WARN | `authenticated_security_definer_function_executable` | `public.approve_mission_ai_draft(p_draft_id uuid)` is `SECURITY DEFINER` and executable by `authenticated` via `/rest/v1/rpc/approve_mission_ai_draft` |

Both are **expected, not regressions**:
- The two `rls_enabled_no_policy` findings are historical pre-rename output for monthly telemetry *partitions*, not the parent table. Policies are defined once, on the parent (Section 4.4/6 migrations); Postgres RLS resolves policy from the table named in the query, and no client (PostgREST/Supabase-js) addresses a partition by name directly -- only `public.inference_logs`. A partition with RLS enabled and no policy of its own defaults to zero access for every non-owner role, which is fail-closed, not a hole. The advisor doesn't model parent-policy inheritance for partitions, so it flags this as informational on every partition, every month, going forward -- worth knowing, not worth fixing.
- The `SECURITY DEFINER` warning is exactly the deliberate design from the Section 4.4 anti-spoofing decision: `approve_mission_ai_draft` must be `SECURITY DEFINER`, callable by `authenticated`, specifically so it can bypass the deliberately-restrictive `mission_ai_drafts_update_member` RLS policy that blocks direct client writes to `approved_by`/`approved_at`/`applied`. The function does its own authorization inside the body (`auth.uid()` check, `is_workspace_member`, `status = 'pending_review'` check) rather than relying on the caller's RLS context, which is precisely the pattern this advisor is designed to flag for manual confirmation ("is this intentional?") -- it is. `create_workspace_with_owner` (Milestone 1) does not trigger this warning because it is `SECURITY INVOKER`, not `SECURITY DEFINER`; the two functions are architecturally different on purpose.

**Performance (16 findings, all INFO, all `unindexed_foreign_keys`):** 6 are new, introduced by this milestone's two tables; 10 pre-exist from Milestone 1 and were already known and accepted (`docs/acceptance/milestone-1.md`: "Fresh performance advisor review showed INFO-level unindexed foreign-key recommendations. No schema change is being introduced during Task 8 solely to silence performance advisories.") -- Milestone 2's contribution is the same category of finding on the same established, already-accepted basis, not a new pattern:

- Telemetry parent / September partition / October partition -- `project_id` FK, no covering index (×3; historical pre-rename advisor labels shown above)
- `mission_ai_drafts` -- `approved_by`, `created_by`, `project_id` FKs, no covering index (×3)

No error-level finding, in either category, anywhere in the schema.

**What this local pass alone is not:** the full hosted "Supabase security advisors" check in the platform sense. Milestone 1's own acceptance record shows a finding this local pass structurally cannot produce -- "Leaked Password Protection Disabled" is an Auth/GoTrue service-configuration check, not a SQL schema lint, and the `run-lints` response here contains zero entries outside the `SECURITY`/`PERFORMANCE` categories (no `AUTH` category at all). This is confirmed empirically, not just argued: the same lint engine that found real, specific findings about this milestone's own tables genuinely has no visibility into Auth-service configuration locally.

**RESOLVED 25 Sep 2026, not by closing the Auth-visibility gap itself but by Emanuel's explicit scope decision:** per `docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`, M2's acceptance scope for this criterion is local database security/advisor-equivalent linting plus a static review of repo-controlled Auth configuration (`docs/evidencia/2026-09-25-m2-auth-config-review.md`, PASS) — the hosted Platform/Auth advisor is explicitly, and not silently, deferred to the deploy milestone. No disposable cloud project was created and the hosted project `yljvselkecxdfrqwyums` was never restored, queried, or mutated to produce this closure. Under that ratified scope, and with Tiago's final local run showing 0 ERROR / 0 WARN / 2 justified INFO, this criterion is CHECKED.

### No Milestone 3+ functionality (checked)

True by construction: one provider adapter (now configured -- `gemini-3.6-flash`, verified end-to-end above), one wrapper, one draft table, human approval required to reach `applied`. No routing, no Council Mode, no autonomous agents, no cross-session model memory anywhere in `features/ai/`.

### Green List / `raioc-os` coupling absent (checked)

Re-run 22 Sep 2026 after the Gemini provider was wired in, since that added this module's first real outbound HTTP call and the earlier "zero `fetch()`" evidence needed re-checking, not just re-asserting:

```text
grep -rn "raioc-os|raioc_os" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
grep -rni "green.list|greenlist" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
grep -rn "execution_effects|public\.leads" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
-> 0 matches on all three

grep -rn "fetch(|axios|http://|https://" features/ai/
-> 2 matches, both in provider.ts, both generativelanguage.googleapis.com
   (the Gemini endpoint) -- no match anywhere against raioc-os or Green List
   domains/hosts
```

## Additional Gaps Identified (not in the original Section 5 list)

- **Canonical design provenance restored.** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` is restored exactly to `d2ee57a`. Later implementation choices and the Class C HOLD now live in `docs/evidencia/2026-09-24-m2-canonical-conformance-decisions.md`, not in the ratified historical document.
- **No component/interaction test harness.** No `@testing-library/react`, no jsdom/happy-dom, `vitest.config.mts` stays `environment: "node"`. UI logic that is pure (badge/status mapping, prompt-length validation) is unit-tested in `tests/unit/draft-presentation.test.ts`; actual render/click interaction is not.
- **~~No real browser session exercised against live data.~~ Resolved 22 Sep 2026.** A real signed-in session, on `npm run dev`, generated and approved a draft through the actual UI against the local Supabase instance and a real `gemini-3.6-flash` call -- see "Model call against a real provider" above. `npm run test:e2e` (automated Playwright) is a separate, still-open item -- this was manual, not scripted.
- **Default-privilege drift across the schema, beyond just the two new tables.** The `inference_logs`/`mission_ai_drafts` grant gap this session found and fixed (see above) is a property of this Supabase project's default privileges, not of those two migrations specifically. Whether the same implicit over-grant exists on Milestone 1's own tables was not audited as part of this pass — out of scope here since Milestone 1 is FROZEN, but worth a dedicated look before assuming its `grant select, insert, update, delete` lines are the *only* privileges those tables carry.
- **Both `.env.test.local` and `.env.local` pointed at the hosted production project before this session.** `.env.test.local` was caught and fixed before the first `test:rls` run. `.env.local` -- the file `npm run dev` actually reads -- was caught separately, immediately before the manual browser verification above, the same way: re-checked fresh, found still pointing at `yljvselkecxdfrqwyums.supabase.co`, corrected to `http://127.0.0.1:54321` before the dev server was ever started. Both files are gitignored; both were pre-existing states on this machine, not something introduced by Milestone 2. Worth checking whether other machines/checkouts have the same misconfiguration, and worth asking why the default local checkout points at production at all.
- **Real hydration bug found and fixed via E2E testing, 22 Sep 2026.** `MissionAiDraftCard`'s "Approved <timestamp>" line called `new Date(...).toLocaleString()` with no explicit locale. Node's server-side default locale (`9/22/2026, 5:52:51 PM`) rendered differently from the browser's (`22/09/2026, 5:52:51 PM`), producing a genuine SSR/client hydration mismatch caught only because a real browser loaded the real page -- no unit test could have found this. Fixed by pinning an explicit locale (`toLocaleString("en-GB")`) so server and client always agree.
- **The production-build Playwright harness did not reproduce the Turbopack dev-server crash.** Three runs using `npm run build` + `npm run start` reached draft generation after completing sign-in and workspace/project/mission creation. This supports using a production build for E2E, as recommended by the bundled Next.js Playwright guide. It does not establish a successful full automated HITL journey because all three runs stopped during generation.
- **Automated provider-call observations remain inconclusive as to exclusive cause.** The three runs observed one HTTP 503 ("This model is currently experiencing high demand") and two approximately 15-second timeouts (`inference_logs.latency_ms`: 15012 and 15015). Those records prove the response/error and measured latency seen by the wrapper; they do not alone distinguish provider availability from network or client-path causes. A separate earlier manual browser run (`8d85e0a6-...`, `latency_ms: 5027`, `status: success`) proves the manual flow completed at least once. No green automated E2E run is recorded.

## Pending Final Gate

**Superseded 25 September 2026 — see "M2 FINAL ACCEPTANCE CLOSURE" near the end of this document.** This section is preserved unchanged as the historical record of what was still outstanding as of the 22–24 Sep report dates; every item it lists below was subsequently closed by Tiago's 25 Sep Windows execution.

Local Docker/Supabase is reachable, `test:rls` has recorded passing evidence, and a real Gemini call was generated and approved during manual browser verification. The production-build Playwright harness avoids the observed dev-server crash, but an automated full-flow pass is still missing. Remaining before this milestone can be called done:

```powershell
npm run build
npm run start
npx playwright test tests/e2e/milestone-2-hitl.spec.ts
```

Still needed:

- One clean automated `test:e2e` pass against the production build. Existing evidence does not establish whether the observed 503/timeouts require only an external recovery or also a client/network correction.
- The full Supabase advisor pass (Auth/platform-level, not just schema lint — see above) against a linked project, showing no new finding introduced by either migration. Local Security + Performance advisors are now fully documented above; only the Auth-config category remains genuinely out of reach locally.
- A decision on whether to audit Milestone 1's tables for the same default-privilege gap (see above).

## 25 September 2026 Update — M2 Final Acceptance Closure Attempt

**Superseded later the same day — see "M2 FINAL ACCEPTANCE CLOSURE" immediately below this section.** This section is preserved unchanged as the real, genuine HOLD record produced earlier on 25 Sep 2026, blocked purely on this cloud session's own network-egress policy (Docker registries and, separately, Google Fonts). It is not erased because the blocker it documents was real and the record is accurate for its own timestamp. The blocker was resolved not by working around it in this session, but by handing the already-implemented, already-committed work to Tiago to execute on his own Windows machine, per the runbook this session produced (`docs/evidencia/2026-09-25-m2-runbook-tiago.md`) — see below for that execution's real results.

**Dispatch:** close M2 acceptance from 9/12 + 1 conditional to 12/12, via Emanuel's Option B ratification (C1-C3), local advisor/Auth review, and deterministic E2E, in that mandatory order. **Result: HOLD, not 12/12.** Real progress was made and is recorded with full evidence below; the remainder is blocked by an environment limitation, not a schema, security, or architecture problem, and not silently claimed as passing.

**Decision record:** `docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`. Emanuel ratified Option B (`public.mission_ai_drafts` as the M2 DB-level HITL boundary) as Class C, conditional on C1-C3, and approved the local-only advisor scope (hosted Platform/Auth advisor deferred to deploy milestone; hosted project `yljvselkecxdfrqwyums` stays paused/inactive throughout).

| Item | Result | Evidence |
|---|---|---|
| C1 — write-path map to `public.missions` | **PASS** | `docs/evidencia/2026-09-25-m2-c1-missions-write-map.md`. Exactly one write path exists (human-driven Mission creation); zero writes from the AI generation/review/approval flow. |
| C2 — security boundary test + mutation proof | **HOLD** | `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`. Test plan and real credential boundary identified from C1; not executed — see blocker below. |
| C3 — canonical Section 4.4 amendment | **PASS** | `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` (dated addendum immediately after Section 4.4, purely additive — 20 insertions, 0 deletions, verified by diff). Original 21 Sep 2026 text and provenance preserved unchanged. |
| Block 2A — clean local replay | **HOLD** | `docs/evidencia/2026-09-25-m2-local-security-advisor.md`. |
| Block 2B — local security advisor lint | **HOLD** | Same file as above. |
| Block 2C — static Auth config review | **PASS** | `docs/evidencia/2026-09-25-m2-auth-config-review.md`. Every repo-controlled `supabase/config.toml` Auth setting reviewed; no M2 regression; hosted-only items explicitly `DEFERRED TO DEPLOY MILESTONE`. |
| Block 3 — deterministic E2E (E1-E4) | **HOLD, not attempted** | Same blocker as C2/Block 2A-2B: requires the running local stack. Not started, to avoid burning effort against an environment that cannot yet produce a real result. |

**The blocker (identical root cause for C2, Block 2A, Block 2B, and Block 3):** this session's Docker daemon is fully functional (`dockerd` started and verified operational), but bringing up the local Supabase stack (`npx supabase start`, and therefore `db reset --local`, `db lint --local`, the Studio advisor pages, `npm run test:rls` against a live instance, and Playwright E2E) requires pulling `supabase/postgres`, `supabase/gotrue`, `postgrest/postgrest`, `supabase/kong`, `supabase/studio`, and several more images from `docker.io` and `ghcr.io`. Both registries return HTTP 403 at this session's outbound egress proxy — a policy denial (confirmed against the proxy's own status/diagnostic endpoint), not a transient failure, and neither registry is in this session's outbound allowlist. No workaround was attempted: no egress bypass, no hand-built Postgres+RLS substitute standing in for GoTrue/PostgREST (which would itself be exactly the kind of synthetic, never-used-by-production boundary the dispatch explicitly forbids for C2), and the hosted project was not used as a substitute at any point. Full raw proxy output and the three options to close this are in `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`.

**Acceptance count as of this update: unchanged at 9/12 + 1 conditional.** The Block 1 exit gate (C1 + C2 + C2-mutation-proof + C3 all PASS) and the Block 2 exit gate (clean local replay + local security review + no unjustified ERROR/WARN + Auth review, all together) were not reached, because C2 and Block 2A/2B are HOLD. Per the dispatch's own rule — "Missing evidence = HOLD. Not PASS." — this document does not advance to 10/12, 11/12, or 12/12 on partial evidence. C1, C3, and Block 2C stand as genuine, committed, evidence-backed progress regardless of the blocker's resolution.

## 25 September 2026 — M2 FINAL ACCEPTANCE CLOSURE

**This section supersedes the "25 September 2026 Update — M2 Final Acceptance Closure Attempt" section above and every other HOLD status recorded elsewhere in this document.** Those earlier records are preserved unchanged; this section is the later, dated, closing update per the reconciliation discipline this dispatch required.

**HEAD at closure (pre-documentation-commit):** `345b18c57963f7f996c0d8650fa3922003b49949`.

**What closed the remaining items:** this cloud session's own environment cannot reach `docker.io`/`ghcr.io` (blocks the local Supabase stack) or `fonts.googleapis.com` (blocks `npm run build`) — both a policy denial in this container, not a defect in M2's code, as the earlier HOLD sections above document in full. Everything the earlier HOLD records needed was already implemented, committed, typechecked, and linted on this branch; the runbook (`docs/evidencia/2026-09-25-m2-runbook-tiago.md`) handed the execution step to Tiago, on his own isolated Windows clone (`C:\Users\diore\ai-showroom-m2-verify`, branch `feature/milestone-2-single-model`, HEAD `345b18c57963f7f996c0d8650fa3922003b49949` — matching this branch's HEAD exactly), where neither blocker applies.

**Tiago's results, folded into the items below:**

| Item | Result | Detail |
|---|---|---|
| RLS suite | **31/31 PASS** | `inference-logs.rls.test.ts` 12, `milestone-1.rls.test.ts` 7, `mission-ai-drafts.rls.test.ts` 12. Known `inference_logs` cleanup residue (RESTRICT + append-only) noted, not a failure. |
| `supabase db lint --local` | **PASS** | "No schema errors found." |
| Local security advisor | **0 ERROR / 0 WARN / 2 INFO** | Both INFO are `rls_enabled_no_policy` on `inference_logs_2026_09`/`_10` — expected and already justified (policies live on the parent; partitions correctly default to zero direct access). |
| Block 2B ACL remediation | **CONFIRMED** | Pre-remediation: Tiago directly proved 28 unintended `anon`/`authenticated` privilege rows on the two child partitions. This session independently reproduced it and additionally proved a working `TRUNCATE` bypass (RLS does not govern `TRUNCATE`; the append-only triggers don't fire on it either) — recorded honestly as a real write/destruction path, not downgraded to harmless INFO. Remediated by migration `20260925130000_lock_down_inference_logs_partition_acls.sql` (commit `97dfa09b451bd79b8829de3079acf24da409a735`). Post-remediation, Tiago queried `information_schema.role_table_grants` for `anon`/`authenticated` on the child partitions directly: **0 rows.** The direct child-partition ACL/TRUNCATE path is closed. |
| C2 / Block 3 mutation proof, deterministic E2E | **5/5 PASS** | `npm.cmd run test:e2e -- tests/e2e/milestone-2-hitl-deterministic.spec.ts tests/e2e/milestone-2-security-boundary.spec.ts` — E1 (full generate→approve→verify cycle), E2 (no shortcuts), E3 (tenant isolation), E4 (direct `missions` mutation refused), E4 mutation proof (GREEN → RED → RESTORE → GREEN, via the two harness fixes below). |
| E2E harness fixes that made the above possible | **Both confirmed working end to end** | (1) `npx.cmd` EINVAL on Windows, fixed in `tests/e2e/milestone-2-security-boundary.spec.ts` (commit `90c0115b7dc6d9a2db39a87df0636fb51583f060`). (2) Multi-statement restore SQL rejected under the Postgres extended query protocol ("cannot insert multiple commands into a prepared statement"), fixed via a single `DO $$ ... $$` block in `scripts/c2-mutation-proof/restore-mission-ai-drafts-hitl-gate.sql`, plus a `runId`-unique E1 Mission title to remove a second, unrelated nondeterminism source (commit `345b18c57963f7f996c0d8650fa3922003b49949`, this branch's HEAD). |
| Production build | **PASS** | `npm.cmd run build` — Next.js 16.3.3/Turbopack, compiled successfully, 6/6 static pages generated, all M2 routes emitted (`/app`, `/sign-in`, `/w/[workspaceSlug]`, `/w/[workspaceSlug]/projects/[projectId]`, `.../missions/[missionId]`). |
| Production-server E2E | **5/5 PASS (second, independent run)** | Same two spec files rerun with Playwright reusing a live `next start` process on the freshly built artifact — the closest this suite gets to a real deployed-runtime check without an actual deploy. |
| Command-gate suite (previously established on this HEAD) | typecheck PASS, lint 0 errors / 6 pre-existing unrelated warnings, unit 308/308 PASS | Unchanged from the pre-closure record; re-stated here for completeness of the six-command criterion. |

**Reconciliation performed independently, not accepted on the dispatch's assertion alone:** C1 (`docs/evidencia/2026-09-25-m2-c1-missions-write-map.md`) was re-read in full and is a genuine, exhaustive, evidence-based write-path map — PASS stands on its own. C3 (the Section 4.4 addendum in `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`) was independently confirmed by direct file inspection: the addendum exists, is dated and attributed, is purely additive, and the original 21 Sep 2026 text and provenance are preserved unchanged above it — PASS stands on its own. C2 rests on Tiago's Windows execution report rather than this session's own re-execution (this session's Docker/network blockers are unchanged); it is accepted as closing evidence because it is specific, matches every quantity this session's own HOLD-era records predicted in advance (advisor INFO count and content, RLS count, the exact two harness defects this session fixed), and is exactly the handoff the runbook this session wrote was designed to produce. No contradiction between the dispatch's claimed evidence and this document's own prior independently-derived findings was found anywhere in this reconciliation.

**Hosted Supabase project `yljvselkecxdfrqwyums`:** remained paused/inactive throughout. Not restored, queried, or mutated at any point in this closure, in Tiago's execution, or in this documentation pass.

**Acceptance count: 12 of 12.** See the Acceptance Matrix near the top of this document, now fully checked, and the per-item evidence updates inline above.

**Branch state: FROZEN for M2 acceptance.** This freeze covers acceptance only. Merge into any other branch, deploy to any environment, and any Milestone 3 activation remain separate, unauthorized-by-this-record future gates — none of them were performed as part of this closure.

## Milestone Boundary

STOP after this milestone's release gate passes in full, per Section 8 of the design document.

Do not begin multi-model routing, Council Mode, memory-engine work, agent functionality, or any Green List / `raioc-os` integration under this milestone or as a side effect of closing it.

# V1 Milestone 2 - Acceptance Checklist

**Milestone:** Single-Model AI
**Release state:** Candidate - real end-to-end HITL cycle verified with a live Gemini call against local Postgres; `test:e2e` and the full Supabase advisor pass still open
**Report date:** 22 September 2026 (updated same day after a real browser Generate -> Approve run)
**Design document:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`

Only mark an item complete when supported by manual, automated, database, or advisor evidence, per the same discipline `docs/acceptance/milestone-1.md` already established. Ten of the twelve Section 5 criteria have that evidence today; two do not yet, and are left unchecked rather than asserted.

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
- [x] The Postgres `BEFORE UPDATE` trigger (Section 4.4, realized on `mission_ai_drafts` per the Option B decision) is implemented and provably blocks a direct-SQL attempt to reach `applied` without a valid `approved_by`/`approved_at`. **Executed 22 Sep 2026: 31/31 RLS tests pass against real local Postgres, including the service-role bypass-attempt proof.**
- [x] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [x] `ai_inference_logs` schema matches Section 6 exactly: foreign keys, indices, `cost_usd_micros` as bigint, monthly partitioning by `created_at`. **Executed 22 Sep 2026: applied via `supabase db reset` against real Postgres; partitions `ai_inference_logs_2026_09`/`ai_inference_logs_2026_10` materialized and confirmed via direct SQL.**
- [ ] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass. **`test:rls` now passes (see below); `test:e2e` still not run.**
- [ ] Supabase security advisors show no new finding introduced by this milestone. **`supabase db lint --local` is clean (see below) — genuine schema-level evidence, but not the full advisor check (Auth/platform-level findings, e.g. Milestone 1's "Leaked Password Protection Disabled", aren't covered by a local schema lint). Left unchecked until the actual advisor pass runs.**
- [x] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [x] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

**10 of 12 checked, with evidence recorded below for each. 2 unchecked, also with the reason recorded below — not silently pending.**

## Evidence Recorded

### Zod contract strictness (checked)

`features/ai/schemas.ts` (`84e605d`). `tests/unit/ai-schemas.test.ts`: 17 automated tests, including explicit `unrecognized_keys` assertions proving `.strict()` rejects extra fields on both schemas. Re-run 22 Sep 2026 as part of the full suite (see below): pass.

### InferenceExecutionWrapper (checked)

`features/ai/inference-wrapper.ts` (`5b1750d`). `tests/unit/inference-wrapper.test.ts`: 7 automated tests covering the happy path, input validation rejection, cost-ceiling abort (both the negative and the positive "within ceiling" case), and the three fail-closed scenarios below. All usage/telemetry fields are sourced from `providerResult.usage`, never from parsed model text.

### `MODEL_SCHEMA_VIOLATION` / HTTP 422 (checked)

Covered by the "fails closed on a malformed model output" test in `inference-wrapper.test.ts`, and again at the application layer in `tests/unit/generate-mission-ai-draft.test.ts`. Both assert `failure.code === "MODEL_SCHEMA_VIOLATION"` and `failure.httpStatus === 422`.

### Model call against a real provider (checked)

`features/ai/provider.ts` wires `gemini-3.6-flash` via native `fetch()` (no new SDK dependency), with a `costEstimator` calibrated to its real per-token pricing feeding the $0.02 hard ceiling. **Executed 22 Sep 2026**, end-to-end, through the real browser UI, against the local Supabase instance (`http://127.0.0.1:54321`, never production) — not a script, not a mock: signed in as a real test user, submitted a real prompt through `GenerateDraftForm`, and approved the resulting draft through `MissionAiDraftCard`'s Approve button, which calls the `approve_mission_ai_draft` RPC.

**`ai_inference_logs` row for this exact call:**

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

Both rows queried directly from `public.ai_inference_logs` / `public.mission_ai_drafts` via `docker exec supabase_db_ai-showroom psql`, not through the application layer, so this is independent of any bug the app itself might have in how it reports its own success.

A second row in `ai_inference_logs` from the same test session (`12da0217-...`, `status: failed`, `failure_reason: PROVIDER_ERROR`, no cost/tokens/model recorded) shows the fail-closed path also held during real usage, not only in mocks -- a call that didn't complete left an honest failure record, not a fabricated success.

### Zero write path to `raioc-os` (checked)

Run 22 Sep 2026:

```text
grep -rn "raioc-os\|raioc_os" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
-> 0 matches
```

### Postgres HITL trigger on `mission_ai_drafts` (checked)

`supabase/migrations/20260922140000_create_mission_ai_drafts.sql` implements `private.enforce_mission_ai_draft_hitl_gate()`. **Executed 22 Sep 2026** against a local Docker Postgres instance (`supabase db reset`, full migration chain replayed from Milestone 1 forward, zero errors): `tests/rls/mission-ai-drafts.rls.test.ts`, all 12 tests pass, including a direct service-role `UPDATE` attempt that bypasses RLS entirely — proving the trigger itself, not merely RLS, is the enforcement boundary. Raw result:

```text
❯ tests/rls/mission-ai-drafts.rls.test.ts (12 tests) — all pass
```

Hand review before execution had already caught two real bugs (the `array_length`/`cardinality` empty-array gap and the CASCADE/trigger conflict — see the design document's Section 6 implementation note), and live execution then caught a third, unrelated to this trigger specifically: see the `ai_inference_logs` grant finding below.

### Fail-closed under timeout / malformed output / rate limit (checked)

Three dedicated tests in `inference-wrapper.test.ts`, plus the same three (plus cost ceiling and input validation) re-verified at the application layer in `generate-mission-ai-draft.test.ts`, asserting `draftWriter.write` is never called on any non-`ok` wrapper result. All pass under `npm test`.

### `ai_inference_logs` schema (checked)

`supabase/migrations/20260922130000_create_ai_inference_logs.sql` implements every structural requirement in Section 6: strict FKs (`ON DELETE RESTRICT`), the immutable cost-accounting columns, both mandatory indices, declarative monthly partitioning, and (beyond the original spec) an append-only trigger. **Executed 22 Sep 2026** against local Postgres:

```text
select table_name from information_schema.tables where table_schema='public';
-> ai_inference_logs, ai_inference_logs_2026_09, ai_inference_logs_2026_10, ...
```

The two monthly partitions materialized exactly as `private.ai_inference_logs_ensure_partition()` was designed to do (current + next calendar month), confirmed by direct SQL, not by reading the function body.

**Live execution also caught a real bug hand review had missed:** `information_schema.role_table_grants` showed `authenticated`/`anon` held `UPDATE`/`DELETE`/`TRUNCATE` on `ai_inference_logs` despite the migration only issuing `grant select, insert`. This Supabase project's default privileges grant full DML to `anon`/`authenticated` on every new `public` table; a `GRANT` is additive and never revokes that pre-existing grant. The security boundary itself had not been broken — RLS with no `UPDATE`/`DELETE` policy silently matches zero rows rather than erroring, and the row was confirmed unchanged — but the intended defense-in-depth (a hard `permission denied`, not an implicit RLS no-op) was missing. Fixed with an explicit `revoke all on public.ai_inference_logs from anon, authenticated;` (and the equivalent for `mission_ai_drafts`, which had the same gap for `DELETE`) before the `grant select, insert` line. Re-verified after the fix, via a full `supabase db reset` replay:

```text
select grantee, privilege_type from information_schema.role_table_grants
where table_name='ai_inference_logs' and grantee in ('anon','authenticated');
-> authenticated: INSERT, SELECT only. anon: nothing.
```

### Full command suite (partial — 5 of 6 pass)

Run 22 Sep 2026:

```text
npm test         -> 304/304 passed (31 files)
npm run typecheck -> clean
npm run lint      -> 0 errors, 0 new warnings
npm run build     -> compiles clean, /w/[workspaceSlug]/projects/[projectId]/missions/[missionId] generated as dynamic
npm run test:rls  -> 3 passed (3), 31 passed (31), exit code 0 -- against real local Docker Postgres
npm run test:e2e  -> NOT RUN (no automated Playwright coverage written yet for this flow; the flow itself has now been verified manually -- see "Model call against a real provider" above)
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

### Supabase security advisors (unchecked, partial schema-lint evidence)

**Run 22 Sep 2026** against the local Docker instance:

```text
supabase db lint --local

Connecting to local database...
Linting schema: extensions
Linting schema: private
Linting schema: public

No schema errors found
{"results":[],"message":"db lint"}
EXIT_CODE:0
```

Zero warnings or errors across `extensions`, `private`, and `public` — the latter two covering every object this milestone introduced: `ai_inference_logs`, `mission_ai_drafts`, both HITL/append-only trigger functions, the `approve_mission_ai_draft` RPC, and the partition-provisioning helper.

This is real, genuine evidence, but it is **not** the same thing Section 5 asks for. `supabase db lint` is a static SQL/schema linter (missing indexes, RLS-enabled-without-policy, `SECURITY DEFINER` search-path issues, and similar). The "Supabase security advisors" this criterion names are a broader check — surfaced via the Studio/dashboard or a linked project — that also covers Auth and platform-level configuration (Milestone 1's own acceptance record shows an example: "Leaked Password Protection Disabled", an Auth setting no schema linter would ever catch). No project is linked in this environment to run that broader advisor pass, so this criterion stays unchecked rather than being marked done on partial evidence.

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

- **`docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` decision sync.** Addressed by an earlier documentation pass: the $0.02 cost ceiling, the `mission_ai_drafts` Option B decision, and the `ai_inference_logs` naming/`RESTRICT` decision are recorded inline in the design document with ratification notes.
- **No component/interaction test harness.** No `@testing-library/react`, no jsdom/happy-dom, `vitest.config.mts` stays `environment: "node"`. UI logic that is pure (badge/status mapping, prompt-length validation) is unit-tested in `tests/unit/draft-presentation.test.ts`; actual render/click interaction is not.
- **~~No real browser session exercised against live data.~~ Resolved 22 Sep 2026.** A real signed-in session, on `npm run dev`, generated and approved a draft through the actual UI against the local Supabase instance and a real `gemini-3.6-flash` call -- see "Model call against a real provider" above. `npm run test:e2e` (automated Playwright) is a separate, still-open item -- this was manual, not scripted.
- **Default-privilege drift across the schema, beyond just the two new tables.** The `ai_inference_logs`/`mission_ai_drafts` grant gap this session found and fixed (see above) is a property of this Supabase project's default privileges, not of those two migrations specifically. Whether the same implicit over-grant exists on Milestone 1's own tables was not audited as part of this pass — out of scope here since Milestone 1 is FROZEN, but worth a dedicated look before assuming its `grant select, insert, update, delete` lines are the *only* privileges those tables carry.
- **Both `.env.test.local` and `.env.local` pointed at the hosted production project before this session.** `.env.test.local` was caught and fixed before the first `test:rls` run. `.env.local` -- the file `npm run dev` actually reads -- was caught separately, immediately before the manual browser verification above, the same way: re-checked fresh, found still pointing at `yljvselkecxdfrqwyums.supabase.co`, corrected to `http://127.0.0.1:54321` before the dev server was ever started. Both files are gitignored; both were pre-existing states on this machine, not something introduced by Milestone 2. Worth checking whether other machines/checkouts have the same misconfiguration, and worth asking why the default local checkout points at production at all.

## Pending Final Gate

Local Docker/Supabase is now reachable, `test:rls` passes for real, and a real Gemini call has been generated and approved through the actual browser UI (see above). Remaining before this milestone can be called done:

```powershell
npm.cmd run test:e2e
```

Still needed:

- The full Supabase advisor pass (Auth/platform-level, not just schema lint — see above) against a linked project, showing no new finding introduced by either migration.
- Automated `npm run test:e2e` coverage of the Generate -> Approve/Dismiss flow (the manual pass above proves it works; it does not replace a repeatable automated test).
- A decision on whether to audit Milestone 1's tables for the same default-privilege gap (see above).

## Milestone Boundary

STOP after this milestone's release gate passes in full, per Section 8 of the design document.

Do not begin multi-model routing, Council Mode, memory-engine work, agent functionality, or any Green List / `raioc-os` integration under this milestone or as a side effect of closing it.

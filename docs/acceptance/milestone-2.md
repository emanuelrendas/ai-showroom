# V1 Milestone 2 - Acceptance Checklist

**Milestone:** Single-Model AI
**Release state:** Candidate - core database evidence obtained against local Postgres; real model provider and Supabase advisors still open
**Report date:** 22 September 2026 (updated same day after live `test:rls` execution)
**Design document:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`

Only mark an item complete when supported by manual, automated, database, or advisor evidence, per the same discipline `docs/acceptance/milestone-1.md` already established. Nine of the twelve Section 5 criteria have that evidence today; three do not yet, and are left unchecked rather than asserted.

## Implementation Commits

| SHA | Commit |
|---|---|
| `84e605d0609bb7d0736f73d4ccc499a5b72d38d6` | feat(ai): implement Section 3.3.1 strict input and output Zod schemas |
| `5b1750dd903bcd8acb651dbe5bd85b3086f3be9e` | feat(ai): implement Section 3.3.2 InferenceExecutionWrapper with cost ceiling and fail-closed handling |
| `87d043d3dbfd7f8c832e6b7a6432f7e0218c6d88` | feat(ai): implement ai_inference_logs schema, append-only trigger, and Supabase adapter |
| `f8773fbb822c25b4ce63997aad7c67a83267cf2b` | feat(ai): implement mission_ai_drafts schema, HITL trigger, and approval RPC |
| `724e91b0c6582cf1446d89eb6513ed2b6f629824` | feat(ai): implement draft application layer, pure generation core, server actions, and provider stub |
| `16973505b0f71da19e8bc88347f5d925a5b3f27a` | feat(ai): implement HITL review UI, MissionAiDraftsPanel, and mission page integration |

## Acceptance Matrix (Section 5 of the design document, in order)

- [x] `SingleModelInputSchema` and `SingleModelOutputSchema` implemented with `.strict()`, matching Section 3.3.1 exactly.
- [x] `InferenceExecutionWrapper` implemented per Section 3.3.2, telemetry never sourced from model-reported text.
- [x] A test proves `safeParse()` rejects a malformed model response with `MODEL_SCHEMA_VIOLATION` and HTTP 422, no silent coercion path exists.
- [ ] Model call functional against a dedicated test or bancada Supabase project, never against production during development.
- [x] Zero write path exists from this feature to any `raioc-os` table, verified by code search, not by claim.
- [x] The Postgres `BEFORE UPDATE` trigger (Section 4.4, realized on `mission_ai_drafts` per the Option B decision) is implemented and provably blocks a direct-SQL attempt to reach `applied` without a valid `approved_by`/`approved_at`. **Executed 22 Sep 2026: 31/31 RLS tests pass against real local Postgres, including the service-role bypass-attempt proof.**
- [x] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [x] `ai_inference_logs` schema matches Section 6 exactly: foreign keys, indices, `cost_usd_micros` as bigint, monthly partitioning by `created_at`. **Executed 22 Sep 2026: applied via `supabase db reset` against real Postgres; partitions `ai_inference_logs_2026_09`/`ai_inference_logs_2026_10` materialized and confirmed via direct SQL.**
- [ ] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass. **`test:rls` now passes (see below); `test:e2e` still not run.**
- [ ] Supabase security advisors show no new finding introduced by this milestone.
- [x] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [x] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

**9 of 12 checked, with evidence recorded below for each. 3 unchecked, also with the reason recorded below — not silently pending.**

## Evidence Recorded

### Zod contract strictness (checked)

`features/ai/schemas.ts` (`84e605d`). `tests/unit/ai-schemas.test.ts`: 17 automated tests, including explicit `unrecognized_keys` assertions proving `.strict()` rejects extra fields on both schemas. Re-run 22 Sep 2026 as part of the full suite (see below): pass.

### InferenceExecutionWrapper (checked)

`features/ai/inference-wrapper.ts` (`5b1750d`). `tests/unit/inference-wrapper.test.ts`: 7 automated tests covering the happy path, input validation rejection, cost-ceiling abort (both the negative and the positive "within ceiling" case), and the three fail-closed scenarios below. All usage/telemetry fields are sourced from `providerResult.usage`, never from parsed model text.

### `MODEL_SCHEMA_VIOLATION` / HTTP 422 (checked)

Covered by the "fails closed on a malformed model output" test in `inference-wrapper.test.ts`, and again at the application layer in `tests/unit/generate-mission-ai-draft.test.ts`. Both assert `failure.code === "MODEL_SCHEMA_VIOLATION"` and `failure.httpStatus === 422`.

### Model call against a real provider (unchecked)

`features/ai/provider.ts` is an explicit, undisguised stub: `getModelProviderAdapter().invoke()` always rejects with `MODEL_PROVIDER_NOT_CONFIGURED`. No model provider has been selected or wired up. This is the largest open functional item in the milestone — nothing generates a real draft yet.

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
npm run test:e2e  -> NOT RUN (the HITL flow has never been clicked through in a real browser against real data; also blocked on the provider stub -- see below)
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

### Supabase security advisors (unchecked)

No Supabase project was linked/reachable in this environment. No advisor report has been pulled.

### No Milestone 3+ functionality (checked)

True by construction: one provider adapter interface (unconfigured), one wrapper, one draft table, human approval required to reach `applied`. No routing, no Council Mode, no autonomous agents, no cross-session model memory anywhere in `features/ai/`.

### Green List / `raioc-os` coupling absent (checked)

Run 22 Sep 2026, in addition to the `raioc-os` search above:

```text
grep -rni "green.list|greenlist" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
grep -rn "execution_effects|public\.leads" --include="*.ts" --include="*.tsx" --include="*.sql" features/ supabase/ app/ lib/
grep -rn "fetch(|axios|http://|https://" features/ai/
-> 0 matches on all three
```

## Additional Gaps Identified (not in the original Section 5 list)

- **`docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` decision sync.** Addressed by an earlier documentation pass: the $0.02 cost ceiling, the `mission_ai_drafts` Option B decision, and the `ai_inference_logs` naming/`RESTRICT` decision are recorded inline in the design document with ratification notes.
- **No component/interaction test harness.** No `@testing-library/react`, no jsdom/happy-dom, `vitest.config.mts` stays `environment: "node"`. UI logic that is pure (badge/status mapping, prompt-length validation) is unit-tested in `tests/unit/draft-presentation.test.ts`; actual render/click interaction is not.
- **No real browser session exercised against live data.** Every manual verification in this milestone stopped at `npm run build` (compiles, correct Server/Client boundaries) — nobody has clicked "Generate AI draft" against a running app. Blocked on the provider stub as much as on browser testing itself.
- **Default-privilege drift across the schema, beyond just the two new tables.** The `ai_inference_logs`/`mission_ai_drafts` grant gap this session found and fixed (see above) is a property of this Supabase project's default privileges, not of those two migrations specifically. Whether the same implicit over-grant exists on Milestone 1's own tables was not audited as part of this pass — out of scope here since Milestone 1 is FROZEN, but worth a dedicated look before assuming its `grant select, insert, update, delete` lines are the *only* privileges those tables carry.
- **`.env.test.local` pointed at the hosted production project before this session.** Corrected locally (now targets `http://127.0.0.1:54321`), but the file is gitignored and this was a pre-existing state on this machine, not something introduced by Milestone 2. Worth checking whether other machines/checkouts have the same misconfiguration.

## Pending Final Gate

Local Docker/Supabase is now reachable and `test:rls` passes for real (see above). Remaining before this milestone can be called done:

```powershell
npm.cmd run test:e2e
```

Still needed:

- A Supabase advisor pass against the local instance (or a dedicated bancada project) showing no new finding introduced by either migration.
- A real (even if placeholder-cost) `ModelProviderAdapter` decision, so `npm run test:e2e` can exercise the actual Generate -> Approve/Dismiss flow instead of stopping at `MODEL_PROVIDER_NOT_CONFIGURED`.
- A decision on whether to audit Milestone 1's tables for the same default-privilege gap (see above).

## Milestone Boundary

STOP after this milestone's release gate passes in full, per Section 8 of the design document.

Do not begin multi-model routing, Council Mode, memory-engine work, agent functionality, or any Green List / `raioc-os` integration under this milestone or as a side effect of closing it.

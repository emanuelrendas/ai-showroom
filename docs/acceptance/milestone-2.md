# V1 Milestone 2 - Acceptance Checklist

**Milestone:** Single-Model AI
**Release state:** Candidate - database evidence pending (local Docker/Supabase unavailable during implementation)
**Report date:** 22 September 2026
**Design document:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`

Only mark an item complete when supported by manual, automated, database, or advisor evidence, per the same discipline `docs/acceptance/milestone-1.md` already established. Six of the twelve Section 5 criteria have that evidence today; six do not yet, and are left unchecked rather than asserted.

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
- [ ] The Postgres `BEFORE UPDATE` trigger (Section 4.4, realized on `mission_ai_drafts` per the Option B decision) is implemented and provably blocks a direct-SQL attempt to reach `applied` without a valid `approved_by`/`approved_at`.
- [x] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [ ] `ai_inference_logs` schema matches Section 6 exactly: foreign keys, indices, `cost_usd_micros` as bigint, monthly partitioning by `created_at`.
- [ ] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- [ ] Supabase security advisors show no new finding introduced by this milestone.
- [x] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [x] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

**6 of 12 checked, with evidence recorded below for each. 6 unchecked, also with the reason recorded below — not silently pending.**

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

### Postgres HITL trigger on `mission_ai_drafts` (unchecked)

`supabase/migrations/20260922140000_create_mission_ai_drafts.sql` implements `private.enforce_mission_ai_draft_hitl_gate()` and `tests/rls/mission-ai-drafts.rls.test.ts` (13 tests) is written specifically to prove it, including a direct service-role `UPDATE` attempt that bypasses RLS entirely — proving the trigger, not merely RLS, is the enforcement boundary. **None of this has executed against a live Postgres instance.** `supabase status` fails to reach Docker in this environment (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`). The migration and test are reviewed carefully by hand (two real bugs were caught and fixed this way — see the design document's Section 6 implementation note for the `array_length`/`cardinality` and CASCADE/trigger conflicts), but hand review is not database evidence.

### Fail-closed under timeout / malformed output / rate limit (checked)

Three dedicated tests in `inference-wrapper.test.ts`, plus the same three (plus cost ceiling and input validation) re-verified at the application layer in `generate-mission-ai-draft.test.ts`, asserting `draftWriter.write` is never called on any non-`ok` wrapper result. All pass under `npm test`.

### `ai_inference_logs` schema (unchecked)

`supabase/migrations/20260922130000_create_ai_inference_logs.sql` implements every structural requirement in Section 6: strict FKs (`ON DELETE RESTRICT`), the immutable cost-accounting columns, both mandatory indices, declarative monthly partitioning, and (beyond the original spec) an append-only trigger. Same caveat as above: **never executed against a live Postgres instance.**

### Full command suite (unchecked, partial)

Run 22 Sep 2026:

```text
npm test         -> 304/304 passed (31 files)
npm run typecheck -> clean
npm run lint      -> 0 errors, 0 new warnings
npm run build     -> compiles clean, /w/[workspaceSlug]/projects/[projectId]/missions/[missionId] generated as dynamic
npm run test:rls  -> NOT RUN (Docker unreachable)
npm run test:e2e  -> NOT RUN (same reason; the HITL flow has never been clicked through in a real browser against real data)
```

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

- **`docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` decision sync.** Addressed by this same documentation pass: the $0.02 cost ceiling, the `mission_ai_drafts` Option B decision, and the `ai_inference_logs` naming/`RESTRICT` decision are now recorded inline in the design document with ratification notes, rather than living only in chat history.
- **No component/interaction test harness.** No `@testing-library/react`, no jsdom/happy-dom, `vitest.config.mts` stays `environment: "node"`. UI logic that is pure (badge/status mapping, prompt-length validation) is unit-tested in `tests/unit/draft-presentation.test.ts`; actual render/click interaction is not.
- **No real browser session exercised against live data.** Every manual verification in this milestone stopped at `npm run build` (compiles, correct Server/Client boundaries) — nobody has clicked "Generate AI draft" against a running app.

## Pending Final Gate

Blocked on local Docker/Supabase availability. Once reachable:

```powershell
supabase status
npm.cmd run test:rls
npm.cmd run test:e2e
```

Expected, once run for real:

- `mission_ai_drafts` and `ai_inference_logs` migrations apply cleanly to a fresh local project.
- `tests/rls/ai-inference-logs.rls.test.ts` and `tests/rls/mission-ai-drafts.rls.test.ts` pass against real Postgres, including the service-role bypass-attempt assertions.
- A Supabase advisor pass shows no new finding introduced by either migration.
- A real (even if placeholder-cost) `ModelProviderAdapter` decision is made, so `npm run test:e2e` can exercise the actual Generate -> Approve/Dismiss flow instead of stopping at `MODEL_PROVIDER_NOT_CONFIGURED`.

## Milestone Boundary

STOP after this milestone's release gate passes in full, per Section 8 of the design document.

Do not begin multi-model routing, Council Mode, memory-engine work, agent functionality, or any Green List / `raioc-os` integration under this milestone or as a side effect of closing it.

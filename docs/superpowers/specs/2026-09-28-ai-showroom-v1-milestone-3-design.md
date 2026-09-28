# AI SHOWROOM — V1 MILESTONE 3 DESIGN / SCOPE

**Milestone:** M3 — Model Router & Product Experience Foundation  
**Project:** AI Showroom  
**Repository:** `emanuelrendas/ai-showroom`  
**Status:** DRAFT — FOR TIAGO REVIEW — NOT ACTIVATED  
**Date:** 28 September 2026  
**Owner / delegated authority:** Tiago Rendas  
**Final Authority:** Emanuel Rendas  
**Integration baseline:** `feature/milestone-1-foundation` @ `008deeea2908ad93974cc18982ff929686b98c6d`  
**Writer:** NONE during M3-000 analysis  
**Planning target:** 14 October 2026  
**Production:** OUT OF SCOPE  
**Hosted AI Showroom Supabase:** remains inactive  
**DEPLOY HOLD:** unchanged  
**CANARY:** unchanged

---

## 1. Evidence Baseline

Read-only verification on 28 September 2026 established:

- `feature/milestone-1-foundation` HEAD is exactly `008deeea2908ad93974cc18982ff929686b98c6d`.
- Comparing M2 merge commit `008deeea...` with the current integration branch returns `identical`, `ahead_by = 0`, `behind_by = 0`.
- Therefore no repository drift exists between the M3 planning baseline and the live integration branch.
- `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md` remains the canonical M2 architecture record.
- `docs/acceptance/milestone-2.md` records all 12 M2 acceptance criteria closed.
- M2 is merged and establishes the controlled path:

`Mission → Single Model → Structured Draft → Human Review → Approve / Dismiss`

Current implementation evidence includes:

- one real provider/model path: `gemini-3.6-flash`;
- deterministic test-only provider support;
- `InferenceExecutionWrapper`;
- strict structured-output validation;
- `$0.02 / 20,000 usd_micros` per-inference ceiling;
- `inference_logs`;
- `mission_ai_drafts`;
- database-level HITL enforcement;
- explicit Approve / Dismiss UI;
- existing RLS and Playwright coverage.

M2 explicitly excludes multi-model routing, Council Mode, persistent model memory and autonomous agents.

---

## 2. What M3 Is

M3 is the milestone that turns the proven M2 Single-Model AI path into a **scalable, premium and auditable product foundation**.

### Canonical M3 thesis

> **M3 turns AI Showroom from a functional Single-Model AI application into a premium, auditable AI operating environment with a deterministic Model Router foundation and a first-class human interaction system, while preserving M2's human authority boundary.**

M3 makes AI Showroom more capable and more legible.

It does **not** make AI Showroom autonomous.

---

## 3. Why M3 Exists

M2 intentionally solved one bounded problem:

- one model;
- one inference path;
- one structured result;
- explicit human review;
- no downstream autonomous action.

That architecture is safe but not yet scalable to later model choice, differentiated capabilities or a mature product experience.

M3 exists to establish three foundations simultaneously:

1. **Product Experience Foundation** — a coherent application shell, Mission Workspace, design language and interaction system.
2. **Model Router Foundation** — deterministic, inspectable selection architecture without introducing autonomous orchestration.
3. **Engineering Foundation** — CI, component interaction testing and exact-HEAD evidence suitable for routine future development.

---

## 4. Capability Delivered by M3 Core

M3 Core delivers:

### Product

- premium AI operating-environment identity;
- responsive application shell;
- improved Workspace and Project experiences;
- redesigned Mission Workspace;
- intentional AI composer;
- explicit generation/routing states;
- improved draft review;
- first-class loading, empty, failure and HITL states;
- keyboard and focus behavior;
- reduced-motion behavior.

### AI architecture

- deterministic model registry;
- deterministic routing policy;
- versioned route decisions;
- provider/profile resolution boundary;
- auditable route reason codes;
- explicit selected-model presentation;
- existing cost ceiling preserved;
- existing M2 inference validation preserved;
- existing HITL preserved;
- no silent fallback.

### Engineering

- secret-free CI;
- component interaction testing;
- router unit tests;
- UI interaction tests;
- Playwright coverage of the M3 path;
- existing RLS regression suite;
- exact-HEAD acceptance evidence.

### Governance

- milestone-level M3 visibility in Obsidian/Vault;
- exact SHA references;
- explicit activation;
- design and implementation freeze records;
- final audit and closure record.

---

## 5. Explicitly Out of Scope

M3 Core does not include:

- autonomous agents;
- AI-directed tool use;
- Council Mode;
- model voting;
- agent swarms;
- persistent cross-session AI memory;
- automatic email, WhatsApp or CRM action;
- Green List integration;
- DLD pipeline integration;
- `raioc-os` integration;
- n8n commercial workflow integration;
- production deployment;
- hosted AI Showroom Supabase mutation;
- CANARY lift;
- DEPLOY HOLD lift;
- production-provider configuration;
- unrestricted AI Showroom ↔ Obsidian two-way synchronization;
- customer commitments or externally consequential actions;
- a second live model/provider unless separately authorized.

---

## 6. M2 Architecture Preservation — Binding Invariants

M3 changes **selection before inference**, not authority after inference.

Canonical flow:

`Human → Router → Selected Provider Profile → InferenceExecutionWrapper → Structured Draft → mission_ai_drafts → Human Review → Approve / Dismiss`

The following M2 guarantees are immutable inside M3 Core:

1. Model output remains a draft.
2. `SingleModelInputSchema` / structured-output validation remains load-bearing.
3. `InferenceExecutionWrapper` remains responsible for runtime validation, failure handling, telemetry and cost enforcement.
4. The 20,000 `usd_micros` per-inference ceiling cannot be weakened.
5. Provider timeout, malformed output, rate limits and other provider failures remain fail-closed.
6. AI output does not directly mutate `public.missions`.
7. `public.mission_ai_drafts` remains the HITL review boundary.
8. The current approval RPC / database HITL enforcement cannot be bypassed.
9. No AI output reaches an external system.
10. No `raioc-os` dependency is introduced.

If M3 implementation requires changing RLS, Auth or the HITL enforcement model rather than merely proving it still works:

**STOP → classify exception → do not silently expand M3 Core.**

---

## 7. Permitted Model Router Architecture

### 7.1 Router nature

The M3 router is:

- deterministic;
- server-side;
- rule-driven;
- versioned;
- inspectable;
- testable without network access.

It is **not another LLM**.

No model call is permitted merely to decide which model should receive the real model call.

### 7.2 Proposed module boundary

```text id="n4x7o3"
features/ai/router/
  types.ts
  schemas.ts
  model-registry.ts
  routing-policy.ts
  router.ts
  presentation.ts
```

Final filenames may vary without changing the architecture.

### 7.3 Model profile

A profile may contain:

```text id="mmqj8t"
id
provider
model_identifier
enabled
capabilities
quality_class
latency_class
cost_class
supports_structured_output
```

Secrets never belong in the registry.

### 7.4 Router input

Routing may use only explicit operational input, for example:

- task type;
- required capability;
- prompt/context size;
- explicit quality mode;
- explicit cost policy;
- provider/profile availability;
- approved user override.

It must not use inferred personal characteristics or hidden user profiling.

### 7.5 Route decision

A route decision contains at minimum:

```text id="2064m4"
schema_version
policy_version
selected_profile_id
reason_code
candidate_profile_ids
override_source
```

The object is application metadata.

It is not hidden reasoning or model chain-of-thought.

### 7.6 Provider resolution

The route decision resolves to a provider profile.

The provider profile supplies:

- the `ModelProviderAdapter`;
- the correct provider-specific cost estimator;
- model identity/configuration needed by the existing wrapper.

The existing `InferenceExecutionWrapper` continues to enforce:

- input validation;
- cost ceiling;
- timeout;
- provider failure handling;
- output validation;
- telemetry write.

### 7.7 No silent fallback

If the selected provider/profile fails:

- record failure honestly;
- display failure;
- stop.

M3 Core does not silently choose a different profile.

Explicit fallback policy is future scope unless separately designed and approved.

### 7.8 Router telemetry persistence

For durable auditability, M3 Core may extend the existing `inference_logs` telemetry record with minimal route metadata:

```text id="khce6z"
router_policy_version
selected_profile_id
route_reason_code
override_source
```

This is a **local-only, forward-only repository migration** during M3.

It must:

- add no new autonomous behavior;
- change no RLS policy;
- change no role/grant model;
- weaken no append-only guarantee;
- change no HITL trigger or approval RPC;
- never be applied to hosted Supabase during M3 Core.

If those conditions cannot be satisfied:

**STOP.**

No separate Router database or second control plane is authorized.

---

## 8. Core vs M3-X1 Provider/Model Work

### M3 Core

M3 Core uses the already accepted live model path:

`gemini-3.6-flash`

Core may:

- wrap it in the registry/profile architecture;
- route to it deterministically;
- exercise multiple deterministic fake/test profiles;
- test two-profile routing without network calls;
- prove policy selection;
- prove UI rendering of route state;
- preserve current pricing and cost ceiling.

Core does **not** require two live models.

### M3-X1 — Live Multi-Model Proof

Separate exception mission.

Any second live model or live provider belongs here.

This includes:

- another live Gemini model;
- another provider;
- new provider credentials;
- new billing;
- model pricing changes;
- provider configuration carrying incremental spend;
- live two-model comparison.

M3-X1 is not required for M3 Core acceptance.

It requires separate E7/spend classification before execution.

---

## 9. Manual Model Override

Architecture may support an explicit override field.

However:

- `Auto` remains default;
- override is never hidden;
- override source is recorded;
- override cannot bypass cost policy or capability requirements.

Because M3 Core currently has only one authorized live profile:

**the production-facing M3 Core UI will not present a misleading multi-model picker.**

A manual selector may become visible only after two or more eligible live profiles are independently authorized.

Synthetic/test profiles may exercise this behavior in component/unit tests.

---

## 10. Product Experience Architecture

The product direction is:

> **Premium AI operating environment / command center**

Target attributes:

**fast · calm · intelligent · premium · precise · responsive · operational**

Avoid:

- generic SaaS;
- ChatGPT-clone layout;
- crypto-dashboard styling;
- gaming HUD styling;
- card-grid clutter;
- excessive glassmorphism;
- ornamental motion.

### Highest-priority surface

**Mission Workspace**

Desktop target:

```text id="lylgvb"
Mission Header
├── Mission Context
├── AI Workspace
└── Activity / Review History
```

Responsive behavior:

- desktop: three-zone workspace;
- tablet: secondary context becomes collapsible;
- mobile: Context / AI / Activity become deliberate tabbed or stacked modes.

The underlying M2 draft and approval semantics do not change.

---

## 11. Motion Architecture

Binding principle:

> **Motion must explain state, hierarchy, causality or navigation. If it communicates none of these, remove it.**

A formal Motion Constitution must be accepted before broad UI implementation.

It will specify:

- trigger;
- purpose;
- duration;
- easing;
- state transition;
- reduced-motion equivalent.

Default implementation uses:

- CSS;
- Tailwind;
- existing `tw-animate-css`;
- native browser capabilities.

A new open-source motion dependency is allowed only through a bounded Tiago decision if the prototype proves CSS insufficient and it requires **no incremental spend**.

No fake progress percentages.

No fake chain-of-thought.

No fake streaming when structured provider output is not actually streamed.

---

## 12. CI and Component Interaction Testing

### CI

M3 establishes one secret-free GitHub Actions workflow.

Initial command gate:

```text id="hdavue"
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

No:

- deployment;
- production credentials;
- hosted Supabase key;
- provider API secret;
- database mutation.

RLS and full Playwright remain local/manual acceptance evidence initially unless a later bounded change proves they can run safely and deterministically without hosted secrets.

### Component testing

M3 adds a Vitest-compatible component interaction harness.

Default implementation direction:

- Testing Library;
- user-event;
- jsdom or equivalent Vitest-supported DOM environment.

Required coverage includes:

- sidebar expand/collapse;
- Mission Workspace state;
- Auto route state;
- router decision presentation;
- AI generation states;
- error states;
- Approve / Dismiss;
- keyboard navigation;
- reduced-motion behavior.

---

## 13. Obsidian / Vault Boundary

AI Showroom and the Vault remain separate authority domains.

M3 does not create automatic unrestricted two-way synchronization.

Only milestone-level checkpoints are reflected.

### S0 — Scope committed

Record:

- milestone name;
- status;
- scope SHA;
- target date;
- implementation branch.

### S1 — Activation

Record:

- exact activation declaration;
- authority basis;
- branch;
- base SHA.

### S2 — Design freeze

Record:

- Design Constitution reference;
- Motion Constitution reference;
- accepted prototype reference.

### S3 — Implementation freeze

Record:

- frozen HEAD SHA;
- test status;
- findings.

### S4 — Closure

Record:

- independent audit result;
- final decision;
- merge SHA;
- next gate.

No checkpoint contains secrets, API keys, raw customer data, full inference history or unrestricted model prompts.

Each Vault write requires its own authorized writer/synchronization boundary.

M3 implementation authority over `ai-showroom` does not automatically confer Vault write authority.

---

## 14. Expected Blast Radius

Expected code surfaces:

```text id="f3wc99"
features/ai/router/**                         NEW
features/ai/actions.ts                       MODIFY
features/ai/inference-wrapper.ts             MODIFY
features/ai/provider.ts                      MODIFY/REFACTOR
features/ai/generate-mission-ai-draft.ts     POSSIBLE MODIFY
features/ai/draft-presentation.ts            POSSIBLE MODIFY
features/ai/generate-draft-form.tsx          MODIFY
features/ai/mission-ai-draft-card.tsx        MODIFY
features/ai/mission-ai-drafts-panel.tsx      MODIFY

features/workspaces/workspace-shell.tsx      MODIFY
app/(app)/app/page.tsx                       MODIFY
app/(app)/w/[workspaceSlug]/page.tsx         MODIFY
app/(app)/w/[workspaceSlug]/projects/[projectId]/page.tsx
                                              MODIFY
app/(app)/w/[workspaceSlug]/projects/[projectId]/missions/[missionId]/page.tsx
                                              MODIFY
app/globals.css                              MODIFY

package.json                                 MODIFY
package-lock.json                            MODIFY
.github/workflows/ci.yml                     NEW
tests/unit/**                                ADD/MODIFY
tests/component/**                           NEW
tests/e2e/**                                 ADD/MODIFY

supabase/migrations/<M3 router telemetry migration>.sql
                                              ONE NEW FORWARD MIGRATION
lib/supabase/database.types.ts               UPDATE IF REQUIRED
```

Explicitly outside blast radius:

```text id="28s3sl"
raioc-os/**
n8n workflows
hosted Supabase state
production deployments
existing M2 migration history edits
mission_ai_drafts HITL trigger semantics
approval RPC authority
CANARY state
DEPLOY HOLD
```

Historical migrations are never rewritten.

---

## 15. Definition of Done

M3 Core is complete only when:

1. Scope/design, implementation plan and acceptance matrix are committed.
2. Tiago explicitly activates M3 after D-08A Q3 classification.
3. Current UI audit is complete.
4. Design Constitution is accepted.
5. Motion Constitution is accepted.
6. Core prototype is accepted.
7. Responsive shell is implemented.
8. Mission Workspace is implemented.
9. Deterministic router is implemented.
10. At least two synthetic profiles prove deterministic policy selection in tests.
11. Existing `gemini-3.6-flash` remains the sole authorized live profile unless M3-X1 is separately authorized.
12. Route decision is inspectable.
13. No silent fallback exists.
14. Cost ceiling is unchanged.
15. M2 HITL is unchanged and passes regression.
16. Secret-free CI passes.
17. Component interaction suite passes.
18. Unit tests pass.
19. local RLS tests pass.
20. local E2E tests pass.
21. typecheck passes.
22. lint passes under the accepted warning baseline.
23. `npm run build` passes.
24. Evidence is measured at the exact frozen HEAD.
25. No `raioc-os` coupling exists.
26. No hosted mutation or production deployment occurred.
27. M3 checkpoint state is reflected through the governed Vault boundary.
28. Independent milestone audit returns APPROVE.
29. Emanuel approves the E3 milestone-closing merge.
30. Closing merge SHA is recorded.

---

## 16. Planning Target

**14 October 2026** is a planning target, not a guarantee.

Target outcome:

> M3 Core design-complete, implementation-complete, locally verified, independently audited and ready for its milestone-closing merge.

Re-baseline rather than hide schedule drift if:

- security/RLS/Auth/HITL redesign appears;
- a live second-provider requirement enters the critical path;
- significant product-direction rework occurs;
- production or hosted-system dependency appears.

---

## 17. D-08A Classification

### Proposed M3 Core classification

**Routine / Tiago delegated lane — Q3 clean**

The committed scope is intentionally constructed to contain none of:

- production deployment;
- hosted DB mutation;
- `raioc-os` integration;
- incremental spend;
- external commitments;
- HOLD lift.

Therefore, provided this exact bounded scope is what gets committed:

**Tiago may self-activate M3 Core under D-08A Q3.**

This does not authorize:

- M3-X1 live provider expansion;
- E1/E2 security redesign;
- E3 milestone closure;
- production deployment;
- any HOLD lift.

M3 closing merge remains **E3 → Emanuel**.

---

## 18. Exact Post-Commit Activation Declaration

This declaration is **not valid before the approved scope documents are committed and the exact SHA is verified**.

```text id="nzf7b4"
M3 ACTIVATED

Date: 28 September 2026
Project: AI Showroom
Milestone: M3 — Model Router & Product Experience Foundation
Authority: Tiago Rendas under D-08A Q3
Canonical scope commit: <EXACT_COMMITTED_SHA>
Base: feature/milestone-1-foundation @ 008deeea2908ad93974cc18982ff929686b98c6d
Implementation branch: feature/milestone-3-router-product-experience

Classification:
D-08A Q3 — SELF-ACTIVATION ELIGIBLE

M3 Core contains:
- no production deployment
- no hosted database mutation
- no raioc-os integration
- no new spend
- no external commitments
- no CANARY or DEPLOY HOLD lift

M3-X1 live multi-model/provider expansion is NOT activated.
DEPLOY HOLD remains unchanged.
CANARY remains unchanged.
M2 HITL remains binding.
One Writer remains binding.

M3 Core is authorized to proceed within the committed scope only.
```

---

## 19. Current Document State

**DRAFT FOR TIAGO REVIEW**

This document becomes canonical only after:

1. Tiago approves the package;
2. a bounded Codex documentation mission is issued;
3. Codex is the sole repository writer;
4. the approved documents are committed;
5. the exact commit SHA is independently reconciled.

No M3 feature implementation is authorized by this draft alone.

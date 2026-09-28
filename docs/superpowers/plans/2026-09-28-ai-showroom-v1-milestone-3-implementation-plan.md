# AI SHOWROOM — V1 MILESTONE 3 IMPLEMENTATION PLAN

**Milestone:** M3 — Model Router & Product Experience Foundation  
**Status:** DRAFT — FOR TIAGO REVIEW  
**Date:** 28 September 2026  
**Verified base:** `008deeea2908ad93974cc18982ff929686b98c6d`  
**Current integration branch:** `feature/milestone-1-foundation`  
**Proposed implementation branch:** `feature/milestone-3-router-product-experience`  
**Target:** 14 October 2026  
**Planning effort:** ~58 focused hours  
**Expected range:** 48–65 focused hours  
**Default repository writer:** Codex, one bounded Writer Slot at a time

---

# 1. Preconditions

Implementation does not begin until:

- M3 Design / Scope is approved by Tiago;
- this Implementation Plan is approved;
- `docs/acceptance/milestone-3.md` is approved;
- all three are committed by bounded Codex mission;
- exact documentation commit SHA is verified;
- D-08A Q3 classification is rechecked against the committed text;
- Tiago explicitly declares `M3 ACTIVATED`;
- no competing writer owns the M3 implementation surface.

Until then:

**Writer = NONE.**

---

# 2. Branch Strategy

Documentation approval/commit happens first.

After activation create:

`feature/milestone-3-router-product-experience`

Base:

`008deeea2908ad93974cc18982ff929686b98c6d`

unless the integration branch advances before branch creation.

If integration HEAD changes:

1. STOP branch creation.
2. Compare new integration HEAD to the pinned base.
3. Reconcile the delta.
4. Re-pin M3.
5. Continue only if scope remains valid.

One Writer applies throughout.

Prefer sequential bounded commits on the M3 branch.

Short-lived subordinate branches are permitted only when they materially reduce collision risk.

---

# 3. Immutable Constraints

Every implementation dispatch inherits:

- no production deployment;
- no hosted Supabase mutation;
- no `raioc-os`;
- no Green List;
- no n8n commercial integration;
- no external action;
- no autonomous agents;
- no Council Mode;
- no persistent AI memory;
- no silent model fallback;
- no weakening of M2 cost guard;
- no weakening of M2 HITL;
- no secret committed or exposed;
- no competing writer.

---

# 4. Phase Plan

## Phase 0 — M3-000 Scope Canonicalization

**Date:** 28 Sep  
**Effort:** 2.5–3.5 h  
**Writer:** Codex only for approved documentation commit

Deliver:

- M3 Design / Scope;
- M3 Implementation Plan;
- M3 Acceptance Matrix.

Evidence:

- exact integration SHA;
- exact changed-file list;
- documentation commit SHA;
- clean repository status after commit.

Then:

- checkpoint S0 to governed Vault lane through separately authorized mechanism;
- D-08A Q3 reclassification;
- Tiago explicit `M3 ACTIVATED`.

No feature code.

---

## Phase 1 — UX-00 Current Product Audit

**Date:** 28–29 Sep  
**Effort:** 3–4 h  
**Writer:** NONE

Inspect:

- sign-in;
- `/app`;
- workspace shell;
- workspace page;
- project page;
- mission page;
- create flows;
- AI composer;
- AI draft cards;
- approval/dismiss;
- loading;
- empty;
- errors;
- responsive behavior;
- keyboard/focus;
- motion.

Deliver:

`M3-UX-00-UI-AUDIT.md`

It must include:

- current component inventory;
- exact source paths;
- observed UX gaps;
- accessibility gaps;
- motion gaps;
- P0–P3 priority;
- screenshot references where useful;
- no speculative functionality presented as current fact.

---

## Phase 2 — UX-01 Design Constitution

**Date:** 29 Sep–1 Oct  
**Effort:** 4–5 h  
**Writer:** NONE until document commit

Freeze:

- visual hierarchy;
- density;
- palette;
- typography;
- spacing;
- surfaces;
- radius;
- borders;
- elevation;
- icon use;
- sidebar;
- Workspace;
- Project;
- Mission;
- cards/lists;
- forms;
- status language;
- AI visual grammar.

Required Tiago decision:

`DESIGN DIRECTION ACCEPTED FOR M3`

---

## Phase 3 — UX-02 Motion Constitution

**Date:** 30 Sep–1 Oct  
**Effort:** 3–4 h

For each motion specify:

```text id="dgzk7h"
trigger
purpose
duration
easing
transform / opacity behavior
interruptibility
reduced-motion equivalent
```

Must explicitly cover:

- sidebar;
- navigation;
- route/page transition;
- tabs;
- composer;
- routing state;
- generation state;
- selected-model state;
- draft reveal;
- Approve;
- Dismiss;
- error;
- modal/drawer;
- loading/empty state.

Exit:

No implementation instruction remains at the level of merely “make it smooth”.

---

## Phase 4 — UX-03 Isolated Prototype

**Date:** 1–2 Oct  
**Effort:** 5–7 h

Prototype only:

- Workspace Overview;
- Project Workspace;
- Mission Workspace;
- AI generation sequence;
- router state;
- approval state;
- responsive behavior.

Data:

- fake/local demonstration data.

No:

- canonical repo write;
- production auth;
- hosted Supabase;
- real provider key;
- deployment;
- external customer use.

Prototype tooling must require **no incremental spend** for M3 Core.

Exit:

Tiago approves:

- layout;
- density;
- navigation;
- Mission Workspace;
- routing presentation;
- generation experience;
- approval experience;
- motion direction.

---

## Phase 5 — Router Architecture Freeze

**Date:** 2–5 Oct  
**Effort:** 4–6 h  
**Writer:** NONE until architecture brief commit

Freeze:

- profile schema;
- registry;
- routing input;
- policy v1;
- reason-code vocabulary;
- RouteDecision schema;
- provider/profile resolver;
- cost-estimator resolver;
- failure matrix;
- no-fallback behavior;
- telemetry fields;
- manual override rules;
- synthetic test profiles.

Core live registry:

- current approved `gemini-3.6-flash` only.

Synthetic profiles:

- at least two deterministic profiles for unit/component routing proof.

No second live model.

Exit:

One unambiguous implementation brief.

---

## Phase 6 — CI + Component Test Foundation

**Date:** 5 Oct  
**Effort:** 3–5 h  
**Writer:** Codex

Expected changes:

```text id="d05ou5"
.github/workflows/ci.yml
package.json
package-lock.json
component-test configuration
tests/component/**
```

CI gate:

```text id="jjflci"
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Requirements:

- zero repository secrets;
- no provider invocation;
- no hosted Supabase;
- no deploy;
- no production environment access.

Component harness must prove at least one real render/click interaction before this phase closes.

---

## Phase 7 — Product Shell / UI Foundation

**Date:** 6–7 Oct  
**Effort:** 7–9 h  
**Writer:** Codex

Implement:

- design tokens;
- responsive app shell;
- collapsible desktop sidebar;
- mobile navigation;
- active route state;
- populated project navigation where supported by existing data;
- Workspace redesign;
- Project redesign;
- interaction primitives;
- reduced-motion baseline.

No Router business logic yet beyond approved presentation primitives.

Evidence:

- component tests;
- keyboard pass;
- desktop/tablet/mobile screenshots;
- typecheck/lint/unit/build.

---

## Phase 8 — Mission Workspace + Motion

**Date:** 7–8 Oct  
**Effort:** 6–8 h  
**Writer:** Codex

Implement:

- Mission header/context;
- AI workspace;
- prompt composer;
- task selection;
- route/generation state surface;
- draft presentation;
- review history/activity surface;
- Approve / Dismiss interaction;
- empty/error/loading states;
- accepted animations;
- reduced motion.

M2 authority semantics remain unchanged.

Exit evidence includes a component-level HITL interaction test.

---

## Phase 9 — Router Core

**Date:** 8–9 Oct  
**Effort:** 7–9 h  
**Writer:** Codex

Implement:

```text id="7sd79s"
features/ai/router/**
```

and necessary integration changes.

Required architecture:

1. explicit input enters router;
2. router produces deterministic `RouteDecision`;
3. profile resolver selects adapter + estimator;
4. existing `InferenceExecutionWrapper` executes;
5. cost ceiling applies;
6. semantic output is validated;
7. inference telemetry is written;
8. successful output becomes `mission_ai_drafts`;
9. human review remains mandatory.

Add minimal local route telemetry to existing `inference_logs`.

Expected route metadata:

```text id="mqbcct"
router_policy_version
selected_profile_id
route_reason_code
override_source
```

Database constraints:

- forward-only new migration;
- local execution only;
- no hosted application;
- existing migration files unchanged;
- no RLS-policy modification;
- no role/grant broadening;
- no HITL change.

Router tests must prove:

- same explicit input/policy produces same route;
- at least two synthetic profiles are selectable;
- disabled profile cannot be selected;
- incompatible capability is excluded;
- override is explicit;
- invalid override fails closed;
- selected-provider failure does not trigger silent fallback;
- cost ceiling still refuses over-budget inference.

---

## Phase 10 — Router UI Integration

**Date:** 9–12 Oct  
**Effort:** 4–6 h  
**Writer:** Codex

Implement:

- Auto routing state;
- policy/reason presentation;
- selected profile/model presentation;
- generation transition;
- failure state;
- persisted route metadata where available.

Manual live-profile selector remains hidden/disabled while fewer than two authorized live profiles exist.

The UI must not imply that synthetic profiles are live models.

---

## Phase 11 — Full Regression & Product Polish

**Date:** 12–13 Oct  
**Effort:** 5–7 h

Mandatory exact-HEAD command gate:

```text id="yqco17"
npm ci
npm run typecheck
npm run lint
npm test
npm run test:rls
npm run test:e2e
npm run build
```

RLS/E2E execute only against the isolated local stack and approved test environment.

Record:

- exact HEAD;
- command;
- timestamp;
- exit code;
- test count;
- warnings;
- environment;
- failure/retry history.

Manual product matrix:

```text id="8imcnl"
desktop
narrow desktop
tablet
mobile
keyboard-only
reduced motion
long titles
empty state
loading
provider error
router refusal
draft ready
approve
dismiss
```

Security/repository checks:

- no `raioc-os` coupling;
- no hosted-Supabase target;
- no secrets;
- no production/deploy configuration;
- no modification to HITL authority semantics.

---

## Phase 12 — Freeze / Audit / Closing Gate

**Date:** 14 Oct  
**Effort:** 3–5 h plus independent audit

Freeze:

- exact M3 HEAD;
- clean working tree;
- acceptance matrix completed;
- evidence references;
- no new feature commits after freeze.

Checkpoint S3:

- final HEAD;
- test status;
- open findings.

Independent audit:

- clean context;
- read-only;
- exact frozen SHA.

If Core remains free of E1/E2/deployment:

- Claude Cowork;
- Opus;
- high effort.

If scope has crossed E1/E2 or deployment boundary:

- STOP;
- reclassify;
- stronger audit/authority path.

Milestone-closing merge is **D-08A E3**.

Sequence:

`Frozen SHA → Independent Audit → Decision Card → Emanuel → Closing Merge`

Checkpoint S4 records the resulting merge SHA and status.

---

# 5. Schedule

| Date | Target | Focused effort |
|---|---|---:|
| 28 Sep | M3-000 + start UI audit | 4 h |
| 29 Sep | UI audit + Design Constitution | 4 h |
| 30 Sep | Design + Motion Constitution | 3 h |
| 1 Oct | Prototype | 4 h |
| 2 Oct | Prototype review + Router design | 4 h |
| 5 Oct | Router freeze + CI/component harness | 5 h |
| 6 Oct | UI foundation | 5 h |
| 7 Oct | UI + Mission Workspace | 5 h |
| 8 Oct | Mission Workspace + Router Core | 5 h |
| 9 Oct | Router Core + Router UI | 5 h |
| 12 Oct | Integration + interaction/E2E | 5 h |
| 13 Oct | Regression + polish + freeze | 5 h |
| 14 Oct | audit + closing decision path | 4 h |

Planning baseline:

**~58 focused hours**

Expected range:

**48–65 hours**

The date is not guaranteed.

---

# 6. Re-baseline Triggers

Add approximately 1–2 business days for:

- major UI direction reset;
- significant component-test integration friction;
- motion architecture rework.

Move the relevant work outside the M3 Core critical path or re-baseline for:

- second live model/provider;
- provider/billing changes;
- E7 cost decision.

STOP and escalate before continuing for:

- E1/E2 security redesign;
- RLS policy change;
- Auth/session change;
- HITL authority change;
- hosted environment dependency;
- production deployment;
- `raioc-os` dependency.

---

# 7. Writer Routing

### Architecture / coordination

ChatGPT GPT-5.6 Sol, High  
Writer: NONE

### Repository implementation

Codex  
Writer: ONE, bounded to explicit mission

### Prototype

Isolated prototype surface only  
No canonical repo authority

### Independent milestone audit

Read-only clean context  
Writer: NONE

No two implementation writers may touch the same M3 surface simultaneously.

---

# 8. Evidence Rule

A phase is not complete because an agent says it is complete.

Required evidence must come from:

- exact Git SHA;
- exact file diff;
- test output;
- local database proof;
- CI run;
- component/E2E result;
- explicit Tiago decision;
- independent audit;
- Emanuel E3 decision where required.

All evidence is pinned to the exact relevant SHA.

---

# 9. Current State

**M3-000 ANALYSIS COMPLETE — REVIEW GATE**

No branch created.

No feature code written.

No documentation committed.

No activation inferred.

Next permitted action after Tiago approval:

**bounded Codex documentation commit only.**

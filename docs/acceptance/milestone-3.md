# AI SHOWROOM — V1 MILESTONE 3 ACCEPTANCE MATRIX

**Milestone:** M3 — Model Router & Product Experience Foundation  
**Status:** DRAFT — NOT ACTIVATED  
**Date:** 28 September 2026  
**Verified M3 base:** `008deeea2908ad93974cc18982ff929686b98c6d`  
**Target:** 14 October 2026  
**Evidence rule:** Evidence Before Authority  
**Closing authority:** Emanuel Rendas for E3 milestone-closing merge

A gate is checked only when objective evidence exists at the exact relevant SHA.

---

## G0 — Baseline Pin

**Requirement**

Current `feature/milestone-1-foundation` is proven against the M2 merge anchor.

**Acceptance**

- [x] Live branch HEAD verified.
- [x] HEAD = `008deeea2908ad93974cc18982ff929686b98c6d`.
- [x] Compare `008deee...` → integration branch = identical.
- [x] Ahead = 0.
- [x] Behind = 0.
- [x] M2 merge is therefore the current integration HEAD.

**Evidence**

Live GitHub read-only verification, 28 Sep 2026.

---

## G1 — Canonical M3 Documents Committed

- [ ] M3 Design / Scope committed.
- [ ] M3 Implementation Plan committed.
- [ ] M3 Acceptance Matrix committed.
- [ ] Exactly approved text committed.
- [ ] Commit SHA recorded.
- [ ] No feature implementation included in documentation commit.

**Evidence required:** exact commit SHA + changed-file list.

---

## G2 — D-08A Classification and Explicit Activation

- [ ] Committed scope contains no production deployment.
- [ ] No hosted DB mutation.
- [ ] No `raioc-os` integration.
- [ ] No incremental spend.
- [ ] No external commitment.
- [ ] No HOLD lift.
- [ ] Tiago records explicit `M3 ACTIVATED`.
- [ ] Activation declaration references exact scope SHA.

No inferred activation is accepted.

---

## G3 — UI Audit Complete

- [ ] Current screens inventoried.
- [ ] Current components inventoried.
- [ ] Responsive gaps recorded.
- [ ] Accessibility gaps recorded.
- [ ] Motion gaps recorded.
- [ ] Exact source paths recorded.
- [ ] Priority classification recorded.

**Evidence:** `M3-UX-00-UI-AUDIT.md`.

---

## G4 — Design Constitution Accepted

- [ ] visual hierarchy frozen;
- [ ] palette frozen;
- [ ] typography frozen;
- [ ] density/spacing frozen;
- [ ] surface/border/radius rules frozen;
- [ ] sidebar/nav behavior frozen;
- [ ] Workspace layout frozen;
- [ ] Project layout frozen;
- [ ] Mission Workspace layout frozen;
- [ ] status visual language frozen.

**Evidence:** explicit Tiago acceptance.

---

## G5 — Motion Constitution Accepted

Every material motion has:

- [ ] trigger;
- [ ] purpose;
- [ ] duration;
- [ ] easing;
- [ ] transform/state behavior;
- [ ] reduced-motion equivalent.

No decorative animation with no state/hierarchy/navigation purpose.

---

## G6 — Prototype Accepted

Prototype demonstrates:

- [ ] Workspace;
- [ ] Project;
- [ ] Mission Workspace;
- [ ] AI composer;
- [ ] Router state;
- [ ] Draft state;
- [ ] Approve;
- [ ] Dismiss;
- [ ] desktop;
- [ ] mobile/responsive behavior.

Prototype uses no production data/backend.

**Evidence:** prototype reference + Tiago acceptance.

---

## G7 — Secret-Free CI Operational

A GitHub Actions workflow runs:

```text id="r2ev40"
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Acceptance:

- [ ] no production secrets;
- [ ] no provider key;
- [ ] no hosted Supabase credential;
- [ ] no deploy step;
- [ ] successful run pinned to exact PR/HEAD.

---

## G8 — Component Interaction Harness Operational

- [ ] real React render test executes;
- [ ] user interaction/click executes;
- [ ] keyboard interaction tested;
- [ ] asynchronous state tested;
- [ ] reduced-motion behavior testable;
- [ ] harness runs through routine test command/CI.

---

## G9 — Deterministic Model Router

Unit tests prove:

- [ ] explicit input → deterministic decision;
- [ ] policy version is present;
- [ ] selected profile is present;
- [ ] reason code is present;
- [ ] at least two synthetic profiles are routable;
- [ ] disabled profile cannot route;
- [ ] incompatible capability cannot route;
- [ ] invalid route fails closed;
- [ ] same input/policy/registry produces same decision.

No LLM call is used to select an LLM.

---

## G10 — Live Provider Boundary Preserved

M3 Core:

- [ ] retains current authorized `gemini-3.6-flash` live path;
- [ ] introduces no second live model;
- [ ] introduces no second live provider;
- [ ] creates no new provider billing;
- [ ] requires no new provider credential.

Synthetic/test profiles are clearly marked non-live.

A second live model/provider automatically leaves Core and enters M3-X1/E7.

---

## G11 — No Silent Fallback

Tests prove:

- [ ] selected provider timeout stops;
- [ ] selected provider error stops;
- [ ] selected provider rate limit stops;
- [ ] malformed output stops;
- [ ] system does not choose another model silently;
- [ ] user-visible failure state exists.

---

## G12 — Cost Guard Preserved

- [ ] 20,000 `usd_micros` hard ceiling remains enforced.
- [ ] selected profile resolves correct estimator.
- [ ] over-ceiling request is refused before provider dispatch.
- [ ] route override cannot bypass ceiling.
- [ ] cost telemetry remains runtime-generated.

Any policy changing the approved ceiling requires separate authority.

---

## G13 — Router Telemetry Auditable

Each successful/new inference can expose or persist:

- [ ] router policy version;
- [ ] selected profile ID;
- [ ] reason code;
- [ ] override source;
- [ ] actual provider model identifier.

If implemented through `inference_logs`:

- [ ] forward-only migration;
- [ ] local execution only;
- [ ] historical migrations untouched;
- [ ] append-only behavior preserved;
- [ ] no RLS-policy weakening;
- [ ] no grant broadening.

---

## G14 — M2 HITL Preserved

- [ ] AI output still lands as `mission_ai_drafts`.
- [ ] no direct AI write into `public.missions`.
- [ ] pending-review path remains enforced.
- [ ] human Approve remains explicit.
- [ ] human Dismiss remains explicit.
- [ ] approval RPC/security boundary remains effective.
- [ ] direct bypass remains blocked.
- [ ] existing RLS/HITL regression suite passes.

No application UI change counts as proof of the database boundary.

---

## G15 — Mission Workspace Product Acceptance

Mission Workspace demonstrates:

- [ ] Mission context;
- [ ] AI composer;
- [ ] explicit router state;
- [ ] selected model/profile state;
- [ ] draft output;
- [ ] confidence;
- [ ] review state;
- [ ] Approve/Dismiss;
- [ ] activity/history state;
- [ ] failure state;
- [ ] empty state;
- [ ] loading state.

---

## G16 — Responsive / Accessibility / Reduced Motion

Manual + automated evidence covers:

- [ ] desktop;
- [ ] narrow desktop;
- [ ] tablet;
- [ ] mobile;
- [ ] keyboard-only navigation;
- [ ] visible focus;
- [ ] appropriate ARIA/live regions;
- [ ] `prefers-reduced-motion`;
- [ ] no information lost with motion disabled.

---

## G17 — Full Exact-HEAD Command Gate

At the frozen candidate SHA:

```text id="fsk7v2"
npm ci
npm run typecheck
npm run lint
npm test
npm run test:rls
npm run test:e2e
npm run build
```

For every command record:

- [ ] SHA;
- [ ] environment;
- [ ] timestamp;
- [ ] exit code;
- [ ] test count/result;
- [ ] warnings/failures.

No mixing evidence from different HEADs.

---

## G18 — Isolation from RAIOC / Production

Repository and execution evidence proves:

- [ ] no `raioc-os` import;
- [ ] no `raioc-os` API call;
- [ ] no Green List dependency;
- [ ] no n8n commercial workflow integration;
- [ ] no hosted AI Showroom Supabase mutation;
- [ ] no Vercel/production deployment;
- [ ] no external customer action;
- [ ] no CANARY change;
- [ ] no DEPLOY HOLD change.

---

## G19 — Governed Obsidian Checkpoints

M3 status visibility records:

- [ ] S0 Scope committed;
- [ ] S1 Activated;
- [ ] S2 Design freeze;
- [ ] S3 Implementation freeze;
- [ ] S4 Closure.

Each record references exact Git evidence.

No unrestricted two-way sync exists.

No secrets/raw customer payloads are mirrored.

---

## G20 — Scope Integrity

Search/review proves M3 contains none of:

- [ ] autonomous agents;
- [ ] Council Mode;
- [ ] model voting;
- [ ] persistent cross-session memory;
- [ ] external tool execution;
- [ ] automatic dispatch;
- [ ] hidden fallback;
- [ ] unapproved live provider/model expansion.

Any detected item is a STOP condition, not an acceptance waiver.

---

## G21 — Independent Audit

Frozen exact HEAD submitted to clean-context audit.

Required:

- [ ] audit identifies exact SHA;
- [ ] audit uses current scope/design;
- [ ] audit reviews acceptance matrix;
- [ ] findings classified;
- [ ] no unresolved acceptance-blocking finding remains;
- [ ] verdict = APPROVE before closure proceeds.

Audit is read-only.

---

## G22 — E3 Milestone Closure and Merge

M3 closing merge is D-08A E3.

Required:

- [ ] frozen SHA;
- [ ] all mandatory gates met;
- [ ] independent audit APPROVE;
- [ ] Emanuel decision card;
- [ ] explicit closing authorization;
- [ ] merge performed by authorized writer;
- [ ] exact merge SHA captured;
- [ ] S4 closure state recorded.

Production remains a separate future gate.

---

# Acceptance Status

At M3-000 review stage:

```text id="0ikciq"
G0   PASS
G1   PENDING TIAGO APPROVAL + CODEX DOC COMMIT
G2   PENDING COMMITTED SHA + EXPLICIT ACTIVATION
G3–G22 NOT STARTED
```

No unchecked item may be represented as complete.

---

# D-08A Preliminary Classification

If the M3 Design / Scope is committed without substantive expansion:

**M3 Core qualifies for Tiago self-activation under D-08A Q3.**

Separate escalation remains mandatory for:

- M3-X1 / new live model-provider work;
- spend;
- E1/E2 security work;
- hosted DB mutation;
- production;
- `raioc-os`;
- external commitments;
- HOLD lift;
- E3 milestone closure.

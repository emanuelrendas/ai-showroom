# V1 Milestone 2 — Single-Model AI — Design Document

**Status:** DRAFT — Pending Ratification
**Date:** 21 September 2026
**Drafted by:** Claude (Control Tower / Strategist & Architect), commissioned by Emanuel Rendas
**Canonical path:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`
**Predecessor:** V1 Milestone 1 — Foundation (FROZEN), see `docs/acceptance/milestone-1.md`
**Sovereign Architecture Decision:** Option A, Strict Scope, ratified by Emanuel Rendas 21 Sep 2026, 14:39 GST

---

## 1. Milestone Status

**Current milestone:** V1 Milestone 2 — Single-Model AI

Milestone 1 delivered the secure, persistent foundation: Supabase Auth, Workspace → Project → Mission hierarchy, RLS, server-side authenticated access. That foundation is FROZEN and is the only base this milestone builds on.

Milestone 2 introduces exactly one AI capability: a single, auditable model call attached to a Mission, producing a structured draft that a human reviews before anything leaves the system. Nothing more.

---

## 2. Scope

### 2.1 Thesis

Single-Model AI means one model, one call path, one structured output, zero autonomy past the draft stage. No routing between models, no Council Mode, no persistent model memory across sessions, no autonomous agents, no multi-step planning inside the model call itself.

The model's job in this milestone is narrow and specific: given the content of a Mission, produce one structured, reviewable output, a summary, a classification, or a drafted response, depending on `task_type`. The human decides whether that output is used. The model never decides that on its own.

### 2.2 Architectural Boundary, Inviolable

This is the fronteira ratified by Emanuel on 21 Sep 2026. It does not move without a new written decision from him.

- Single-Model AI operates exclusively within the `ai-showroom` repository and its own Supabase project.
- Zero reads, zero writes, zero foreign keys, zero API calls, zero webhook calls to `public.leads`, `execution_effects`, or any table in the `raioc-os` Supabase project.
- Zero coupling to the DLD Green List outreach pipeline, its n8n workflows, or its HITL gate infrastructure. That system is out of reach for this milestone, not just out of scope on paper, out of reach in code and in configuration.
- The bridge to Green List lead qualification is explicitly deferred to a future, dedicated integration mission, opened only after this milestone is frozen and tested. See Section 7.

### 2.3 Explicit Non-Goals

Milestone 2 does **not** deliver:

- Multi-model routing or model selection logic.
- Council Mode, or any form of multiple models reviewing or voting on the same task.
- Persistent memory of prior model calls carried forward automatically into new calls.
- Autonomous agents, meaning no chained tool calls, no self-directed multi-step execution.
- Any write path to `raioc-os`, DLD Green List data, or any external CRM.
- Automatic dispatch of any output to an external party, email, WhatsApp, or otherwise.

A Mission named `Build Model Router` exists as application data from Milestone 1. This milestone does not implement routing. That mission name remains aspirational data until a future milestone formally scopes it.

---

## 3. Engineering Laws

### 3.1 Data Truth

- No synthetic or mock data may be used in any test, benchmark, or acceptance evidence in a way that masks real model behavior or real telemetry.
- Model quality evaluation runs against real `ai-showroom` Supabase data, or against a dedicated, disposable test project, following the same pattern already proven in the E-02/REM testbed methodology, isolated project, never production, destroyed at mission close.
- Every piece of evidence submitted for acceptance states its data source explicitly. Evidence with an unstated or fabricated source is rejected, not corrected.

### 3.2 Fail-Closed and HITL Mandatory

- Every model output is a draft. No model output, classification, or generated text reaches any external system, any CRM field, any outreach channel, or any persisted Mission state marked "final" without a recorded human approval action.
- Absence of a clear approval signal is a HOLD, never a default proceed.
- On model failure, timeout, rate limit, or malformed output: the system fails closed. It records the failure state honestly. It never fabricates a success state, an empty success, or a silently degraded output presented as complete. This is the same discipline that closed finding G9 in `raioc-os`, no fabricated delivery receipts on a failed operation, and it applies here without exception.
- The human-review-draft surface (Section 4.5) is the only path from model output to anything durable.

### 3.3 Interfaces and I/O Contracts

All contracts below are draft-for-review. They are not final until Tiago and Sol's adversarial technical validation closes on them. No implementation starts from a contract that has not passed that review.

**Input contract, draft:**

```json
{
  "schema_version": "1.0.0",
  "workspace_id": "uuid",
  "project_id": "uuid",
  "mission_id": "uuid",
  "task_type": "summarize | classify | draft_response",
  "mission_content": "string, the text the model reasons over",
  "requested_by_user_id": "uuid"
}
```

**Output contract, draft:**

```json
{
  "schema_version": "1.0.0",
  "mission_id": "uuid",
  "model": "string, exact model identifier used",
  "model_version": "string",
  "task_type": "summarize | classify | draft_response",
  "output_content": "string, the structured draft",
  "confidence": "number, 0 to 1, or null if the model provides none",
  "status": "draft_ready | failed | refused",
  "failure_reason": "string or null",
  "requires_human_review": true,
  "tokens_input": "integer",
  "tokens_output": "integer",
  "latency_ms": "integer",
  "created_at": "timestamp"
}
```

`requires_human_review` is hardcoded `true` in this milestone. There is no code path in which it is `false`. That is a design constraint, not a placeholder.

No implementation code is written against these contracts until this document is ratified in full, per the Zero Código restriction on this deliverable.

---

## 4. System Design

### 4.1 Attachment Point

Single-Model AI attaches at the Mission level, consistent with the existing repository architecture (`features/` for feature-level TypeScript, `lib/supabase/` for client access). The natural home for this feature's code is a new `features/ai/` module, mirroring the existing pattern used for authentication, workspaces, projects, and missions. This placement is a recommendation for the implementation plan, not a decision made by this design document.

### 4.2 Human Review Draft Surface

Every model output lands in a review state visible only inside the Mission it was generated from. It is readable, editable, and dismissible by an authorized workspace member. Nothing about it is published, dispatched, or written to any field outside the Mission's own draft storage until a human explicitly accepts it.

### 4.3 Failure and Fallback Path

On any model error, the system writes a `status: failed` record with an honest `failure_reason`, surfaces it to the requesting user inside the Mission, and stops. No retry loop runs silently without a visible state change the user can see. No fallback model is substituted without the substitution being logged as such in the output record.

---

## 5. Acceptance Criteria and Gates

Following the evidence discipline already ratified in `docs/acceptance/milestone-1.md`. An item is checked only with manual, automated, database, or advisor evidence attached, never by assertion.

- [ ] Input and output contracts finalized and committed, superseding the drafts in Section 3.3.
- [ ] Model call functional against a dedicated test or bancada Supabase project, never against production during development.
- [ ] Zero write path exists from this feature to any `raioc-os` table, verified by code search, not by claim.
- [ ] `requires_human_review` is provably hardcoded true, with a test asserting no code path sets it false.
- [ ] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [ ] Telemetry recorded for every call, model, tokens in, tokens out, latency, status, queryable after the fact.
- [ ] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- [ ] Supabase security advisors show no new finding introduced by this milestone.
- [ ] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [ ] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

---

## 6. Telemetry and Cost Monitoring

- Every model call writes one row to an inference log table in the `ai-showroom` Supabase project, fields matching the output contract's telemetry portion, `model`, `tokens_input`, `tokens_output`, `latency_ms`, `status`, `created_at`.
- This table is queryable by workspace administrators for cost review.
- **Open item, needs a number from Emanuel:** no cost ceiling or budget alert threshold is defined in this draft. Acceptance is not final until a budget figure or an explicit "no ceiling for this milestone" decision is recorded.

---

## 7. Out of Scope, Deferred

The following is explicitly not part of this milestone, and is named here so it is not silently forgotten:

- **DLD Green List lead qualification and triage integration.** This becomes its own dedicated integration mission once this Foundation is frozen and tested. That mission will need its own design document, addressing the bridge between the `ai-showroom` and `raioc-os` Supabase projects, and whether it reuses the `execution_effects` plus `trg_enforce_hitl_gate` pattern already proven in `raioc-os`, or introduces a new mechanism, subject to Emanuel's decision at that time.
- Multi-model routing, Council Mode, memory engines, autonomous agents, all Milestone 3-or-later material per the existing README boundary language.

---

## 8. Milestone Boundary, Stop Condition

STOP after this milestone's release gate passes in full.

Do not begin multi-model routing, Council Mode, memory-engine work, agent functionality, or any Green List / `raioc-os` integration under this milestone or as a side effect of it.

The next unit, if and when opened, requires its own separate approved design and implementation plan, exactly as this milestone required one before Milestone 1 could be extended.

---

## 9. Approval

| Role | Name | Status |
|---|---|---|
| Founder & Human Authority | Emanuel Rendas | Architecture decision (Option A) ratified 21 Sep 2026, 14:39 GST. Full document ratification pending. |
| Technical Validation | Tiago (`iiakove`) | Not yet convened |
| Technical Validation | Sol | Not yet convened |

This document is not authorization to write code. It is authorization to convene Tiago and Sol for adversarial technical review of Sections 3 and 4. Implementation begins only after that review closes and Emanuel ratifies the resulting document, per Zero Código até Design Doc aprovado.

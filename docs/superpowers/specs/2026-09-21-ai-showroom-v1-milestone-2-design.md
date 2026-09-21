# V1 Milestone 2 — Single-Model AI — Design Document

**Status:** RATIFIED — Ready for Implementation Planning
**Date:** 21 September 2026
**Drafted by:** Claude (Control Tower / Strategist & Architect), commissioned by Emanuel Rendas
**Canonical path:** `docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`
**Predecessor:** V1 Milestone 1 — Foundation (FROZEN), see `docs/acceptance/milestone-1.md`
**Sovereign Architecture Decision:** Option A, Strict Scope, ratified by Emanuel Rendas 21 Sep 2026, 14:39 GST
**Technical Review:** Adversarial review by Tiago (Lane AI Showroom), 21 Sep 2026, 15:25 GST. Sol's doctrine assessed by Emanuel as consensus-aligned with the Gate A–G baseline, no independent divergent parecer required. Final ratification by Emanuel Rendas, 21 Sep 2026, 15:25 GST.

---

## 1. Milestone Status

**Current milestone:** V1 Milestone 2 — Single-Model AI

Milestone 1 delivered the secure, persistent foundation: Supabase Auth, Workspace → Project → Mission hierarchy, RLS, server-side authenticated access. That foundation is FROZEN and is the only base this milestone builds on.

Milestone 2 introduces exactly one AI capability: a single, auditable model call attached to a Mission, producing a structured draft that a human reviews before anything leaves the system. Nothing more.

---

## 2. Scope

### 2.1 Thesis

Single-Model AI means one model, one call path, one structured output, zero autonomy past the draft stage. No routing between models, no Council Mode, no persistent model memory across sessions, no autonomous agents, no multi-step planning inside the model call itself.

The model's job in this milestone is narrow and specific: given the content of a Mission, produce one structured, reviewable output, a summary and suggested actions, depending on `task_type`. The human decides whether that output is used. The model never decides that on its own.

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
- **Formal architecture ruling (21 Sep 2026, Emanuel Rendas):** the model is never asked to report on its own execution. A model cannot know its own `latency_ms`, `tokens_input`, or `tokens_output` before generation completes; asking it to emit those fields inside its structured output would force it to fabricate telemetry, a direct violation of this Data Truth law. Telemetry is captured by the runtime, never by the model. See Section 3.3 for the resulting contract split.

### 3.2 Fail-Closed and HITL Mandatory

- Every model output is a draft. No model output, classification, or generated text reaches any external system, any CRM field, any outreach channel, or any persisted Mission state marked "final" without a recorded human approval action.
- Absence of a clear approval signal is a HOLD, never a default proceed.
- On model failure, timeout, rate limit, or malformed output: the system fails closed. It records the failure state honestly. It never fabricates a success state, an empty success, or a silently degraded output presented as complete. This is the same discipline that closed finding G9 in `raioc-os`, no fabricated delivery receipts on a failed operation, and it applies here without exception.
- **Enforcement level, amended per Tiago's adversarial review (21 Sep 2026):** `requires_human_review: true` hardcoded in TypeScript is a software promise, not a security boundary. Any script, service call, or application-layer bug could otherwise move a Mission's AI-generated content straight to `applied` or `completed` without a human ever seeing it. The binding enforcement is a database-level constraint, not application code alone. See Section 4.4.

### 3.3 Interfaces and I/O Contracts

Ratified 21 Sep 2026 following Tiago's adversarial review. This section is now the binding contract for implementation, split into two distinct layers per the formal architecture ruling in Section 3.1: the **model's semantic payload**, and the **runtime telemetry envelope**. These are separate schemas, written by separate parties, never merged into one payload.

#### 3.3.1 Model I/O Contract (Zod, strict)

This is the only contract the model itself is asked to fill. It is validated with `.strict()`, rejecting any unexpected key.

```typescript
import { z } from "zod";

export const SingleModelInputSchema = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid(),
  mission_id: z.string().uuid(),
  prompt_context: z.string().min(10).max(10000),
  caller_identity: z.enum(["user", "system_trigger"]),
}).strict();

export const SingleModelOutputSchema = z.object({
  schema_version: z.literal("1.0.0"),
  summary: z.string().min(1),
  suggested_actions: z.array(z.string()).nonempty(),
  confidence_score: z.number().min(0).max(1),
  confidence_tier: z.enum(["HIGH", "MEDIUM", "LOW"]), // >=0.85 HIGH, >=0.70 MEDIUM, <0.70 LOW
  requires_human_review: z.literal(true), // immutable at runtime
}).strict();
```

`task_type` (`summarize | classify | draft_response`) is **not** a field of `SingleModelInputSchema`. It is a wrapper-invocation parameter: the calling code selects the prompt template and behavior for the call based on `task_type` before the model is invoked, then threads that same value into the telemetry envelope (Section 3.3.2) for logging. It is never something the model reports about itself.

**Strict rejection mechanism:** the model infrastructure layer uses native Structured Outputs (JSON Schema with `additionalProperties: false`). The response is submitted to `SingleModelOutputSchema.safeParse()`. On validation failure, the system categorically rejects the payload with a typed error (`MODEL_SCHEMA_VIOLATION`), logs the failure to telemetry, and returns HTTP 422 to the UI. Zero free-text coercion, zero silent error conversion.

#### 3.3.2 Runtime Telemetry Envelope (Inference Execution Wrapper)

This is a second, separate contract, owned by the runtime, not the model. It lives in `InferenceExecutionWrapper`, the server-side client (`model-client.ts` / server action) that wraps every call to the model provider.

The wrapper, and only the wrapper:

1. Selects the prompt template from `task_type`, supplied by the caller's invocation context, not by the model.
2. Executes the call to the model provider.
3. Measures wall-clock execution time (`performance.now()`).
4. Extracts the provider's own usage envelope (`usage.prompt_tokens`, `usage.completion_tokens`, `response.model`), never a self-reported figure from the model's text output.
5. Validates the model's semantic payload against `SingleModelOutputSchema` (Section 3.3.1).
6. Atomically persists one row to `inference_logs` (Section 6) combining the telemetry it measured, the `task_type` it selected, and the validated (or rejected) model payload's status, **before** returning the validated payload to the calling application code.

No implementation code is written against these contracts until the corresponding sections below (4 and 6) are also read as binding, per the Zero Código restriction on this deliverable's authorship, now lifted for implementation once this document is ratified.

---

## 4. System Design

### 4.1 Attachment Point

Single-Model AI attaches at the Mission level, consistent with the existing repository architecture (`features/` for feature-level TypeScript, `lib/supabase/` for client access). The natural home for this feature's code is a new `features/ai/` module, mirroring the existing pattern used for authentication, workspaces, projects, and missions. This placement is a recommendation for the implementation plan, not a decision made by this design document.

### 4.2 Human Review Draft Surface

Every model output lands in a review state visible only inside the Mission it was generated from. It is readable, editable, and dismissible by an authorized workspace member. Nothing about it is published, dispatched, or written to any field outside the Mission's own draft storage until a human explicitly accepts it.

### 4.3 Failure and Fallback Path

On any model error, the system writes a `status: failed` record with an honest `failure_reason`, surfaces it to the requesting user inside the Mission, and stops. No retry loop runs silently without a visible state change the user can see. No fallback model is substituted without the substitution being logged as such in the output record.

### 4.4 Database-Level HITL Enforcement, Binding

Amended per Tiago's adversarial review, ratified by Emanuel Rendas 21 Sep 2026. This supersedes reliance on the application-layer flag alone. Pattern inherited from `raioc-os`'s proven `trg_enforce_hitl_gate`, not reinvented.

1. Every model output enters Mission-linked storage in a provisional state: `status = 'draft'` or `status = 'pending_review'`. There is no code path that writes a model-originated output directly to a final state.
2. A Postgres `BEFORE UPDATE` trigger on the missions/tasks table rejects any transition to `applied` or `completed` where `is_ai_generated = true`, unless both:
   - `approved_by` resolves to a valid, authenticated human user (`auth.uid()`), and
   - `approved_at` is a valid timestamp.
3. This makes the HITL barrier immune to application-layer bypass: even if the Next.js/frontend layer fails, contains a bug, or is called directly, Postgres aborts the mutation at the database boundary.

---

## 5. Acceptance Criteria and Gates

Following the evidence discipline already ratified in `docs/acceptance/milestone-1.md`. An item is checked only with manual, automated, database, or advisor evidence attached, never by assertion.

- [ ] `SingleModelInputSchema` and `SingleModelOutputSchema` implemented with `.strict()`, matching Section 3.3.1 exactly.
- [ ] `InferenceExecutionWrapper` implemented per Section 3.3.2, telemetry never sourced from model-reported text.
- [ ] A test proves `safeParse()` rejects a malformed model response with `MODEL_SCHEMA_VIOLATION` and HTTP 422, no silent coercion path exists.
- [ ] Model call functional against a dedicated test or bancada Supabase project, never against production during development.
- [ ] Zero write path exists from this feature to any `raioc-os` table, verified by code search, not by claim.
- [ ] The Postgres `BEFORE UPDATE` trigger from Section 4.4 is implemented and provably blocks a direct-SQL attempt to set an AI-generated record to `applied`/`completed` without a valid `approved_by` and `approved_at`. Application-layer `requires_human_review: true` is a secondary, non-load-bearing signal, not the enforcement mechanism.
- [ ] Fail-closed behavior proven under three conditions: model timeout, malformed model output, and rate limit response. Each produces an honest `status: failed` record, none fabricates success.
- [ ] `inference_logs` schema matches Section 6 exactly: foreign keys, indices, `cost_usd_micros` as bigint, monthly partitioning by `created_at`.
- [ ] `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- [ ] Supabase security advisors show no new finding introduced by this milestone.
- [ ] No Milestone 3 or later functionality, multi-model routing, Council Mode, agents, is present or reachable.
- [ ] Green List or `raioc-os` coupling absent, verified by dependency and import search across the codebase, not by assertion.

---

## 6. Telemetry and Cost Monitoring

Amended per Tiago's adversarial review, ratified 21 Sep 2026. The `inference_logs` table is written exclusively by the `InferenceExecutionWrapper` (Section 3.3.2), never by application code calling it directly, and never by the model.

**Structural requirements for `inference_logs`:**

1. **Strict foreign keys:** `workspace_id`, `project_id`, and `mission_id` are explicit foreign keys with `ON DELETE RESTRICT` (audit trail preserved) or `ON DELETE CASCADE`, decided at implementation time per column, never left as untyped UUIDs with no constraint.
2. **Immutable cost accounting:** cost is never computed client-side or in a volatile runtime path. The table stores:
   - `prompt_tokens` (integer), from the provider's usage envelope
   - `completion_tokens` (integer), from the provider's usage envelope
   - `total_tokens` (integer)
   - `model_identifier` (string, e.g. the exact provider model string used)
   - `task_type` (string, the value the wrapper selected before invocation, per Section 3.3.2)
   - `latency_ms` (integer, measured by the wrapper)
   - `status` (`success | failed | refused`)
   - `cost_usd_micros` (bigint), persisting the exact cost at the moment of inference, never a floating-point dollar figure
3. **Mandatory indices:**
   - `CREATE INDEX idx_inference_logs_mission ON inference_logs(mission_id);`
   - `CREATE INDEX idx_inference_logs_workspace_created ON inference_logs(workspace_id, created_at DESC);`
4. **Retention:** monthly partitioning, declarative by `created_at`, to prevent unbounded disk growth on the operational Supabase project.
5. This table is queryable by workspace administrators for cost review.
6. **Open item, still needs a number from Emanuel:** no cost ceiling or budget alert threshold is defined. Acceptance is not final until a budget figure or an explicit "no ceiling for this milestone" decision is recorded.

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
| Founder & Human Authority | Emanuel Rendas | **RATIFIED**, 21 Sep 2026, 15:25 GST. Architecture decision (Option A) ratified 21 Sep 2026, 14:39 GST; telemetry/model contract split ruling and final document ratification 21 Sep 2026, 15:25 GST. |
| Technical Validation | Tiago (`iiakove`) | **REVIEWED**, 21 Sep 2026. Adversarial review of Sections 3 and 4 delivered; findings on I/O contract strictness, telemetry table integrity, and HITL database-level enforcement incorporated into this document. |
| Technical Validation | Sol | Not independently reviewed in writing. Emanuel assessed the ratified doctrine (Postgres-level HITL trigger, strict Zod schemas, zero tolerance for unstructured text) as consensus-aligned with the existing Gate A–G baseline, and ratified without a separate written parecer. |

This document is the binding design for Milestone 2 implementation. Section 3.3 (both subsections) and Section 4.4 are load-bearing contracts, not suggestions, implementation that deviates from them requires a new written decision from Emanuel, the same discipline applied to the Option A architecture boundary in Section 2.2.

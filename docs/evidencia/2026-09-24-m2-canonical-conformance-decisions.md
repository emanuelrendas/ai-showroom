# M2 Canonical Conformance Decision Record

**Date:** 24 September 2026
**Canonical baseline:** `d2ee57ac67b5699dae9342a0b73bfbff674df069`
**Branch:** `feature/milestone-2-single-model`
**Decision authority:** Tiago under Part 18
**Class:** B
**Writer:** Codex
**Collision check:** CLEAR
**Pre-implementation SHA:** `6f754fdf290a05158f7c3f52d16b724879e16769`
**Authorized blast radius:** M2 inference telemetry only
**Status:** Telemetry Class-B decisions RATIFIED BY TIAGO UNDER PART 18. The Class-C `mission_ai_drafts` HOLD is unchanged.

This record preserves implementation evidence outside the immutable ratified design. It does not amend that design and does not select an architecture on Emanuel's behalf.

## Class C: Database-Level HITL Location

### Option A — Literal Section 4.4 on `missions`

- **Schema impact:** alter the existing `public.missions` table to add at least `is_ai_generated`, `approved_by`, and `approved_at`; reconcile its current `todo | in_progress | blocked | done | cancelled` status constraint with the canonical `applied | completed` transition language; attach the mandatory `BEFORE UPDATE` HITL trigger to `missions`. The canonical text does not fully specify how structured draft payloads coexist with the existing Mission row, so that storage detail would also need an explicit decision.
- **Effect on frozen Milestone 1:** directly changes a frozen table and its status semantics.
- **HITL security:** the trigger protects the Mission row itself from reaching a final AI-generated state without authenticated `approved_by` and valid `approved_at` values. Application/RLS paths would also need anti-spoofing rules.
- **Migration impact:** requires a new forward migration plus coordinated changes to generated database types, server actions, queries, UI, and tests. Replacing Option B would also require a data-preservation plan for existing draft rows.
- **Current test evidence:** none of the current RLS tests exercise this design; the current tests target `mission_ai_drafts`.
- **Reversion cost/risk:** high. It changes frozen Milestone 1 behavior and replaces already implemented storage, RPC, RLS, trigger, and UI paths.

### Option B — Preserve `mission_ai_drafts`

- **Schema impact:** retain the dedicated Mission-linked table with structured output fields, `pending_review | applied | dismissed` lifecycle, human approval fields, and foreign keys to Mission, Project, Workspace, and profiles. `public.missions` remains unchanged.
- **Effect on frozen Milestone 1:** none at schema level.
- **HITL security:** direct clients cannot write `applied` or approval fields through RLS; `approve_mission_ai_draft(uuid)` stamps `auth.uid()` and `now()`; a `BEFORE UPDATE` trigger independently rejects `applied` rows missing approval evidence.
- **Migration impact:** already implemented in `20260922140000_create_mission_ai_drafts.sql`; preserving it requires no schema rewrite.
- **Current test evidence:** 12 committed RLS tests cover member/outsider access, anti-spoofing, dismissal, RPC approval, re-approval rejection, and service-role trigger bypass attempts. Prior acceptance evidence records those tests passing against local Postgres; they were not rerun during this non-database remediation.
- **Reversion cost/risk:** lower if preserved; high if removed because the application, generated types, unit tests, RLS tests, and browser flow already depend on it.

**Decision required:** Emanuel must select Option A or Option B because Section 4.4 is load-bearing. Option B remains implemented but is not described as ratified while this HOLD is open.

## Class B: Telemetry Choices

### Foreign-key deletion behavior

- **Current implementation:** `ON DELETE RESTRICT` for `workspace_id`, `project_id`, and `mission_id`.
- **Canonical allowance:** Section 6 explicitly leaves `RESTRICT` versus `CASCADE` to implementation time.
- **Effect:** a Mission hierarchy containing telemetry cannot be deleted while the log remains. This preserves the audit trail but changes container-deletion behavior.
- **Decision:** RATIFIED BY TIAGO UNDER PART 18 on 24 September 2026. Preserve `ON DELETE RESTRICT` on all three telemetry foreign keys.

### Append-only telemetry trigger

- **Current implementation:** unconditional `BEFORE UPDATE` and `BEFORE DELETE` rejection on `ai_inference_logs`, with client UPDATE/DELETE privileges also revoked.
- **Effect:** strengthens telemetry integrity beyond the canonical minimum and interacts with FK deletion behavior.
- **Class boundary:** no change to the human-approval architecture was identified, so this remains Class B unless Control Tower finds a Class C dependency.
- **Decision:** RATIFIED BY TIAGO UNDER PART 18 on 24 September 2026. Preserve the database rejection triggers and revoked client mutation privileges.

### `ai_inference_logs` naming

- **Current implementation:** `ai_inference_logs`; canonical name: `inference_logs`.
- **Affected surfaces:** table and partition names, the canonical `idx_inference_logs_mission` / `idx_inference_logs_workspace_created` index names (currently `idx_ai_*`), partition helper, triggers, policies, generated database types, Supabase adapter, unit/RLS/E2E tests, and acceptance evidence.
- **Safety classification:** a coordinated rename is bounded canonical conformance rather than architecture expansion. Before any non-disposable deployment, it can be performed by changing the branch migration and all references. If the migration has reached any persistent environment, use a forward rename migration instead of rewriting applied history.
- **Decision:** RATIFIED BY TIAGO UNDER PART 18 on 24 September 2026. Conform the table and associated telemetry objects to canonical `inference_logs` naming before M2 release. Migration method must fail closed: rewrite only if repository/environment evidence proves the existing migration never reached a persistent environment; otherwise use a forward rename migration.

## $20 Bancada Tracking

The existing integer telemetry is sufficient for objective tracking without new production runtime behavior. In the isolated Milestone 2 test/bancada database, use:

```sql
select
  coalesce(sum(cost_usd_micros), 0)::bigint as accumulated_cost_usd_micros,
  20000000::bigint as budget_usd_micros,
  20000000::bigint - coalesce(sum(cost_usd_micros), 0)::bigint
    as remaining_budget_usd_micros
from public.ai_inference_logs;
```

`20,000,000` micros USD equals `$20.00`. This is a development-phase accounting query for the isolated bancada environment, not an autonomous production blocking policy.

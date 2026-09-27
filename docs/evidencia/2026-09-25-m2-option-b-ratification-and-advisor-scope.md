# M2 Custody Record — Option B Ratification and Advisor-Scope Decision

**Date:** 25 September 2026, GST (Asia/Dubai, UTC+04:00)
**Branch:** `feature/milestone-2-single-model`
**Decision authority:** Emanuel Rendas
**Class:** C
**Writer:** Claude Code (Sonnet 5), Implementation Writer, Writer Slot ACTIVE
**Collision check:** CLEAR — no competing writer evidence found under `docs/evidencia/2026-09-25-*` or `docs/acceptance/` before this record was written; single upstream-synced branch, clean worktree (see Block 0 gate evidence in commit history).
**Pre-implementation base SHA:** `f4cb79e352a3af24be98c7cbdebe9eee566ff9cb`
**Authorized blast radius:** M2 acceptance closure only (C1–C3 evidence, local advisor/Auth review, deterministic E2E). No deploy, no merge, no hosted mutation, no production access.

This record preserves Emanuel's 25 September 2026 decisions outside the immutable ratified design document (`docs/superpowers/specs/2026-09-21-ai-showroom-v1-milestone-2-design.md`). It does not silently amend that document's historical text — the amendment required by Block 1D/C3 is recorded separately, as a dated addendum, in the design document itself, with this record as its reference.

## Class C Decision: Option B Ratified

Following the Option A/Option B analysis captured in `docs/evidencia/2026-09-24-m2-canonical-conformance-decisions.md` (Class C, Tiago-facilitated, HOLD pending Emanuel), **Emanuel Rendas ratified OPTION B on 25 September 2026**:

- `public.mission_ai_drafts` is the canonical DB-level HITL boundary for Milestone 2.
- `public.missions` remains unchanged by the M2 AI draft architecture — no `is_ai_generated`, `approved_by`, or `approved_at` columns are added to it, and no `BEFORE UPDATE` HITL trigger is attached to it for this milestone.
- Human approval evidence is enforced at the `mission_ai_drafts` boundary: the existing `BEFORE UPDATE` trigger (`private.enforce_mission_ai_draft_hitl_gate`, `supabase/migrations/20260922140000_create_mission_ai_drafts.sql`) and the `approve_mission_ai_draft(uuid)` `SECURITY DEFINER` RPC remain the enforcement mechanism and the human transition path, respectively.

**This ratification is NOT yet a closed acceptance item.** It remains CONDITIONAL until the following are completed and committed with evidence:

- **C1** — a complete file:line map of every write path to `public.missions`, classified by caller, credential context, and human-approval requirement.
- **C2** — proof, derived from the C1 map (no invented or synthetic role), that the actual reachable AI/server execution boundary cannot directly mutate `public.missions` outside the approved human path, including RED/GREEN mutation proof against a temporarily-disabled protection.
- **C3** — a dated amendment to canonical Section 4.4 of the design document, preserving the original 21 September 2026 text and provenance, marking Option B as superseding it for M2 by explicit reference to Emanuel's 25 September 2026 ratification.

Only after C1–C3 return PASS, with evidence and a commit SHA, may the acceptance matrix move the Class-C HITL item from **CONDITIONAL** to **CLOSED** (9/12 + 1 conditional → 10/12 CLOSED).

## Advisor-Scope Decision

**Emanuel approved the following M2 advisor acceptance scope on 25 September 2026:**

1. Local database security/advisor-equivalent linting, run against a clean local migration replay (`supabase db reset --local` against the repo-local Docker Postgres instance, `127.0.0.1:54322`/`127.0.0.1:54321` only).
2. Static review of `supabase/config.toml` for repo-controlled Auth configuration.
3. Every ERROR/WARN surfaced by either check must be corrected, or receive explicit written justification in the evidence record. No silent dismissal.

**The hosted Supabase Platform/Auth advisor check is explicitly DEFERRED to the deploy milestone.** It is not part of M2's acceptance scope. Any Auth-relevant setting that is only observable hosted-side (leaked-password protection state, MFA enrollment enforcement, hosted redirect/site URL configuration, etc.) must be recorded as `DEFERRED TO DEPLOY MILESTONE` in the evidence record, never as `PASS`, and the local/static review must never be described as if the hosted Platform Advisor itself had been run against it.

**The hosted `ai-showroom` Supabase project (`yljvselkecxdfrqwyums`) remains PAUSED / INACTIVE for the entirety of this mission.** It is not restored, queried, or mutated at any point in this mission's execution.

This advisor-scope decision changes only the M2 acceptance *interpretation* of the "Supabase security advisors show no new finding" criterion. It does **not** authorize deploy, hosted mutations, production access, project restoration, or any external state change.

## Explicit Non-Authorizations (restated)

This record, and the C1–C3 / advisor / E2E work it gates, does **not** authorize:

- Deploy of any kind, to any environment.
- Merge of `feature/milestone-2-single-model` into any other branch.
- Restoration, query, or mutation of the hosted Supabase project `yljvselkecxdfrqwyums`.
- Any Vercel action.
- Any change to Milestone 1's frozen migration history.
- Any Milestone 3+ functionality (multi-model routing, Council Mode, agent framework, memory engine).
- Any Green List, `raioc-os`, n8n, or CRM/outreach coupling.

## Reference

This record is the pre-implementation decision SHA anchor for Block 1 (C1–C3). The commit that introduces this file, on top of pre-implementation base `f4cb79e352a3af24be98c7cbdebe9eee566ff9cb`, is the **decision-record commit** referenced by the Block 1 exit gate and by the Section 4.4 amendment (Block 1D/C3).

---
paths:
  - "supabase/**"
  - "lib/supabase/**"
  - "features/**/actions.ts"
  - "features/**/queries.ts"
  - "features/ai/**"
  - "scripts/**"
  - "tests/rls/**"
---

# Database, RLS and AI data path

- Schema changes only as new timestamped files in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`). Never edit an applied migration; add a follow-up.
- RLS on every public table, policies scoped by workspace membership. UI checks complement RLS, never replace it.
- After a schema change, regenerate `lib/supabase/database.types.ts` from the local stack and add/extend a test in `tests/rls/`.
- The HITL gate on `mission_ai_drafts` and the `inference_logs` ACLs are security boundaries. Any change to them needs a design note and Emanuel's approval.
- `scripts/c2-mutation-proof/*.sql` deliberately disable the HITL gate for mutation proofs. Run them only against a local disposable database, always followed by the restore script.
- Never run `supabase link`, `db push`, or any command against the hosted project. Local stack only (`npx supabase start`), per `docs/acceptance/d3-ti-01-local-supabase-runbook.md`.
- AI calls go through `InferenceExecutionWrapper` with strict structured-output validation and the cost ceiling. Tests use the deterministic provider, never a live model.

---
paths:
  - "tests/**"
  - "docs/evidencia/**"
  - "docs/acceptance/**"
  - "vitest*.{ts,mts}"
  - "playwright.config.ts"
---

# Testing and evidence

- Unit: Vitest, `tests/unit/**/*.test.ts`. RLS: `tests/rls/` (`npm run test:rls`). E2E: Playwright, `tests/e2e/` (`npm run test:e2e`). Do not run `playwright install` in cloud sessions.
- Cloud sessions cannot pull Docker images or Google Fonts: `supabase start`, `test:rls`, `test:e2e` and `build` may be blocked. Say so and record the block; do not fake results. Hand blocked steps to a local runbook (see `docs/evidencia/2026-09-25-m2-runbook-tiago.md` as the model).
- Never skip, disable or delete a failing test to get green. Fix the cause or flag it.
- Fixtures use obviously fake users and data. No real accounts, emails or passwords.
- Evidence files: `docs/evidencia/YYYY-MM-DD-<topic>.md`, raw logs in `docs/evidencia/raw/YYYY-MM-DD-<topic>/NN-<step>.log`. Record the exact SHA and the real command output.
- Past evidence is append-only: add a dated resolution section, never rewrite what was recorded.
- Acceptance checkboxes in `docs/acceptance/` are ticked only with linked evidence at the relevant SHA.

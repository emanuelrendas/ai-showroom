---
name: evidence-record
description: Record verification evidence for an AI Showroom milestone gate or fix. Use when asked to prove, verify, record evidence, close a gate, or write a fix-verification note under docs/evidencia/.
---

# Evidence record (Evidence Before Authority)

A claim is only as good as the output behind it. This skill produces an evidence note that someone else can audit at an exact SHA.

## Steps

1. Pin the baseline: `git rev-parse HEAD`, `git branch --show-current`, `git status --short` (must be clean, or list what is dirty and why).
2. Pick a slug: `YYYY-MM-DD-<milestone>-<topic>` (today's date, GST).
3. Run each check and capture the full output to `docs/evidencia/raw/<slug>/NN-<step>.log` (e.g. `01-typecheck.log`, `02-lint.log`, `03-unit-test.log`). Use `2>&1 | tee`.
4. If a step is blocked by the environment (Docker registry, Google Fonts, no `.env.test.local`), capture the failure itself as a log and mark it BLOCKED, not failed and not passed.
5. Write `docs/evidencia/<slug>.md` with:
   - Header: date, repo, branch, exact SHA, writer, what is being proven (gate ids).
   - Table: step, command, result (PASS / FAIL / BLOCKED), raw log path.
   - Findings and any deviation from the plan.
   - What remains open and who can close it (e.g. a local runbook for Tiago).
6. Never edit an older evidence file's recorded results. Add a dated "Resolution" section instead.
7. Never include secrets, project refs, emails or passwords in logs. Redact before committing.

Commit on the current feature branch. Do not tick acceptance boxes or merge; propose the ticks and let the owner decide.

---
description: Review the current branch diff for bugs, RLS/HITL safety and milestone scope
argument-hint: "[optional base branch, default feature/milestone-1-foundation]"
---

Base branch: `$ARGUMENTS` (if empty, use `feature/milestone-1-foundation`).

Review the changes on the current branch against that base.

1. `git fetch origin <base>` if needed (clones are shallow), then `git diff origin/<base>...HEAD --stat` and read the full diff.
2. Delegate a correctness pass to the `code-reviewer` subagent. If the diff touches `supabase/`, `lib/supabase/`, Server Actions, `features/ai/`, auth, env handling or `scripts/`, run the `security-auditor` subagent in parallel.
3. Check scope against the active milestone design, plan and acceptance matrix (`docs/superpowers/`, `docs/acceptance/`). Flag anything outside the approved scope.
4. Check `.claude/rules/` and the hard rules in `.claude/rules/project-governance.md`.
5. Run what works in this environment (`npm run lint`, `npm run typecheck`, `npm test`) and report real output. Name any step that is blocked and why.

Output a list ranked by severity: `file:line`, the problem, why it matters, the concrete fix. End with a verdict: ready, ready with nits, or not ready.

Do not push, merge or comment on GitHub. Report only.

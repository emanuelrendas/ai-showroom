---
description: Check an acceptance gate of the active milestone against real evidence at the current SHA
argument-hint: "<milestone number> [gate id, e.g. G3]"
---

Arguments: `$ARGUMENTS` (milestone number, optional gate id).

1. Open `docs/acceptance/milestone-<N>.md` and the matching design/plan in `docs/superpowers/`. List the gate(s) in scope with their acceptance items.
2. Record `git rev-parse HEAD` and the current branch. Evidence counts only at this exact SHA.
3. For each unchecked item, find or produce objective evidence: run the relevant commands (`npm run lint`, `typecheck`, `test`, and `test:rls` / `test:e2e` / `build` if the environment allows), read the code or migrations that prove it.
4. Use the `evidence-record` skill to write the results to `docs/evidencia/` (dated file + raw logs).
5. Propose checkbox updates in the acceptance file only for items with linked evidence. Items blocked by the environment stay unchecked with the reason.

Output: table of gate item, status (proven / not proven / blocked), evidence path. Do not merge, deploy or touch hosted Supabase. Milestone-closing decisions belong to Emanuel.

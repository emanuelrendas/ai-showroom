@AGENTS.md

## Where things live

- `AGENTS.md`: Next.js 16 agent rules (written by `next dev`, do not edit by hand)
- `.claude/rules/`: `project-governance.md` (always loaded: purpose, stack, commands, approval gate, hard rules), plus path-scoped code style, database/RLS and testing/evidence rules
- `.claude/commands/`: `/review`, `/gate-check`
- `.claude/agents/`: `code-reviewer`, `security-auditor`
- `.claude/skills/evidence-record/`: how to record gate evidence in `docs/evidencia/`
- `.claude/hooks/validate-bash.sh`: blocks destructive commands; asks before pushes to protected branches, merges, deploys, hosted Supabase
- Scope authority: `docs/superpowers/` (design, plans), `docs/acceptance/` (gates), `docs/evidencia/` (evidence)
- `docs/claude-project-instructions.md`: paste-ready block for claude.ai Projects and Cowork
- Personal overrides: `CLAUDE.local.md`, `.claude/settings.local.json` (gitignored)

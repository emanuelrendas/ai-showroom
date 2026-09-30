# Project governance (always loaded)

## What this repo is

AI Showroom: the shared RAIOC operating environment. Authenticated users work inside a Workspace -> Project -> Mission hierarchy. M2 added one controlled AI path (`Mission -> Single Model -> Structured Draft -> Human Review -> Approve / Dismiss`); M3 (Model Router & Product Experience Foundation) is in planning. Scope authority: the approved design / plan / acceptance docs under `docs/superpowers/` and `docs/acceptance/`. Read the current milestone's docs before changing scope.

## Stack

Next.js 16 (App Router, see `AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code), React 19, TypeScript, Tailwind 4 + shadcn/Base UI, Zod 4, Supabase (Auth + Postgres + RLS), Vitest, Playwright. Windows is the primary dev OS (`npm.cmd` in PowerShell).

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
- `npm test` (unit, `tests/unit/`), `npm run test:rls` and `npm run test:e2e` (need `.env.test.local` and a local Supabase stack)

## Hard rules

1. **Approval gate.** Anything touching external state needs Emanuel's explicit approval first: merging into `feature/milestone-1-foundation` (the integration/default branch) or `main`, any deploy, any hosted Supabase action (start, link, migrate, write), sending email, any message to an investor or third party. Pushing a feature branch is fine. Milestone-closing merges follow the documented path: frozen SHA -> independent audit -> decision card -> Emanuel.
2. **Hosted Supabase stays inactive.** DEPLOY HOLD and CANARY status are unchanged unless a milestone document says otherwise. Database work targets a local, disposable stack only.
3. **Human authority boundary.** Never weaken the HITL gate (DB-level enforcement on `mission_ai_drafts`), RLS, or the per-inference cost ceiling. No autonomous actions, no write path to other repos.
4. **One Writer at a time.** Respect the Writer Slot in the active plan. If the plan says `Writer: NONE`, do analysis only.
5. **Evidence Before Authority.** A gate is checked only with objective evidence at the exact SHA. Report real command output; never claim a check passed that did not run.
6. **Public repo.** No secrets, keys, tokens, project refs, passwords, personal emails or phone numbers in code, docs, commits or logs. `.env*` stays out of git (only `*.example`).

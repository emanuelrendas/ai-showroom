# AI Showroom

AI Showroom is the shared RAIOC operating environment for authenticated users to work inside a common Workspace -> Project -> Mission hierarchy.

The current implementation is intentionally limited to the secure and persistent foundation required by **V1 Milestone 1**.

## Milestone Status

**Current milestone:** V1 Milestone 1 - Foundation

Implemented and verified:

- Separate Supabase Auth accounts.
- Shared RAIOC workspace membership.
- Workspace -> Project -> Mission navigation.
- Persistent projects and missions.
- Supabase Row Level Security on public application tables.
- Server-side authenticated access through the Next.js application.
- Non-member isolation for protected workspace data.
- Independent Tiago and Emanuel access to the same authorized RAIOC data.

The final clean-tree release verification remains part of the Milestone 1 release gate.

## Milestone 1 Boundary

Milestone 1 does **not** provide working AI model routing, provider calls, Council Mode, memory engines, autonomous agents, or other Milestone 2+ AI functionality.

A mission named `Build Model Router` exists as application data. Its name does not mean model routing has been implemented.

The next implementation unit is **V1 Milestone 2 - Single-Model AI**, which requires its own approved design and implementation plan.

## Prerequisites

- Windows 10 or Windows 11.
- Git.
- Node.js 20.9 or newer.
- npm.
- Access to the shared AI Showroom Supabase project.
- An individual authorized AI Showroom account.
- Access to the canonical AI Showroom Git repository source.

## Local Setup

```powershell
git clone <REPOSITORY_URL> ai-showroom
cd ai-showroom
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open:

`http://localhost:3000`

Each person signs in with their own account.

For the complete second-PC procedure, see [Windows setup](docs/setup-windows.md).

## Environment and Secrets

The normal application environment uses:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The publishable key is used together with Supabase Auth and RLS.

Never place `SUPABASE_SECRET_KEY`, service-role credentials, database passwords, access tokens, refresh tokens, or user passwords in browser code.

`SUPABASE_SECRET_KEY` is restricted to trusted server-side administrative/test operations where explicitly required. It must not be copied into Emanuel's normal `.env.local` application environment.

Local environment files such as `.env.local` and `.env.test.local` must remain outside Git.

## Test and Verification Commands

On Windows PowerShell, use the `.cmd` npm executable when execution policy blocks `npm.ps1`:

```powershell
npm.cmd test
npm.cmd run test:rls
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The final Milestone 1 gate also begins with:

```powershell
npm.cmd ci
```

See [Milestone 1 acceptance](docs/acceptance/milestone-1.md).

## Repository Architecture

```text
app/
  Next.js routes, layouts, and protected application pages

components/
  Shared UI components

features/
  Feature-level TypeScript for authentication, workspaces,
  projects, and missions

lib/supabase/
  Browser/server/proxy Supabase clients

supabase/migrations/
  Milestone 1 database schema, RLS, and security migrations

tests/unit/
  Unit and protected-route regression tests

tests/rls/
  Database authorization and non-member isolation tests

tests/e2e/
  Browser-level authentication, persistence, and access tests

docs/
  Operating and acceptance documentation
```

## Shared Backend Model

Each PC runs its own local Next.js application.

Both applications connect to the same authorized hosted Supabase backend. Do not copy a database, Supabase data directory, authentication cookies, credentials, or an Obsidian vault between PCs to make AI Showroom data appear.

Authorized shared data appears because both applications connect to the same Supabase project and RLS grants access through workspace membership.

## Approved Source Documents

The approved Milestone 1 source documents remain the authority for scope:

- Design: `2026-09-01-ai-showroom-v1-milestone-1-design.md`
  - Canonical intended repository path: `docs/superpowers/specs/2026-09-01-ai-showroom-v1-milestone-1-design.md`
- Implementation plan: `2026-09-01-ai-showroom-v1-milestone-1-implementation-plan.md`
  - Canonical intended repository path: `docs/superpowers/plans/2026-09-01-ai-showroom-v1-milestone-1-implementation-plan.md`

This checkout currently contains neither source document and has no configured Git remote, so this README intentionally does not fabricate broken URLs.

## Operating Principle

Authentication identifies the user.

Workspace membership authorizes access.

Supabase RLS is the hard data-access boundary.

Application UI checks complement RLS; they do not replace it.

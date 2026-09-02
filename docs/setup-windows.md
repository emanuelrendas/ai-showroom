# AI Showroom - Windows Second-PC Setup

This guide configures a second Windows PC to use the same authorized AI Showroom environment.

Each PC runs its own local Next.js application. Shared application data lives in the hosted Supabase project.

## 1. Install Git and Node.js 20.9+

Install Git for Windows and Node.js 20.9 or newer.

Verify:

    git --version
    node --version
    npm.cmd --version

## 2. Clone the AI Showroom Git repository

Obtain the canonical AI Showroom repository URL from the maintainer.

    git clone <REPOSITORY_URL> ai-showroom
    cd ai-showroom

This local checkout currently has no configured Git remote, so this guide intentionally does not invent a repository URL.

## 3. Install dependencies

    npm.cmd ci

## 4. Create the local environment

Copy the example environment file:

    Copy-Item .env.example .env.local

## 5. Configure the shared Supabase project

Put the shared AI Showroom Supabase Project URL and publishable key in `.env.local`.

    NEXT_PUBLIC_SUPABASE_URL=<shared Supabase project URL>
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<shared publishable key>

Both PCs use the same authorized hosted Supabase project.

## 6. Never copy SUPABASE_SECRET_KEY to the normal application environment

`SUPABASE_SECRET_KEY` is a privileged server-side administrative/test credential.

Do not put it in browser code, commit it to Git, copy it to Emanuel's normal `.env.local`, or share it as a user credential.

The normal application uses the Supabase publishable key together with authentication and Row Level Security.

## 7. Start AI Showroom

    npm.cmd run dev

Keep that terminal running.

## 8. Open AI Showroom

Open:

    http://localhost:3000

## 9. Sign in with Emanuel's own account

Emanuel signs in with his own email and his own password.

Do not reuse Tiago's credentials. Do not copy Tiago's authenticated browser cookies or browser profile.

## 10. Confirm RAIOC appears through workspace membership

After Emanuel signs in, confirm he can open:

    RAIOC
      -> AI Showroom
          -> Build Model Router

The access comes from Emanuel's own RAIOC workspace membership. There is no hard-coded email permission check.

## Shared data between PCs

Do not copy a database, Supabase data directory, another user's browser cookies or credentials, or an Obsidian vault as a way of synchronizing AI Showroom application data.

Both local applications see the same authorized RAIOC data because they connect to the same hosted Supabase backend.

Supabase Auth identifies each user independently, and workspace membership plus Row Level Security determines what each user can access.

## Verification

After setup:

1. Start the application.
2. Open `http://localhost:3000`.
3. Sign in with Emanuel's own account.
4. Confirm RAIOC appears.
5. Open AI Showroom.
6. Open Build Model Router.
7. Refresh and confirm the data remains visible.
8. Sign out.
9. Confirm protected routes require authentication.

The full Milestone 1 release criteria are documented in `docs/acceptance/milestone-1.md`.

## Milestone boundary

This setup covers **V1 Milestone 1 - Foundation** only.

It does not indicate that model routing, provider calls, Council Mode, AI memory, or agents are implemented.

`Build Model Router` is currently a mission name stored as application data.

Milestone 2 requires its own approved design and implementation plan.

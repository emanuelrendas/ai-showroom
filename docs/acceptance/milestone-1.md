# V1 Milestone 1 - Acceptance Checklist

**Milestone:** Foundation
**Release state:** Candidate - final clean-tree verification pending
**Acceptance date:** 02 September 2026

Only mark an item complete when supported by manual, automated, database, or advisor evidence.

## Acceptance

- [x] App starts locally on Tiago's PC.
- [x] Signed-out protected routes redirect to sign in.
- [x] Tiago authenticates independently.
- [x] Tiago can access RAIOC.
- [x] Project creation persists through refresh.
- [x] Mission creation persists through refresh.
- [x] Emanuel authenticates independently.
- [x] Emanuel sees the same authorized RAIOC data.
- [x] Non-member cannot read RAIOC.
- [x] Non-member cannot read/create RAIOC projects.
- [x] Non-member cannot read/create RAIOC missions.
- [x] Non-member cannot read protected conversations/messages.
- [x] npm test passes.
- [x] npm run test:rls passes.
- [x] npm run test:e2e passes.
- [x] npm run typecheck passes.
- [x] npm run lint passes.
- [x] npm run build passes.
- [x] Supabase security advisors show no unresolved finding introduced by Milestone 1.
- [x] Second-PC setup instructions are complete.
- [x] No Milestone 2 AI functionality is presented as working.

## Evidence Recorded

### Independent user access

Manual acceptance completed on 02 September 2026:

- Tiago authenticated with his own account.
- Tiago accessed RAIOC -> AI Showroom -> Build Model Router.
- Emanuel authenticated with his own account in a separate browser context.
- Emanuel accessed the same authorized RAIOC -> AI Showroom -> Build Model Router hierarchy.
- No shared password or browser-cookie session was used as the authorization mechanism.

### Authentication path

A controlled Playwright diagnostic used the real `/sign-in` UI and the same in-memory credential value that was directly accepted by Supabase.

Observed result:

```text
ACCOUNT_MATCH: true
GENERATED_PASSWORD_LENGTH: 40
PASSWORD_RESET: true
DIRECT_LOGIN_VERIFIED: true
FORM_PASSWORD_LENGTH: 40
FINAL_PATH: /app
SIGNIN_ERROR_VISIBLE: false
```

This confirmed the Milestone 1 sign-in implementation was functioning and no authentication-code change was required.

### RLS boundary

The Milestone 1 RLS suite verifies:

- workspace owner access,
- workspace member access,
- outsider workspace isolation,
- outsider project/mission creation denial,
- authorized conversation/message access,
- outsider direct-ID conversation isolation,
- outsider direct-ID message isolation.

### Supabase advisors

Fresh security advisor review on 02 September 2026 showed one existing Auth warning:

`Leaked Password Protection Disabled`

This was not introduced by Milestone 1 and does not represent an RLS regression.

Remediation reference:

https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Fresh performance advisor review showed INFO-level unindexed foreign-key recommendations. No schema change is being introduced during Task 8 solely to silence performance advisories.

## Pending Final Gate

Run from the real local environment:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:rls
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
git status --short
```

Expected:

- Every command exits successfully.
- Final Git status is clean after documentation is committed.
- `.env.local` and `.env.test.local` remain outside Git.
- No Milestone 2 functionality has been added.

## Milestone Boundary

STOP after the Milestone 1 release gate.

Do not begin model routing, model-provider integration, Council Mode, memory-engine work, or agent functionality under this milestone.

The next unit is V1 Milestone 2 - Single-Model AI and requires a separate approved design and implementation plan.

# M2 — Block 3: Command Suite Results (25 September 2026) — SUPERSEDED, now PASS (6/6)

**Date:** 25 September 2026, GST
**Branch:** `feature/milestone-2-single-model`
**Status:** **PASS, all 6 commands, closed 25 Sep 2026 via Tiago's Windows execution — see "25 September 2026 — CLOSED" section at the end of this file.** Everything below this point, down to that section, is the original partial record, preserved unchanged: the three commands with no database or external-network dependency ran clean in this cloud session; `npm run build` hit a second, independent egress blocker here; everything downstream of a successful build or a live local Postgres (`npm run start`, Playwright E2E, `npm run test:rls`) was HOLD, not attempted, in this session.

## Commands run

```text
$ npx next typegen
Generating route types...
✓ Types generated successfully
(Required before typecheck: app/layout.tsx uses Next.js's generated
LayoutProps<"/"> global type, which only exists after a build or a
dedicated typegen pass. Fresh clones have no .next/ directory yet.
Unrelated to M2 -- app/layout.tsx is the stock Milestone-1 scaffold,
untouched by this milestone.)

$ npm run typecheck
> tsc --noEmit
EXIT_CODE: 0 -- clean, no errors.

$ npm run lint
> eslint
6 warnings (all pre-existing, in tests/unit/obsidian-sync-canary-runner.test.ts,
unrelated to M2), 0 errors.
EXIT_CODE: 0.

$ npm test
> vitest run
Test Files  31 passed (31)
Tests       304 passed (304)
Duration    7.02s
EXIT_CODE: 0. (Improves on the 22 Sep record of 302/304 -- the two
prior failures were an unrelated Obsidian-sync test hitting Node
`uv_os_get_passwd returned ENOMEM` in a different container; this
container does not reproduce that.)
```

## `npm run build` — FAIL, independent network-egress blocker (not a code defect)

```text
$ npm run build
> next build
...
Error: next/font: error:
Failed to fetch Geist from Google Fonts.
Failed to fetch Geist Mono from Google Fonts.
```

`app/layout.tsx` (Milestone-1 scaffold, unmodified by M2) uses `next/font/google` for the Geist typeface, which fetches the font files from `fonts.googleapis.com` at build time. This session's outbound egress proxy denies that host:

```text
$ curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://fonts.googleapis.com/css2?family=Geist
curl: (56) CONNECT tunnel failed, response 403

Proxy status recentRelayFailures:
{"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)","host":"fonts.googleapis.com:443"}
```

This is the same class of blocker as the Docker-registry denial documented in `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` and `docs/evidencia/2026-09-25-m2-local-security-advisor.md` — a host outside this session's outbound allowlist, not a defect in M2's code and not something a code change should paper over. **No code change was made to work around it.** Switching `app/layout.tsx` to `next/font/local` would be a real, unrelated production change to Milestone-1 scaffold code, outside this mission's authorized blast radius (M2 acceptance closure only) and not requested — it was not made.

## Downstream consequences

- **`npm run start`**: not reachable — requires a successful `npm run build` first.
- **`npx playwright test tests/e2e/milestone-2-hitl.spec.ts`**: not attempted. Even setting the font blocker aside, E1–E4 and the E2E mutation proof also require a live local Supabase stack (`npx supabase start`), independently blocked by the Docker registry denial (`docker.io`/`ghcr.io`) documented separately. Both blockers would need to clear for Block 3 to run at all.
- **`npm run test:rls`**: not attempted, for the same live-stack reason (already recorded as HOLD in `docs/evidencia/2026-09-25-m2-local-security-advisor.md` and `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`).

## Result [as of this original record]

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run lint` | **PASS** — exit 0, 0 errors, 6 pre-existing unrelated warnings |
| `npm test` | **PASS** — exit 0, 304/304 |
| `npm run build` | **FAIL — environment egress blocker (`fonts.googleapis.com`), not an M2 code defect** |
| `npm run start` | not reached |
| `npm run test:rls` | **HOLD — not attempted** (Docker registry blocker, see other evidence files) |
| `npx playwright test ...` | **HOLD — not attempted** (build blocker + Docker registry blocker) |

This was real, additional, evidence-backed progress beyond the prior 22 Sep record (typecheck/lint/unit all reconfirmed clean, unit tests improved to 304/304), but did not by itself close Block 3.

## 25 September 2026 — CLOSED

Neither blocker above applies on Tiago's own Windows machine (normal, unrestricted internet and Docker access). Executing the runbook (`docs/evidencia/2026-09-25-m2-runbook-tiago.md`) at this branch's HEAD `345b18c57963f7f996c0d8650fa3922003b49949`, on his isolated clone `C:\Users\diore\ai-showroom-m2-verify`:

```
$ npm.cmd run build
Next.js 16.3.3 / Turbopack
Compiled successfully
Finished TypeScript
Collected page data
Generated static pages 6/6
Finalized page optimization
Routes emitted, including /app, /sign-in, /w/[workspaceSlug],
/w/[workspaceSlug]/projects/[projectId],
/w/[workspaceSlug]/projects/[projectId]/missions/[missionId]
```

`npm.cmd run start` then served the built artifact successfully (Next.js 16.3.3, `http://127.0.0.1:3000`, "Ready"), and

```
$ npm.cmd run test:e2e -- tests/e2e/milestone-2-hitl-deterministic.spec.ts tests/e2e/milestone-2-security-boundary.spec.ts
5 passed
```

was run twice: once immediately after the harness fixes landed (see `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` for the two defects those fixes addressed), and again with Playwright reusing the live `next start` production server from the build above — **5 passed** both times.

`npm.cmd run test:rls` (already covered in full detail in `docs/evidencia/2026-09-25-m2-local-security-advisor.md`) returned **31/31 PASS** on the same run.

## Result

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** — 0 errors, 6 pre-existing unrelated warnings |
| `npm test` | **PASS** — 308/308 |
| `npm run test:rls` | **PASS** — 31/31 |
| `npm run build` | **PASS** — Next.js 16.3.3/Turbopack, 6/6 static pages |
| `npm run test:e2e` (deterministic suite) | **PASS** — 5/5, run twice (once standalone, once against the running production-build server) |

**Block 3: PASS, 6 of 6 commands.** No workaround was applied in this cloud session to either of its own two blockers (Docker registry egress, Google Fonts egress) — both remain accurately documented above as this session's own environment limitation. Closure came from real execution on unblocked hardware, per the explicit handoff decision recorded in `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md` and `docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`. Hosted project `yljvselkecxdfrqwyums` remained paused/inactive throughout.

# M2 — Runbook for Tiago: run the blocked verification steps locally

**Date:** 25 September 2026, GST
**Repo:** `emanuelrendas/ai-showroom`
**Branch:** `feature/milestone-2-single-model`
**Who this is for:** Tiago, on his own Windows machine (Docker and normal internet work there; this cloud session's Docker registries and Google Fonts are both blocked by policy).

## 0. Why you're doing this

Cloud Claude built and committed everything needed to close the remaining M2 acceptance gates, but two things are blocked in this session's network policy and cannot be worked around from here:

1. `docker.io` / `ghcr.io` — blocks `npx supabase start`, so nothing that needs a live local database could run (C2's mutation proof, Block 2A/2B, and most of Block 3).
2. `fonts.googleapis.com` — blocks `npm run build` (Next.js fetches Geist at build time).

Neither of those should be a problem on your machine. This runbook is the exact sequence to run there. Every test file, SQL fixture, and provider code change it depends on is already committed on this branch.

## 1. Safety boundary — same as D3-TI-01, non-negotiable

- The hosted AI Showroom Supabase project, `yljvselkecxdfrqwyums`, stays paused. Never start it, never point anything at it, never run a migration against it.
- Everything in this runbook targets a **local, disposable** Supabase stack only.
- No merge to `main`. No deploy. No production mutation, hosted or otherwise.
- If anything here disagrees with `docs/acceptance/d3-ti-01-local-supabase-runbook.md` (your own proven procedure from 11 Sep), that file's safety rules win — this runbook only adds the M2-specific test files on top of it.

## 2. Preconditions

- Docker Desktop running.
- Node.js 20.9+, npm.
- Git.
- Your existing D3-TI-01 Windows Firewall rule (TCP 54320–54329 blocked from other devices) should still be in place from 11 Sep. If you're not sure, re-check it before Step 3 — same purpose as before, keeping your local Supabase ports unreachable from your network.

## 3. Step 1 — Clone into a NEW, separate folder (don't reuse your daily `C:\Users\diore\ai-showroom`)

**Objective:** get this exact branch and commit somewhere fully isolated from your normal daily-use clone, which stays wired to the hosted project. This eliminates any risk of an env file mix-up touching production.

**Exact action:**

```powershell
cd C:\Users\diore
git clone https://github.com/emanuelrendas/ai-showroom.git ai-showroom-m2-verify
cd ai-showroom-m2-verify
git checkout feature/milestone-2-single-model
git pull origin feature/milestone-2-single-model
git rev-parse HEAD
```

**Evidence to capture:** the HEAD SHA printed by the last command.

**Verification:** the SHA must match the one Emanuel/Claude gives you when this runbook is handed to you (it will be the commit that adds this file — check the handoff message, not this document, since this document can't know its own future commit SHA).

**Next action:** Step 2.

## 4. Step 2 — Install dependencies

```powershell
npm.cmd ci
```

**Evidence:** exit code / final summary line.

**Verification:** no errors.

**Next action:** Step 3.

## 5. Step 3 — Start the local Supabase stack

This reuses your own proven D3-TI-01 procedure. If anything below doesn't match what you remember from 11 Sep, `docs/acceptance/d3-ti-01-local-supabase-runbook.md` (sections 2–6, already in this checkout) is the fuller reference.

```powershell
npx supabase start
npx supabase status
```

**Evidence:** full output of both commands — API URL, DB URL, and the anon/service_role keys (or `publishable key` / `secret key` if this CLI version prints the new names instead — either is fine, just note which format you got).

**Verification:** every endpoint is `127.0.0.1` on a local port (54321/54322/54323 range last time). None of it is `yljvselkecxdfrqwyums.supabase.co`.

**Next action:** Step 4.

## 6. Step 4 — Configure the isolated test environment

**Objective:** point only this mission's test processes at the local stack. Your daily `.env.local` in your normal clone is never touched by any of this, because you're working in the separate folder from Step 1.

**Exact action:** create `.env.test.local` in `ai-showroom-m2-verify` (not committed — it's gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key from Step 3's output>
SUPABASE_SECRET_KEY=<service_role/secret key from Step 3's output>
AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER=1
```

The last line is new for M2. It's read by `features/ai/provider.ts` — when it's exactly `1`, the app's AI generation calls a deterministic offline stub instead of live Gemini, so the E2E suite in Step 9 needs no `GEMINI_API_KEY`, makes no network call to Google, and produces the same output every run. It's gated behind this one env var, never set in `.env.example` or any real deployment, so it changes nothing about how the app behaves normally. If you want to read exactly what it does, it's the `invokeDeterministicStub` function in that file.

**Evidence:** confirm the file has all four keys set (don't paste the actual secret values back into chat).

**Verification:** `NEXT_PUBLIC_SUPABASE_URL` is `127.0.0.1`, not `yljvselkecxdfrqwyums`.

**Next action:** Step 5.

## 7. Step 5 — Typecheck, lint, unit tests (no database needed)

```powershell
npx next typegen
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

**Evidence:** full output of each command.

**Verification (what this session already confirmed on this exact branch/HEAD, for comparison):** typecheck exit 0; lint 0 errors, 6 pre-existing warnings in `tests/unit/obsidian-sync-canary-runner.test.ts`; unit tests **308 / 308 pass**. If your numbers differ, paste the diff — don't just report "looks fine."

**Next action:** Step 6.

## 8. Step 6 — RLS / tenant-isolation suite

```powershell
npm.cmd run test:rls
```

**Evidence:** full pass/fail count.

**Verification:** all pass. This is the same suite family as your D3-TI-01 7/7 result — a regression here would be a real finding, not something to explain away.

**Next action:** Step 7.

## 9. Step 7 — Block 2A/2B: local security advisors and schema lint

```powershell
npx supabase db lint --local
npx supabase db advisors --local --type security --level info
```

**Evidence:** full output of both.

**Verification:** compare against `docs/evidencia/2026-09-25-m2-local-security-advisor.md` — PASS if clean or only the already-known/expected items appear; flag anything new.

**Next action:** Step 8.

## 10. Step 8 — Build

```powershell
npm.cmd run build
```

**Evidence:** full output.

**Verification:** exit 0. This should succeed on your machine since `fonts.googleapis.com` is reachable normally from your network — this is the step that was blocked in the cloud session specifically because of that host being denied there.

**Next action:** Step 9.

## 11. Step 9 — Block 3: the deterministic E2E suite (this is the core of the handoff)

```powershell
npm.cmd run test:e2e -- tests/e2e/milestone-2-hitl-deterministic.spec.ts tests/e2e/milestone-2-security-boundary.spec.ts
```

This runs 5 tests across the two files:

- **E1** — full generate → approve cycle against the deterministic stub (happy path).
- **E2 — no shortcuts** — outsider RPC rejection, direct spoofing UPDATE rejection, proof `public.missions` cannot represent a fabricated AI-approved state.
- **E3 — tenant isolation** — a user outside the workspace can't see or touch the Mission, its AI draft, or its inference log.
- **E4 — mission window sealed** (two tests) — direct `missions` mutation refusal from the real app boundary, and the required mutation proof: the test itself temporarily drops the `mission_ai_drafts` HITL trigger with `scripts/c2-mutation-proof/disable-mission-ai-drafts-hitl-gate.sql`, confirms the block disappears (RED), then restores the trigger with `restore-mission-ai-drafts-hitl-gate.sql` and confirms it's back (GREEN) — automatically, in a try/finally, so it self-restores even if an assertion fails partway through.

**Evidence:** the full terminal output, all 5 test names with PASS/FAIL. If you want the fuller step-by-step view (including what the mutation-proof test's RED/GREEN steps actually did), run `npx playwright show-report` afterward and describe or screenshot what it shows for the E4 mutation-proof test specifically.

**Verification:** 5 / 5 PASS.

**If anything fails:** paste the raw failure output and stop there. Do **not** edit the test, the trigger, the RLS policy, or the provider code to make it pass — that's exactly the "no synthetic boundary, no weakening to force a PASS" rule the whole mission runs on. A real fail here is real information Emanuel needs, not something to route around.

**If the mutation-proof restore step itself fails** (the `finally` block's own restore throws — should be very unlikely, but the test logs a loud `console.error` if it happens): run this by hand immediately, then confirm with a query that the trigger exists again:

```powershell
npx supabase db query --local --file scripts/c2-mutation-proof/restore-mission-ai-drafts-hitl-gate.sql
npx supabase db query --local "select tgname from pg_trigger where tgname = 'mission_ai_drafts_enforce_hitl_gate';"
```

**Next action:** Step 10 (optional) or Step 11.

## 12. Step 10 (optional, not required to close Block 3) — live Gemini smoke test

Only if you want to. This is `tests/e2e/milestone-2-hitl.spec.ts`, unchanged, calling real Gemini. Do this as a **separate** run: comment out or remove `AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER=1` from `.env.test.local`, add a real `GEMINI_API_KEY`, restart, then:

```powershell
npm.cmd run test:e2e -- tests/e2e/milestone-2-hitl.spec.ts
```

Not required — the dispatch treats this as optional, and it's never part of the required deterministic suite.

## 13. Step 11 — Tear down

```powershell
npx supabase stop
```

Once you've pasted everything back, the `ai-showroom-m2-verify` folder is disposable — nothing in it needs to persist, since `.env.test.local` was never committed and the real evidence is the terminal output you're sending back.

## 14. What to send back

Paste raw, unedited terminal output for:

- Step 1: the HEAD SHA.
- Step 3: `supabase start` / `supabase status` output (endpoints only — redact the keys themselves if you want, since Step 4 already tells me to keep those out of chat too).
- Step 5: typecheck / lint / test output.
- Step 6: `test:rls` output.
- Step 7: `db lint` / `db advisors` output.
- Step 8: `build` output.
- Step 9: the full `test:e2e` output — this is the one that matters most. All 5 PASS/FAIL lines, not a summary in your own words.

## 15. What happens with it

Once this comes back, it gets folded into `docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md`, `docs/evidencia/2026-09-25-m2-local-security-advisor.md`, `docs/evidencia/2026-09-25-m2-block3-command-suite.md`, and `docs/acceptance/milestone-2.md`, and a real FINAL REPORT gets issued — with real PASS/FAIL/HOLD values instead of today's HOLD placeholders, advancing the acceptance count from 9/12 + 1 conditional toward however many of C2, Block 2A/2B, and Block 3 actually come back green.

# M2 — C2: Security Boundary Test and Mutation Proof — HOLD

**Date:** 25 September 2026, GST
**Branch:** `feature/milestone-2-single-model`
**Status:** **HOLD — blocked on local Supabase stack image access, not executed.** This is not a PASS and not a FAIL; per the dispatch's own fail-closed rule ("Missing evidence = HOLD. Not PASS."), it is recorded honestly as neither.

## Real credential/path under test (derived from C1, not invented)

Per `docs/evidencia/2026-09-25-m2-c1-missions-write-map.md`, the only real, reachable AI/server execution boundary in M2 is the Postgres `authenticated` role, exercised through `lib/supabase/server.ts`'s `createServerClient` (publishable key, session-bound cookies) — the exact client construction used by `generateMissionAiDraftAction` and every other M2 server action. There is no separate "AI role," service context, or elevated credential anywhere in this call chain; C1 confirmed this by exhaustive code search rather than assumption. This record does **not** invent a synthetic boundary production/app code never uses, per the dispatch's explicit safeguard.

## Test plan (drafted, not yet executed)

1. **Direct Mission INSERT from the `authenticated` boundary**, using a signed-in test client (same construction pattern as `tests/rls/mission-ai-drafts.rls.test.ts`): confirm `missions_insert_member` RLS still requires `created_by = auth.uid()` and workspace membership (already covered by production code's existing behavior; new assertion needed only to pin it as a regression guard).
2. **Direct Mission UPDATE from the `authenticated` boundary** attempting to set any hypothetical AI-approval-shaped value: since `public.missions` has no `is_ai_generated`/`approved_by`/`approved_at` columns under the ratified Option B architecture, this step proves the negative directly — such an UPDATE is rejected at the schema level (unknown column) before RLS is even evaluated, which is itself evidence that no AI-approval spoofing surface exists on `missions` at all under Option B.
3. **The actual Section-4.4-equivalent boundary under Option B: `mission_ai_drafts`.** Re-run, as a new pinned regression test (not merely re-citing the 12 existing tests in `tests/rls/mission-ai-drafts.rls.test.ts`), the direct-client and direct-service-role spoofing attempts against `mission_ai_drafts.status = 'applied'` with forged `approved_by`/`approved_at`, confirming both RLS (`mission_ai_drafts_update_member`'s `with check`) and the independent `BEFORE UPDATE` trigger (`private.enforce_mission_ai_draft_hitl_gate()`) reject them.
4. **Authorized human path remains functional**: `approve_mission_ai_draft(uuid)` still succeeds for a legitimate workspace member against a `pending_review` draft they're authorized to see.

## Required mutation proof (not yet executed)

Per the dispatch's required pattern:

1. **GREEN baseline** — run the new pinned test file against the schema as committed (trigger `mission_ai_drafts_enforce_hitl_gate` active): direct-client and direct-service-role spoofing attempts fail; the RPC path succeeds.
2. **RED** — temporarily, on the local/disposable database only, `DROP TRIGGER mission_ai_drafts_enforce_hitl_gate ON public.mission_ai_drafts;` (the exact, single protection under test, isolated from the RLS layer which is a separate, independently-tested mechanism) — re-run the same test file and confirm the direct-service-role spoofing attempt (which bypasses RLS by construction, per the existing test's own comment) now **succeeds** where it should have failed, proving the trigger — not RLS — is what the test is actually detecting.
3. **Restore** — re-create the trigger exactly as `20260922140000_create_mission_ai_drafts.sql` defines it (or simply re-run `supabase db reset --local` to replay the committed migration chain from scratch) and re-run the test file, confirming **GREEN** again.
4. **Final state** — the local/disposable database is left in the clean, migrated state (or torn down entirely); no committed migration file is edited for this exercise.

## Why this has not been executed

This mission's execution environment has full `docker` CLI and a working `dockerd` (started and verified operational during this mission — `docker version` succeeds, both client and server report). However, **every image pull required to bring up the local Supabase stack (`supabase start`) is blocked by this session's outbound network policy**, independent of Supabase specifically:

```text
$ docker pull hello-world
Error response from daemon: failed to resolve reference "docker.io/library/hello-world:latest":
failed to do request: Head "https://registry-1.docker.io/v2/library/hello-world/manifests/latest": Forbidden
```

The session's egress proxy status endpoint confirms this is a policy denial, not a transient failure:

```json
{
  "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "registry-1.docker.io:443"
}
```

`ghcr.io` (used for `supabase/studio`, among others) is denied the same way. Neither `docker.io` nor `ghcr.io` appears in this session's outbound allowlist (`registry.npmjs.org`, `jsr.io`, `pypi.org`, `files.pythonhosted.org`, `index.crates.io`, `proxy.golang.org`, `github.com`, and the Anthropic API hosts are the only allowlisted destinations). No cached copies of any of the required images (`supabase/postgres`, `supabase/gotrue`, `postgrest/postgrest`, `supabase/kong`, `supabase/studio`, etc.) exist in this container (`docker images` returns empty).

**This is the same class of environment limitation the dispatch itself anticipated for Block 2A** ("If Codex cannot access Docker's named pipe, do not modify Docker ACLs... the human operator may perform ONLY the local reset bridge if required"), except here the daemon itself is reachable — the blocker is the image registries, not the socket. Per that same fail-closed discipline, this record does **not** attempt a workaround: it does not route around the egress policy, does not substitute a hand-built minimal Postgres+RLS shim standing in for GoTrue/PostgREST/Kong (which would itself be exactly the kind of "synthetic boundary production/app code never uses" the dispatch explicitly forbids for C2, and would not actually exercise `npm run test:rls` / the real Supabase-js/PostgREST call path this proof needs to test), and does not mark this PASS on the strength of static reasoning alone.

## What is needed to close this

One of:

1. This session's outbound egress policy is extended to allow `registry-1.docker.io` and `ghcr.io` (or an internal mirror) for the duration of this mission, after which the test plan above is executed exactly as written and this record is updated with the real RED/GREEN output; or
2. A human operator (or a session with the required registry egress) runs the equivalent local sequence — `supabase start`, then the new pinned `mission_ai_drafts` mutation-proof test file, then the RED/GREEN sequence above — from this exact branch/commit, and returns the raw output for this record; or
3. Emanuel accepts recording this Class-C item as CONDITIONAL (unchanged from its pre-mission state) rather than CLOSED, pending either of the above.

## Result

**C2: HOLD.** No RED result, no GREEN result — neither executed. **The acceptance matrix is NOT advanced to 10/12 on the strength of this record.** C1 and C3 evidence stand on their own and are unaffected by this HOLD.

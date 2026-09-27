# M2 — Block 2C: Static Auth Configuration Review

**Date:** 25 September 2026, GST
**Branch:** `feature/milestone-2-single-model`
**Scope authority:** Advisor-scope decision, `docs/evidencia/2026-09-25-m2-option-b-ratification-and-advisor-scope.md`
**Method:** static read of `supabase/config.toml` (the only repo-controlled Auth configuration in this repository — no other Auth-relevant config file exists: `find . -iname "*.toml" -o -iname "auth*.config*"` outside `node_modules` returns only `supabase/config.toml`). **No database was started or queried for this review; it required none.**

Per the advisor-scope decision: anything only observable hosted-side is recorded as `DEFERRED TO DEPLOY MILESTONE`, never as `PASS`.

## Findings

| Area | Repo-controlled setting (`supabase/config.toml`) | Value | Assessment |
|---|---|---|---|
| Signup | `[auth] enable_signup`, `[auth.email] enable_signup` | `true` / `true` | Expected for local dev; matches the app's own sign-in flow (`features/auth/sign-in-form.tsx`). No M2 regression — M2 adds no auth surface. |
| Email confirmation | `[auth.email] enable_confirmations` | `false` | Local-dev default (no SMTP mail relay needed to sign in during tests). Consistent with the RLS/E2E test harness (`tests/rls/*.test.ts`, `tests/e2e/*.spec.ts`), which creates and signs in users via `admin.auth.admin.createUser({ email_confirm: true })` / `signInWithPassword` without a mail step. |
| Secure password change | `[auth.email] secure_password_change` | `false` | Local-dev default. Not exercised by any M2 code path (M2 introduces no password-change flow). |
| OTP expiry | `[auth.email] otp_expiry` | `3600` (1 hour) | Repo-controlled and reviewed. Local-dev default, unrelated to M2's HITL boundary. |
| OTP length | `[auth.email] otp_length` | `6` | Repo-controlled and reviewed. Default. |
| JWT lifetime | `[auth] jwt_expiry` | `3600` (1 hour) | Repo-controlled and reviewed. This is the token lifetime `auth.uid()` resolution (used by every RLS policy and by `approve_mission_ai_draft`) ultimately depends on. Default value, no M2-specific override. |
| Refresh token rotation | `[auth] enable_refresh_token_rotation`, `refresh_token_reuse_interval` | `true` / `10` | Repo-controlled and reviewed. Default, unrelated to M2. |
| Anonymous sign-ins | `[auth] enable_anonymous_sign_ins` | `false` | Reviewed. Correctly disabled — an anonymous session must never be able to reach `is_workspace_member()`-gated RLS policies or `approve_mission_ai_draft`, and this setting keeps that path closed. No M2 regression. |
| Minimum password length | `[auth] minimum_password_length` | `6` | Repo-controlled and reviewed. Local-dev default (Supabase CLI default), not raised for this project. Not an M2 regression — Milestone 1 already shipped with this value; M2 introduces no new credential surface. |
| Password strength requirements | `[auth] password_requirements` | `""` (none enforced) | Repo-controlled and reviewed. Same as above: pre-existing Milestone 1 posture, not changed or newly exposed by M2. |
| Site URL / redirect allow-list | `[auth] site_url`, `additional_redirect_urls` | `http://127.0.0.1:3000` / `["https://127.0.0.1:3000"]` | Reviewed. Local-loopback only; no production or hosted URL is present in this repo-controlled file. Correct for a repository that must never point local tooling at a hosted project (see `docs/acceptance/d3-ti-01-local-supabase-runbook.md` for the near-miss this exact posture prevents). |
| MFA (TOTP) | `[auth.mfa.totp] enroll_enabled`, `verify_enabled` | `false` / `false` | Repo-controlled and reviewed. Not enabled locally. M2 introduces no MFA-dependent flow, so this is not a regression; it is simply not configured, consistent with Milestone 1. |
| MFA (Phone) | `[auth.mfa.phone] enroll_enabled`, `verify_enabled` | `false` / `false` | Repo-controlled and reviewed. Not enabled. |
| MFA (WebAuthn) | `[auth.mfa.web_authn]` | commented out (absent) | Repo-controlled and reviewed. Not configured. |
| External OAuth providers | `[auth.external.*]` (apple, and every other provider the CLI template lists) | `enabled = false` for every provider present in the file; no provider block sets `enabled = true` | Reviewed exhaustively — every `[auth.external.*]` block was located and its `enabled` value read. None are enabled. No third-party identity provider is reachable in this environment. |
| Third-party auth (Firebase/Auth0/Cognito/Clerk) | `[auth.third_party.*]` | `enabled = false` for all four | Reviewed. None enabled. |
| Web3 (Solana) sign-in | `[auth.web3.solana]` | `enabled = false` | Reviewed. Not enabled. |
| OAuth server (dynamic client registration) | `[auth.oauth_server]` | `enabled = false` | Reviewed. Not enabled. |
| Auth Hooks — before user created | `[auth.hook.before_user_created]` | commented out (absent/disabled) | Reviewed. No hook intercepts user creation. |
| Auth Hooks — custom access token | `[auth.hook.custom_access_token]` | commented out (absent/disabled) | Reviewed. No hook injects custom JWT claims. This matters directly for M2: `auth.uid()` — the value every RLS policy and `approve_mission_ai_draft` trust — comes from GoTrue's own unmodified claim, not from a repo-defined hook that could be misconfigured to inject a spoofable claim. |
| SMS / Twilio | `[auth.sms]`, `[auth.sms.twilio]` | `enable_signup = false`, Twilio `enabled = false` | Reviewed. Not enabled, not applicable to M2. |
| Rate limits | `[auth.rate_limit]` | `email_sent = 2`, `sign_in_sign_ups = 30`, `token_refresh = 150`, `token_verifications = 30`, `anonymous_users = 30`, `web3 = 30` | Repo-controlled and reviewed. Local-dev defaults, unrelated to M2. |
| Captcha | `[auth.captcha]` | commented out (absent/disabled) | Reviewed. No captcha configured locally — expected for a local dev/test environment, not a production posture claim. |
| Session timeouts | `[auth.sessions]` (`timebox`, `inactivity_timeout`) | commented out (absent) | Reviewed. No forced session expiry configured locally. |

## Items that are NOT repo-controlled and are correctly NOT claimed as reviewed here

The following are real Auth-security concerns, but **`supabase/config.toml` has no key for them** — they are hosted GoTrue/Platform-level settings with no local-CLI representation in this Supabase CLI version. Per the advisor-scope decision, these are recorded as deferred, not silently skipped and not marked `PASS`:

- **Leaked Password Protection (HaveIBeenPwned check).** Confirmed absent from `supabase/config.toml` by direct inspection — there is no `[auth]`-level or `[auth.password]`-level key for it anywhere in this file. This is the same gap `docs/evidencia/2026-09-24-m2-canonical-conformance-decisions.md`'s predecessor acceptance record (`docs/acceptance/milestone-2.md`) already identified empirically via the local Security Advisor `run-lints` API, which returns zero `AUTH`-category findings locally. **Status: `DEFERRED TO DEPLOY MILESTONE`.**
- **MFA enrollment enforcement policy** (as opposed to whether the TOTP/Phone/WebAuthn *feature* is switched on locally, which is reviewed above) is a hosted project policy setting, not a `config.toml` key. **Status: `DEFERRED TO DEPLOY MILESTONE`.**
- **Hosted redirect/site URL allow-list** as it will exist against the real production domain is, by definition, not present in this repo (only the local-loopback value is). **Status: `DEFERRED TO DEPLOY MILESTONE`.**
- **JWT signing-key rotation/algorithm configuration** beyond `jwt_expiry` (e.g., asymmetric key rotation) is a hosted-project setting with no local `config.toml` representation in this CLI version. **Status: `DEFERRED TO DEPLOY MILESTONE`.**

No claim is made anywhere in this document, or in any other M2 evidence file, that the hosted Platform Advisor's Auth category was run. It was not, and the hosted project (`yljvselkecxdfrqwyums`) was not restored, queried, or mutated to produce this review.

## Result

**AUTH STATIC REVIEW: PASS** for every setting `supabase/config.toml` actually controls — every uncommented, applicable key in `[auth]` and its subsections was read and assessed above; none introduces a new M2 regression (M2 adds no auth surface, no new provider, no new hook, no relaxed setting relative to Milestone 1's existing posture).

**HOSTED AUTH ITEMS: DEFERRED TO DEPLOY MILESTONE = YES** — the four items above, and nothing else, remain genuinely out of reach from repo-controlled configuration.

**HOSTED PROJECT RESTORED: NO.**

This review required no local database and none was started for it. It is independent of, and does not substitute for, Block 2A (clean local replay) or Block 2B (local security/advisor-equivalent lint), which are recorded separately and, as of this evidence file's timestamp, are **HOLD** — see `docs/evidencia/2026-09-25-m2-local-security-advisor.md` for the exact blocker.

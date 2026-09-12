# D3-TI-01 — Local Supabase / RLS-E2E Runbook

**Project:** AI Showroom
**Repository:** `emanuelrendas/ai-showroom`
**Foundation branch:** `feature/milestone-1-foundation`
**Purpose:** repeatable local bootstrap and tenant-isolation verification without contacting or mutating the hosted AI Showroom Supabase project.

## 1. Scope and safety boundary

D3-TI-01 establishes an isolated local Supabase environment for AI Showroom RLS and tenant-isolation testing.

The procedure is local-only.

The hosted AI Showroom Supabase project is:

`yljvselkecxdfrqwyums`

That project must not be used as the test target during this procedure.

The procedure must not:

* apply migrations to a hosted Supabase project;
* execute DDL or DML against a hosted Supabase project;
* execute remote functions;
* modify hosted configuration;
* use production secrets as local test credentials;
* activate Milestone 2 or CANARY.

Milestone 2 and CANARY remain on HOLD independently of the result of this runbook.

## 2. Preconditions

Required locally:

* Docker Desktop running;
* Supabase CLI available;
* repository checked out on the authorized Foundation branch;
* clean Git working tree before test preparation;
* no unrelated writer operating on the same checkout.

Before starting, confirm the repository and branch:

```powershell
git status -sb
git rev-parse HEAD
```

Do not continue if the working tree contains unrelated changes.

## 3. Start the isolated local Supabase stack

Start Supabase from the AI Showroom repository using the local Supabase configuration.

```powershell
supabase start
supabase status
```

The environment must resolve to local endpoints only.

During the verified D3-TI-01 execution, the local Supabase services used the localhost development ports in the `54321`–`54323` range.

Do not substitute the hosted project URL for any local endpoint.

## 4. Prove target isolation before running tests

Before executing the RLS suite, verify that the test process is targeting the local Supabase instance.

The production project reference is:

`yljvselkecxdfrqwyums`

If that hosted project appears as the active target for the test process, stop.

The verified D3-TI-01 procedure preserved the existing `.env.test.local` file rather than modifying it to point at production or committing environment-specific credentials.

Any local test override must remain local to the test process and must not introduce production credentials into Git.

## 5. Local credential compatibility

Use credentials produced for the local Supabase instance.

Do not copy a production secret key into the local test environment.

If the test harness rejects the credential format, diagnose the expected key type before changing anything. The objective is compatibility between the local Supabase runtime and the test harness, not substitution with a hosted credential.

Credential changes used for local execution must remain ephemeral or local-only and must not be committed.

## 6. Apply the local migration chain

The local database must be reconstructed from the repository migration chain.

The historical migration:

`20260901152700_create_missing_rls_auto_enable_stub.sql`

exists in repository history as a compatibility stub.

The later parity work introduced the repository representation of the real `rls_auto_enable()` / `ensure_rls` mechanism after production drift was investigated.

Do not edit historical migrations as part of this runbook.

The purpose of this procedure is verification of the local reconstructed environment, not modification of production.

## 7. Run the tenant-isolation / RLS verification suite

Execute the authorized local RLS/E2E suite against the isolated local Supabase instance.

The verified D3-TI-01 result was:

**7 / 7 PASS**

The suite demonstrated the required tenant boundaries, including:

* authorized owner access;
* authorized workspace-member access;
* outsider read denial;
* outsider write denial for protected project/mission data;
* authorized conversation/message access;
* denial of cross-tenant access by direct identifier.

A failure in any isolation case is a FAIL-CLOSED result.

Do not weaken an RLS policy or test expectation merely to obtain a passing suite.

## 8. Validate that production was not contacted

After the run, retain evidence that:

* the test target was local;
* no hosted Supabase migrations were applied;
* no production DDL or DML was executed;
* no remote function was executed;
* no production secret was introduced into the test environment.

D3-TI-01 was accepted only because the isolation proof and the 7/7 result were both present.

## 9. Stop the local environment

When testing is complete:

```powershell
supabase stop
```

Confirm that the temporary local services are no longer required before ending the session.

Do not leave a local test runtime running merely because the tests passed.

## 10. Repository state after D3-TI-01

Relevant repository history:

* `f9f6352e2a15edda3658f3730fc16a688581e29f` — historical missing-stub restoration;
* PR #7 parity work reconciled the real `rls_auto_enable()` / `ensure_rls` mechanism into the Foundation branch;
* `2a01f41af0af4194dd85bdfaca76d5984a97c539` — Foundation branch state after PR #7 merge.

The stub already exists in the branch history. It must not be recreated or edited during this documentation closeout.

This runbook is documentation of the proven D3-TI-01 procedure only.

## 11. Exit criteria

D3-TI-01 local verification is reproducible when all of the following are true:

1. local Supabase starts successfully;
2. the test target is proven local and isolated from `yljvselkecxdfrqwyums`;
3. local-compatible credentials are used without production secrets;
4. the repository migration chain initializes locally;
5. the tenant-isolation suite passes 7/7;
6. no remote Supabase mutation or function execution occurs;
7. the local Supabase runtime is stopped after verification.

Failure to prove any required boundary results in HOLD / FAIL-CLOSED, not an inferred PASS.

---

**Governance state:** Foundation ACTIVE. Milestone 2 STRICT HOLD. CANARY HOLD.

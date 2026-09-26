import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// E2 (no shortcuts), E3 (tenant isolation), and E4 (mission window sealed,
// including the required mutation proof), per the 25 Sep 2026 M2 final
// acceptance dispatch, Block 3. None of these need a browser page -- they
// test the real REST/RLS/RPC boundary directly, the same boundary the app's
// own server actions use (see docs/evidencia/2026-09-25-m2-c1-missions-write-map.md
// for why this IS the real, reachable AI/server credential boundary, not an
// invented one). Playwright supports page-less tests natively; this keeps
// E2-E4 runnable in the same `npx playwright test` invocation as E1.
//
// This file also carries the C2 mutation proof (see
// docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md): the layered
// GREEN / RED-1 / RED-2 / RESTORE+GREEN sequence against the
// mission_ai_drafts defense-in-depth boundary (trigger + table-level CHECK,
// since migration 20260926130000) is the same boundary C2 requires, so
// running this file once satisfies both C2's mutation proof and Block 3's
// E2E mutation proof requirement.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Missing E2E Supabase environment variables.");
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};

const admin = createClient(supabaseUrl, secretKey, clientOptions);

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DISABLE_TRIGGER_SQL = path.join(
  REPO_ROOT,
  "scripts",
  "c2-mutation-proof",
  "disable-mission-ai-drafts-hitl-gate.sql",
);
const DISABLE_CHECK_SQL = path.join(
  REPO_ROOT,
  "scripts",
  "c2-mutation-proof",
  "disable-mission-ai-drafts-approval-check.sql",
);
const RESTORE_TRIGGER_SQL = path.join(
  REPO_ROOT,
  "scripts",
  "c2-mutation-proof",
  "restore-mission-ai-drafts-hitl-gate.sql",
);

function runSupabaseDbQueryFile(sqlFilePath: string): string {
  // execFileSync (not execSync/exec): the SQL file path is passed as a
  // literal argv entry, never interpolated into a shell string, so there is
  // no shell-quoting or injection surface here regardless of platform.
  //
  // npx ships as npx.cmd on Windows. Node's child_process cannot launch a
  // .cmd file directly via execFileSync/spawnSync -- .cmd/.bat files are not
  // executables on their own, they need cmd.exe as their interpreter, and
  // invoking one without it throws EINVAL before the process ever starts.
  // The two documented ways around that are shell: true, which reopens a
  // real shell-metacharacter injection surface for any future caller of
  // this function, or spawning cmd.exe directly and passing the .cmd file
  // as its argument, Node's own documented pattern for this exact case.
  // cmd.exe's /c parsing still applies to what follows, so this stays
  // injection-safe only because every argument below is a fixed,
  // repo-controlled literal, never externally supplied input -- the one
  // variable, sqlFilePath, is still passed as its own argv entry rather
  // than interpolated into a command string.
  const isWindows = process.platform === "win32";

  return execFileSync(
    isWindows ? "cmd.exe" : "npx",
    isWindows
      ? ["/c", "npx", "supabase", "db", "query", "--local", "--file", sqlFilePath]
      : ["supabase", "db", "query", "--local", "--file", sqlFilePath],
    { cwd: REPO_ROOT, encoding: "utf-8" },
  );
}

async function createTemporaryUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Unable to create temporary Auth user: ${error?.message ?? "unknown error"}`);
  }

  return data.user.id;
}

async function createSignedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, publishableKey!, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Unable to sign in temporary Auth user: ${error.message}`);
  }

  return client;
}

interface Fixture {
  runId: string;
  password: string;
  ownerEmail: string;
  memberEmail: string;
  outsiderEmail: string;
  ownerId: string;
  memberId: string;
  outsiderId: string;
  ownerClient: SupabaseClient;
  memberClient: SupabaseClient;
  outsiderClient: SupabaseClient;
  workspaceId: string;
  projectId: string;
  missionId: string;
}

async function buildFixture(): Promise<Fixture> {
  const runId = randomUUID().replaceAll("-", "");
  const password = `Test!${randomUUID()}Aa1`;

  const ownerEmail = `e2e-sec-owner-${runId}@example.com`;
  const memberEmail = `e2e-sec-member-${runId}@example.com`;
  const outsiderEmail = `e2e-sec-outsider-${runId}@example.com`;

  const ownerId = await createTemporaryUser(ownerEmail, password);
  const memberId = await createTemporaryUser(memberEmail, password);
  const outsiderId = await createTemporaryUser(outsiderEmail, password);

  const ownerClient = await createSignedInClient(ownerEmail, password);
  const memberClient = await createSignedInClient(memberEmail, password);
  const outsiderClient = await createSignedInClient(outsiderEmail, password);

  const workspaceResult = await ownerClient.rpc("create_workspace_with_owner", {
    p_name: `E2E Security Boundary ${runId}`,
    p_slug: `e2e-sec-${runId}`,
  });

  if (workspaceResult.error || !workspaceResult.data) {
    throw new Error(`Unable to create workspace: ${workspaceResult.error?.message}`);
  }
  const workspaceId = workspaceResult.data as string;

  const memberInsert = await ownerClient
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: memberId, role: "member" });
  if (memberInsert.error) {
    throw new Error(`Unable to add workspace member: ${memberInsert.error.message}`);
  }

  const projectResult = await ownerClient
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: `E2E Security Project ${runId}`,
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (projectResult.error || !projectResult.data) {
    throw new Error(`Unable to create project: ${projectResult.error?.message}`);
  }
  const projectId = projectResult.data.id;

  const missionResult = await ownerClient
    .from("missions")
    .insert({
      project_id: projectId,
      title: `E2E Security Mission ${runId}`,
      status: "todo",
      priority: "medium",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (missionResult.error || !missionResult.data) {
    throw new Error(`Unable to create mission: ${missionResult.error?.message}`);
  }
  const missionId = missionResult.data.id;

  return {
    runId,
    password,
    ownerEmail,
    memberEmail,
    outsiderEmail,
    ownerId,
    memberId,
    outsiderId,
    ownerClient,
    memberClient,
    outsiderClient,
    workspaceId,
    projectId,
    missionId,
  };
}

async function insertPendingDraft(fixture: Fixture) {
  const result = await fixture.memberClient
    .from("mission_ai_drafts")
    .insert({
      mission_id: fixture.missionId,
      project_id: fixture.projectId,
      workspace_id: fixture.workspaceId,
      schema_version: "1.0.0",
      summary: "E2E security-boundary fixture draft.",
      suggested_actions: ["Do not approve this in a real workflow."],
      confidence_score: 0.9,
      confidence_tier: "HIGH",
      created_by: fixture.memberId,
    })
    .select("id")
    .single();

  if (result.error || !result.data) {
    throw new Error(`Unable to insert draft fixture: ${result.error?.message ?? "unknown"}`);
  }

  return result.data.id as string;
}

async function teardownFixture(fixture: Fixture) {
  const del = await fixture.ownerClient.from("workspaces").delete().eq("id", fixture.workspaceId);
  if (del.error) {
    console.warn(`E2E security-boundary cleanup: workspace delete failed: ${del.error.message}`);
  }

  for (const userId of [fixture.ownerId, fixture.memberId, fixture.outsiderId]) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`E2E security-boundary cleanup: user delete failed: ${error.message}`);
    }
  }
}

test.describe("E2 — no shortcuts", () => {
  test("outsider cannot apply a draft via the RPC, direct spoofing UPDATE is refused, and missions cannot represent a fabricated AI-approved state", async () => {
    const fixture = await buildFixture();
    try {
      const draftId = await insertPendingDraft(fixture);

      // Non-approver (outsider, no workspace membership) cannot apply via RPC.
      const outsiderApprove = await fixture.outsiderClient.rpc("approve_mission_ai_draft", {
        p_draft_id: draftId,
      });
      expect(outsiderApprove.error).not.toBeNull();

      // Direct client UPDATE from the real authenticated/publishable boundary
      // attempting to PATCH approval status and fabricate approved_by/approved_at
      // is refused by RLS's WITH CHECK clause before the trigger even runs.
      const spoofAttempt = await fixture.memberClient
        .from("mission_ai_drafts")
        .update({
          status: "applied",
          approved_by: fixture.memberId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", draftId);
      expect(spoofAttempt.error).not.toBeNull();

      // No direct Mission mutation can bypass the approved flow by
      // representing an "AI-approved" final state on missions itself: under
      // the ratified Option B architecture, public.missions has no
      // is_ai_generated/approved_by/approved_at columns at all, and its
      // status CHECK constraint does not even include "applied" as a legal
      // value (only todo|in_progress|blocked|done|cancelled). This is
      // structural proof, not merely a permissions proof -- there is no
      // AI-approval-shaped state for anyone to fabricate on this table.
      const missionSpoof = await fixture.memberClient
        .from("missions")
        .update({ status: "applied" })
        .eq("id", fixture.missionId);
      expect(missionSpoof.error).not.toBeNull();
      expect(missionSpoof.error?.message ?? "").toMatch(/check constraint|missions_status_check/i);
    } finally {
      await teardownFixture(fixture);
    }
  });
});

test.describe("E3 — tenant isolation", () => {
  test("a user outside the workspace cannot see the Mission, mission_ai_drafts, or inference_logs, and cannot approve or mutate the draft", async () => {
    const fixture = await buildFixture();
    try {
      const draftId = await insertPendingDraft(fixture);

      // Simulate an inference_logs row for this mission (the row a real
      // generation call would have written) so E3 can assert isolation on
      // all three tables, not just two.
      const logInsert = await admin.from("inference_logs").insert({
        workspace_id: fixture.workspaceId,
        project_id: fixture.projectId,
        mission_id: fixture.missionId,
        task_type: "summarize",
        status: "success",
        prompt_tokens: 10,
        completion_tokens: 10,
        total_tokens: 20,
        model_identifier: "deterministic-stub-v1",
        latency_ms: 5,
        cost_usd_micros: 10,
        failure_reason: null,
      });
      expect(logInsert.error).toBeNull();

      // Real RLS, not UI hiding: every assertion below is a direct
      // supabase-js call against the outsider's own authenticated session.
      const missionRead = await fixture.outsiderClient
        .from("missions")
        .select("id")
        .eq("id", fixture.missionId);
      expect(missionRead.error).toBeNull();
      expect(missionRead.data).toHaveLength(0);

      const draftRead = await fixture.outsiderClient
        .from("mission_ai_drafts")
        .select("id")
        .eq("id", draftId);
      expect(draftRead.error).toBeNull();
      expect(draftRead.data).toHaveLength(0);

      const logRead = await fixture.outsiderClient
        .from("inference_logs")
        .select("id")
        .eq("mission_id", fixture.missionId);
      expect(logRead.error).toBeNull();
      expect(logRead.data).toHaveLength(0);

      const outsiderApprove = await fixture.outsiderClient.rpc("approve_mission_ai_draft", {
        p_draft_id: draftId,
      });
      expect(outsiderApprove.error).not.toBeNull();

      const outsiderDismiss = await fixture.outsiderClient
        .from("mission_ai_drafts")
        .update({ status: "dismissed" })
        .eq("id", draftId);
      // RLS silently matches zero rows for an outsider rather than erroring;
      // the meaningful assertion is that the row is provably unaffected.
      const readBack = await fixture.memberClient
        .from("mission_ai_drafts")
        .select("status")
        .eq("id", draftId)
        .single();
      expect(readBack.data?.status).toBe("pending_review");
      void outsiderDismiss;
    } finally {
      await teardownFixture(fixture);
    }
  });
});

test.describe("E4 — mission window sealed", () => {
  test("direct public.missions mutation to a non-mission status is rejected by the M1 status CHECK constraint, not by access control", async () => {
    const fixture = await buildFixture();
    try {
      // Same client construction as lib/supabase/server.ts (publishable key,
      // real signed-in session) -- the exact boundary C1 identified as the
      // only one the M2 AI generation flow ever uses. No invented role.
      //
      // What this actually proves, corrected 26 Sep 2026 per the independent
      // pre-merge audit (claude/2026-09-26-m2-pre-merge-audit.md, Section 4,
      // finding 4/"the test's label overclaims"): "applied" is not a valid
      // `missions.status` value under M1's `missions_status_check` CHECK
      // constraint ('todo', 'in_progress', 'blocked', 'done', 'cancelled'),
      // so the rejection below comes from that CHECK, not from RLS/access
      // control -- `missions_update_member` still lets any workspace member
      // update a mission to any valid status, which is M1 behaviour and is
      // unchanged and untouched by M2. The guarantee this test's name used to
      // claim -- that the AI flow cannot reach an "applied" mission state --
      // is actually carried by C1 (docs/evidencia/2026-09-25-m2-c1-missions-write-map.md):
      // the AI/server code path never calls this update at all. This test
      // still documents real, useful behaviour (a member cannot force a
      // mission into a status the schema does not define), it just is not
      // the HITL/access-control boundary its old name implied.
      const attempt = await fixture.memberClient
        .from("missions")
        .update({ status: "applied" })
        .eq("id", fixture.missionId);

      expect(attempt.error).not.toBeNull();

      const readBack = await fixture.ownerClient
        .from("missions")
        .select("status")
        .eq("id", fixture.missionId)
        .single();
      expect(readBack.data?.status).toBe("todo");
    } finally {
      await teardownFixture(fixture);
    }
  });

  test("mutation proof — mission_ai_drafts defense-in-depth (layered): GREEN baseline, RED-1 (CHECK alone), RED-2 (both gone), RESTORE + GREEN", async () => {
    // Layered design per Emanuel's selected Option 1 (see the 26 Sep 2026
    // Option B delta re-audit, claude/2026-09-26-m2-option-b-delta-reaudit.md,
    // finding F1, and docs/evidencia/2026-09-25-m2-c2-missions-mutation-proof.md,
    // "25 Sep -> 26 Sep addendum"). After migration 20260926130000, the
    // boundary against a forged 'applied' transition from a privileged
    // (service-role) writer is defense-in-depth, not a single mechanism:
    // the BEFORE INSERT OR UPDATE trigger, and the table-level CHECK
    // constraint, each independently reject the forged transition. The old
    // single-layer RED/GREEN proof is no longer reachable as written (the
    // CHECK now catches what the trigger used to catch alone), so this test
    // isolates each layer in turn instead of disabling only one and
    // expecting success.
    const fixture = await buildFixture();
    let stackMutated = false;

    try {
      // --- GREEN (baseline): both protections active, spoofing attempt is
      // rejected by the trigger (it fires BEFORE the row is written, so the
      // CHECK is never reached here). ---
      const draftIdGreenBaseline = await insertPendingDraft(fixture);
      const greenBaseline = await admin
        .from("mission_ai_drafts")
        .update({ status: "applied" }) // no approved_by/approved_at
        .eq("id", draftIdGreenBaseline);
      expect(greenBaseline.error).not.toBeNull();
      expect(greenBaseline.error?.message ?? "").toMatch(/approved_by and approved_at/i);

      // --- RED-1: drop ONLY the trigger, on the local/disposable database.
      // The same forged transition must STILL be rejected, but now
      // specifically by mission_ai_drafts_approval_state_check, proving the
      // CHECK is independently load-bearing -- not merely present alongside
      // the trigger, but itself sufficient on its own. ---
      runSupabaseDbQueryFile(DISABLE_TRIGGER_SQL);
      stackMutated = true;

      const draftIdRed1 = await insertPendingDraft(fixture);
      const red1Result = await admin
        .from("mission_ai_drafts")
        .update({ status: "applied" }) // still no approved_by/approved_at
        .eq("id", draftIdRed1);
      expect(red1Result.error).not.toBeNull(); // RED-1: still rejected...
      expect(red1Result.error?.message ?? "").toMatch(/approval_state_check/i); // ...by the CHECK

      const red1ReadBack = await admin
        .from("mission_ai_drafts")
        .select("status")
        .eq("id", draftIdRed1)
        .single();
      expect(red1ReadBack.data?.status).toBe("pending_review"); // write never landed

      // --- RED-2: also drop the CHECK, on top of RED-1's already-dropped
      // trigger. With BOTH protections gone, the same forged transition
      // must now SUCCEED, proving the trigger and the CHECK -- not RLS
      // (bypassed by service_role by construction, so RLS was never in play
      // in this test), not app code, not coincidence -- are exactly what
      // stood between service_role and a forged 'applied' row. ---
      runSupabaseDbQueryFile(DISABLE_CHECK_SQL);

      const draftIdRed2 = await insertPendingDraft(fixture);
      const red2Result = await admin
        .from("mission_ai_drafts")
        .update({ status: "applied" }) // still no approved_by/approved_at
        .eq("id", draftIdRed2);
      expect(red2Result.error).toBeNull(); // RED-2: this must now succeed

      const red2ReadBack = await admin
        .from("mission_ai_drafts")
        .select("status, approved_by, approved_at")
        .eq("id", draftIdRed2)
        .single();
      expect(red2ReadBack.data?.status).toBe("applied");
      expect(red2ReadBack.data?.approved_by).toBeNull();
      expect(red2ReadBack.data?.approved_at).toBeNull();

      // RESTORE (below) re-adds mission_ai_drafts_approval_state_check,
      // which validates every existing row by default -- and this row was
      // just deliberately forged into exactly the state that CHECK forbids
      // (status='applied' with null approvals), by design, to prove RED-2.
      // Left in place, ADD CONSTRAINT would fail with "check constraint ...
      // is violated by some row" and the restoration itself would never
      // complete. Delete this disposable fixture row (workspace teardown
      // would remove it anyway) before restoring, exactly as a real
      // deploy runbook must also sweep any row an old, unpatched trigger
      // let through before applying this migration (see finding F5, this
      // migration's own pre-deploy check query).
      const red2Cleanup = await admin.from("mission_ai_drafts").delete().eq("id", draftIdRed2);
      expect(red2Cleanup.error).toBeNull();

      // --- RESTORE: recreate both protections in one deterministic pass
      // (trigger BEFORE INSERT OR UPDATE, CHECK re-added). ---
      runSupabaseDbQueryFile(RESTORE_TRIGGER_SQL);
      stackMutated = false;

      // --- GREEN (after restoration), via UPDATE: the same spoofing
      // attempt is rejected again, by the trigger, exactly as the original
      // baseline. ---
      const draftIdGreenRestored = await insertPendingDraft(fixture);
      const greenRestored = await admin
        .from("mission_ai_drafts")
        .update({ status: "applied" })
        .eq("id", draftIdGreenRestored);
      expect(greenRestored.error).not.toBeNull();
      expect(greenRestored.error?.message ?? "").toMatch(/approved_by and approved_at/i);

      // --- GREEN (after restoration), via INSERT: proves the restored
      // trigger is bound BEFORE INSERT OR UPDATE, not BEFORE UPDATE only --
      // a direct INSERT landing straight on 'applied' with null approval
      // fields must be rejected too, the same way the pre-20260926130000
      // trigger left this path completely open (finding 4e). ---
      const insertSpoof = await admin
        .from("mission_ai_drafts")
        .insert({
          mission_id: fixture.missionId,
          project_id: fixture.projectId,
          workspace_id: fixture.workspaceId,
          schema_version: "1.0.0",
          summary: "RESTORE INSERT-path spoof attempt.",
          suggested_actions: ["Should never be reachable."],
          confidence_score: 0.5,
          confidence_tier: "LOW",
          created_by: fixture.memberId,
          status: "applied", // forged directly at INSERT time, no approvals
        });
      expect(insertSpoof.error).not.toBeNull();
      expect(insertSpoof.error?.message ?? "").toMatch(/approved_by and approved_at/i);
    } finally {
      // Fail-safe: if any assertion above threw while the trigger and/or
      // CHECK were disabled, restore both before this test process exits,
      // regardless of what happened or how far RED-1/RED-2 got. The restore
      // script is idempotent from any of GREEN, RED-1, or RED-2 state.
      // Never leave the local database in a mutated state.
      if (stackMutated) {
        try {
          runSupabaseDbQueryFile(RESTORE_TRIGGER_SQL);
        } catch (restoreError) {
          console.error(
            "CRITICAL: failed to restore mission_ai_drafts_enforce_hitl_gate " +
              "and/or mission_ai_drafts_approval_state_check after a failed " +
              "mutation-proof run. Restore manually before doing anything " +
              "else: npx supabase db query --local --file " +
              `${RESTORE_TRIGGER_SQL}. Underlying error: ${restoreError}`,
          );
          throw restoreError;
        }
      }

      await teardownFixture(fixture);
    }
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Canonical Section 6 telemetry boundary: public.inference_logs.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Missing required Supabase RLS test environment variables.");
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

// Service-role client: bypasses RLS the same way the platform's service key
// would. Used specifically to prove the append-only trigger is a database
// boundary, not merely an RLS/grant restriction an elevated caller could
// route around.
const admin = createClient(supabaseUrl, secretKey, clientOptions);

const runId = randomUUID().replaceAll("-", "");
const password = `Test!${randomUUID()}Aa1`;

const ownerEmail = `ai-log-owner-${runId}@example.com`;
const memberEmail = `ai-log-member-${runId}@example.com`;
const outsiderEmail = `ai-log-outsider-${runId}@example.com`;

let ownerId = "";
let memberId = "";
let outsiderId = "";

let workspaceId = "";
let projectId = "";
let missionId = "";
let logId = "";

let ownerClient: SupabaseClient;
let memberClient: SupabaseClient;
let outsiderClient: SupabaseClient;

async function createTemporaryUser(email: string) {
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

async function createSignedInClient(email: string) {
  const client = createClient(supabaseUrl!, publishableKey!, clientOptions);

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Unable to sign in temporary Auth user: ${error.message}`);
  }

  return client;
}

const modelIdentifierMarker = `test-model-${runId}`;

function validLogPayload() {
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    mission_id: missionId,
    task_type: "summarize",
    status: "success",
    prompt_tokens: 120,
    completion_tokens: 80,
    total_tokens: 200,
    model_identifier: modelIdentifierMarker,
    latency_ms: 842,
    cost_usd_micros: 5_000,
    failure_reason: null,
  };
}

describe("inference_logs — persistence, RLS, and append-only enforcement", () => {
  beforeAll(async () => {
    ownerId = await createTemporaryUser(ownerEmail);
    memberId = await createTemporaryUser(memberEmail);
    outsiderId = await createTemporaryUser(outsiderEmail);

    ownerClient = await createSignedInClient(ownerEmail);
    memberClient = await createSignedInClient(memberEmail);
    outsiderClient = await createSignedInClient(outsiderEmail);

    const workspaceSlug = `ai-log-${runId}`;

    const workspaceResult = await ownerClient.rpc("create_workspace_with_owner", {
      p_name: `AI Log Workspace ${runId}`,
      p_slug: workspaceSlug,
    });

    if (workspaceResult.error || !workspaceResult.data) {
      throw new Error(
        `Unable to create workspace: ${workspaceResult.error?.message ?? "unknown error"}`,
      );
    }

    workspaceId = workspaceResult.data as string;

    const memberInsert = await ownerClient.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: memberId,
      role: "member",
    });

    if (memberInsert.error) {
      throw new Error(`Unable to add workspace member: ${memberInsert.error.message}`);
    }

    const projectResult = await ownerClient
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: `AI Log Project ${runId}`,
        description: "Temporary project for inference_logs verification.",
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (projectResult.error || !projectResult.data) {
      throw new Error(
        `Unable to create project: ${projectResult.error?.message ?? "unknown error"}`,
      );
    }

    projectId = projectResult.data.id;

    const missionResult = await ownerClient
      .from("missions")
      .insert({
        project_id: projectId,
        title: `AI Log Mission ${runId}`,
        description: "Temporary mission for inference_logs verification.",
        status: "todo",
        priority: "medium",
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (missionResult.error || !missionResult.data) {
      throw new Error(
        `Unable to create mission: ${missionResult.error?.message ?? "unknown error"}`,
      );
    }

    missionId = missionResult.data.id;
  });

  afterAll(async () => {
    // Intentionally does not delete the workspace/project/mission: once an
    // inference_logs row exists against them, ON DELETE RESTRICT (see the
    // migration) makes that deletion fail by design. The workspace is left
    // behind in this disposable test project.
    //
    // Consequence: deleting the owner's Auth user cascades to their `profiles`
    // row, but `workspaces.created_by` still references that profile (no
    // cascade on that FK either), so the delete is rejected. This is not a
    // bug to work around -- it is the immutable-audit-trail guarantee (the
    // append-only trigger plus RESTRICT) holding even against test cleanup.
    // Caught and logged, not swallowed silently and not re-thrown: a failed
    // cleanup here is expected for the owner specifically, not a signal that
    // something is wrong.
    for (const userId of [ownerId, memberId, outsiderId]) {
      if (!userId) continue;

      try {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
      } catch (error) {
        console.warn(
          `Expected cleanup residue: unable to delete temporary Auth user ${userId} ` +
            `(likely the workspace owner, blocked by inference_logs' RESTRICT + ` +
            `append-only guarantee): ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  });

  it("allows a workspace member to insert a log row", async () => {
    // No .select() here: RETURNING is itself subject to the table's SELECT
    // policy (admin-only, see below), so a plain member's insert would
    // otherwise look like it silently returned zero rows despite succeeding.
    const result = await memberClient.from("inference_logs").insert(validLogPayload());

    expect(result.error).toBeNull();
  });

  it("lets the workspace owner locate the inserted row by its unique marker", async () => {
    const result = await ownerClient
      .from("inference_logs")
      .select("id")
      .eq("model_identifier", modelIdentifierMarker)
      .single();

    expect(result.error).toBeNull();
    expect(result.data?.id).toBeTruthy();

    logId = result.data!.id as string;
  });

  it("blocks an outsider from inserting a log row for a foreign workspace", async () => {
    const result = await outsiderClient.from("inference_logs").insert(validLogPayload());

    expect(result.error).not.toBeNull();
  });

  it("allows a workspace owner (admin role) to read the log row", async () => {
    const result = await ownerClient.from("inference_logs").select("id").eq("id", logId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it("hides the log row from a plain member (select is admin-only, per Section 6.5)", async () => {
    const result = await memberClient.from("inference_logs").select("id").eq("id", logId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("hides the log row from an outsider entirely", async () => {
    const result = await outsiderClient.from("inference_logs").select("id").eq("id", logId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("rejects an UPDATE from the workspace owner (no grant, and the append-only trigger)", async () => {
    const result = await ownerClient
      .from("inference_logs")
      .update({ status: "failed" })
      .eq("id", logId);

    expect(result.error).not.toBeNull();
  });

  it("rejects a DELETE from the workspace owner (no grant, and the append-only trigger)", async () => {
    const result = await ownerClient.from("inference_logs").delete().eq("id", logId);

    expect(result.error).not.toBeNull();
  });

  it("rejects a direct UPDATE from the service-role client, proving the trigger is a real database boundary", async () => {
    const result = await admin
      .from("inference_logs")
      .update({ status: "failed" })
      .eq("id", logId);

    expect(result.error).not.toBeNull();
    expect(result.error?.message ?? "").toMatch(/append-only/i);
  });

  it("rejects a direct DELETE from the service-role client, proving the trigger is a real database boundary", async () => {
    const result = await admin.from("inference_logs").delete().eq("id", logId);

    expect(result.error).not.toBeNull();
    expect(result.error?.message ?? "").toMatch(/append-only/i);
  });

  it("confirms the log row is unchanged after every rejected mutation attempt", async () => {
    const result = await admin.from("inference_logs").select("status").eq("id", logId).single();

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("success");
  });

  it("blocks deleting the parent mission once a log row references it (ON DELETE RESTRICT)", async () => {
    const result = await ownerClient.from("missions").delete().eq("id", missionId);

    expect(result.error).not.toBeNull();
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

// Service-role client: bypasses RLS entirely. Used to prove the append-only
// HITL gate is a real database boundary (the BEFORE UPDATE trigger), not
// merely an RLS restriction an elevated caller could route around.
const admin = createClient(supabaseUrl, secretKey, clientOptions);

const runId = randomUUID().replaceAll("-", "");
const password = `Test!${randomUUID()}Aa1`;

const ownerEmail = `ai-draft-owner-${runId}@example.com`;
const memberEmail = `ai-draft-member-${runId}@example.com`;
const outsiderEmail = `ai-draft-outsider-${runId}@example.com`;

let ownerId = "";
let memberId = "";
let outsiderId = "";

let workspaceId = "";
let projectId = "";
let missionId = "";

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

function validDraftPayload() {
  return {
    mission_id: missionId,
    project_id: projectId,
    workspace_id: workspaceId,
    schema_version: "1.0.0",
    summary: "The mission is on track.",
    suggested_actions: ["Follow up with the reviewer", "Update the draft"],
    confidence_score: 0.92,
    confidence_tier: "HIGH",
    created_by: memberId,
  };
}

async function insertPendingDraft() {
  const result = await memberClient
    .from("mission_ai_drafts")
    .insert(validDraftPayload())
    .select("id")
    .single();

  if (result.error || !result.data) {
    throw new Error(`Unable to insert draft fixture: ${result.error?.message ?? "unknown error"}`);
  }

  return result.data.id as string;
}

describe("mission_ai_drafts — persistence, RLS, and Section 4.4 HITL gate", () => {
  beforeAll(async () => {
    ownerId = await createTemporaryUser(ownerEmail);
    memberId = await createTemporaryUser(memberEmail);
    outsiderId = await createTemporaryUser(outsiderEmail);

    ownerClient = await createSignedInClient(ownerEmail);
    memberClient = await createSignedInClient(memberEmail);
    outsiderClient = await createSignedInClient(outsiderEmail);

    const workspaceSlug = `ai-draft-${runId}`;

    const workspaceResult = await ownerClient.rpc("create_workspace_with_owner", {
      p_name: `AI Draft Workspace ${runId}`,
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
        name: `AI Draft Project ${runId}`,
        description: "Temporary project for mission_ai_drafts verification.",
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
        title: `AI Draft Mission ${runId}`,
        description: "Temporary mission for mission_ai_drafts verification.",
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
    // Cascade cleanup is fine here: mission_ai_drafts uses ON DELETE CASCADE
    // (unlike ai_inference_logs, which uses RESTRICT). Deleting the workspace
    // is expected to succeed and take everything else with it.
    if (workspaceId) {
      const { error } = await ownerClient.from("workspaces").delete().eq("id", workspaceId);

      if (error) {
        throw new Error(`Unable to clean up temporary workspace: ${error.message}`);
      }
    }

    for (const userId of [ownerId, memberId, outsiderId]) {
      if (!userId) continue;

      const { error } = await admin.auth.admin.deleteUser(userId);

      if (error) {
        throw new Error(`Unable to clean up temporary Auth user: ${error.message}`);
      }
    }
  });

  it("allows a workspace member to insert a pending_review draft", async () => {
    const result = await memberClient
      .from("mission_ai_drafts")
      .insert(validDraftPayload())
      .select("id, status")
      .single();

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe("pending_review");
  });

  it("blocks an outsider from inserting a draft for a foreign workspace", async () => {
    const result = await outsiderClient.from("mission_ai_drafts").insert(validDraftPayload());

    expect(result.error).not.toBeNull();
  });

  it("lets any workspace member (not just the owner) read drafts in their workspace", async () => {
    const draftId = await insertPendingDraft();

    const ownerRead = await ownerClient.from("mission_ai_drafts").select("id").eq("id", draftId);
    const memberRead = await memberClient
      .from("mission_ai_drafts")
      .select("id")
      .eq("id", draftId);

    expect(ownerRead.error).toBeNull();
    expect(ownerRead.data).toHaveLength(1);
    expect(memberRead.error).toBeNull();
    expect(memberRead.data).toHaveLength(1);
  });

  it("hides drafts from an outsider entirely", async () => {
    const draftId = await insertPendingDraft();

    const result = await outsiderClient.from("mission_ai_drafts").select("id").eq("id", draftId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  it("rejects a direct client attempt to self-approve (spoofing approved_by/approved_at)", async () => {
    const draftId = await insertPendingDraft();

    const result = await memberClient
      .from("mission_ai_drafts")
      .update({
        status: "applied",
        approved_by: memberId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    expect(result.error).not.toBeNull();
  });

  it("allows a member to dismiss their own pending draft directly", async () => {
    const draftId = await insertPendingDraft();

    const updateResult = await memberClient
      .from("mission_ai_drafts")
      .update({ status: "dismissed" })
      .eq("id", draftId);

    expect(updateResult.error).toBeNull();

    const readBack = await memberClient
      .from("mission_ai_drafts")
      .select("status")
      .eq("id", draftId)
      .single();

    expect(readBack.data?.status).toBe("dismissed");
  });

  it("rejects approval from an outsider via the RPC", async () => {
    const draftId = await insertPendingDraft();

    const result = await outsiderClient.rpc("approve_mission_ai_draft", {
      p_draft_id: draftId,
    });

    expect(result.error).not.toBeNull();
  });

  it("approves a pending draft through approve_mission_ai_draft and stamps approved_by/approved_at", async () => {
    const draftId = await insertPendingDraft();

    const approveResult = await memberClient.rpc("approve_mission_ai_draft", {
      p_draft_id: draftId,
    });

    expect(approveResult.error).toBeNull();

    const readBack = await memberClient
      .from("mission_ai_drafts")
      .select("status, approved_by, approved_at")
      .eq("id", draftId)
      .single();

    expect(readBack.error).toBeNull();
    expect(readBack.data?.status).toBe("applied");
    expect(readBack.data?.approved_by).toBe(memberId);
    expect(readBack.data?.approved_at).not.toBeNull();
  });

  it("rejects re-approving a draft that is no longer pending_review", async () => {
    const draftId = await insertPendingDraft();

    const first = await memberClient.rpc("approve_mission_ai_draft", { p_draft_id: draftId });
    expect(first.error).toBeNull();

    const second = await memberClient.rpc("approve_mission_ai_draft", { p_draft_id: draftId });
    expect(second.error).not.toBeNull();
  });

  it("silently leaves an already-applied draft unchanged under a direct client UPDATE", async () => {
    const draftId = await insertPendingDraft();

    const approve = await memberClient.rpc("approve_mission_ai_draft", { p_draft_id: draftId });
    expect(approve.error).toBeNull();

    await memberClient
      .from("mission_ai_drafts")
      .update({ summary: "attempted post-approval edit" })
      .eq("id", draftId);

    const readBack = await memberClient
      .from("mission_ai_drafts")
      .select("summary")
      .eq("id", draftId)
      .single();

    expect(readBack.data?.summary).toBe(validDraftPayload().summary);
  });

  it("rejects a direct service-role UPDATE to 'applied' without approved_by/approved_at, proving the trigger is a real database boundary", async () => {
    const draftId = await insertPendingDraft();

    const result = await admin.from("mission_ai_drafts").update({ status: "applied" }).eq(
      "id",
      draftId,
    );

    expect(result.error).not.toBeNull();
    expect(result.error?.message ?? "").toMatch(/approved_by and approved_at/i);
  });

  it("allows a direct service-role UPDATE to 'applied' when approved_by/approved_at are both provided", async () => {
    const draftId = await insertPendingDraft();

    const result = await admin
      .from("mission_ai_drafts")
      .update({
        status: "applied",
        approved_by: ownerId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    expect(result.error).toBeNull();

    const readBack = await admin
      .from("mission_ai_drafts")
      .select("status")
      .eq("id", draftId)
      .single();

    expect(readBack.data?.status).toBe("applied");
  });
});

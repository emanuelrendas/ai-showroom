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

const admin = createClient(supabaseUrl, secretKey, clientOptions);

const runId = randomUUID().replaceAll("-", "");
const password = `Test!${randomUUID()}Aa1`;

const ownerEmail = `rls-owner-${runId}@example.com`;
const memberEmail = `rls-member-${runId}@example.com`;
const outsiderEmail = `rls-outsider-${runId}@example.com`;

let ownerId = "";
let memberId = "";
let outsiderId = "";

let workspaceId = "";
let projectId = "";
let missionId = "";
let conversationId = "";
let messageId = "";

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

describe("Milestone 1 RLS isolation", () => {
  beforeAll(async () => {
    ownerId = await createTemporaryUser(ownerEmail);
    memberId = await createTemporaryUser(memberEmail);
    outsiderId = await createTemporaryUser(outsiderEmail);

    ownerClient = await createSignedInClient(ownerEmail);
    memberClient = await createSignedInClient(memberEmail);
    outsiderClient = await createSignedInClient(outsiderEmail);

    const workspaceSlug = `rls-${runId}`;

    const workspaceResult = await ownerClient.rpc(
      "create_workspace_with_owner",
      {
        p_name: `RLS Workspace ${runId}`,
        p_slug: workspaceSlug,
      },
    );

    if (workspaceResult.error || !workspaceResult.data) {
      throw new Error(
        `Unable to create RLS workspace: ${workspaceResult.error?.message ?? "unknown error"}`,
      );
    }

    workspaceId = workspaceResult.data as string;

    const memberInsert = await ownerClient
      .from("workspace_members")
      .insert({
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
        name: `RLS Project ${runId}`,
        description: "Temporary project for RLS verification.",
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (projectResult.error || !projectResult.data) {
      throw new Error(
        `Unable to create RLS project: ${projectResult.error?.message ?? "unknown error"}`,
      );
    }

    projectId = projectResult.data.id;

    const missionResult = await ownerClient
      .from("missions")
      .insert({
        project_id: projectId,
        title: `RLS Mission ${runId}`,
        description: "Temporary mission for RLS verification.",
        status: "todo",
        priority: "medium",
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (missionResult.error || !missionResult.data) {
      throw new Error(
        `Unable to create RLS mission: ${missionResult.error?.message ?? "unknown error"}`,
      );
    }

    missionId = missionResult.data.id;

    const conversationResult = await ownerClient
      .from("conversations")
      .insert({
        workspace_id: workspaceId,
        mission_id: missionId,
        title: `RLS Conversation ${runId}`,
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (conversationResult.error || !conversationResult.data) {
      throw new Error(
        `Unable to create RLS conversation: ${conversationResult.error?.message ?? "unknown error"}`,
      );
    }

    conversationId = conversationResult.data.id;

    const messageResult = await ownerClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: "Temporary RLS verification message.",
      })
      .select("id")
      .single();

    if (messageResult.error || !messageResult.data) {
      throw new Error(
        `Unable to create RLS message: ${messageResult.error?.message ?? "unknown error"}`,
      );
    }

    messageId = messageResult.data.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      const { error } = await ownerClient
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);

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

  it("allows the owner to read workspace, project, and mission", async () => {
    const ownerWorkspace = await ownerClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId);

    const ownerProject = await ownerClient
      .from("projects")
      .select("id")
      .eq("id", projectId);

    const ownerMission = await ownerClient
      .from("missions")
      .select("id")
      .eq("id", missionId);

    expect(ownerWorkspace.error).toBeNull();
    expect(ownerWorkspace.data).toHaveLength(1);
    expect(ownerProject.error).toBeNull();
    expect(ownerProject.data).toHaveLength(1);
    expect(ownerMission.error).toBeNull();
    expect(ownerMission.data).toHaveLength(1);
  });

  it("allows a workspace member to read workspace, project, and mission", async () => {
    const memberWorkspace = await memberClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId);

    const memberProject = await memberClient
      .from("projects")
      .select("id")
      .eq("id", projectId);

    const memberMission = await memberClient
      .from("missions")
      .select("id")
      .eq("id", missionId);

    expect(memberWorkspace.error).toBeNull();
    expect(memberWorkspace.data).toHaveLength(1);
    expect(memberProject.error).toBeNull();
    expect(memberProject.data).toHaveLength(1);
    expect(memberMission.error).toBeNull();
    expect(memberMission.data).toHaveLength(1);
  });

  it("hides workspace, project, and mission from an outsider", async () => {
    const outsiderWorkspace = await outsiderClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId);

    const outsiderProject = await outsiderClient
      .from("projects")
      .select("id")
      .eq("id", projectId);

    const outsiderMission = await outsiderClient
      .from("missions")
      .select("id")
      .eq("id", missionId);

    expect(outsiderWorkspace.error).toBeNull();
    expect(outsiderWorkspace.data).toHaveLength(0);
    expect(outsiderProject.error).toBeNull();
    expect(outsiderProject.data).toHaveLength(0);
    expect(outsiderMission.error).toBeNull();
    expect(outsiderMission.data).toHaveLength(0);
  });

  it("blocks outsider project and mission creation", async () => {
    const outsiderProjectInsert = await outsiderClient
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: `Blocked Project ${runId}`,
        description: null,
        created_by: outsiderId,
      });

    const outsiderMissionInsert = await outsiderClient
      .from("missions")
      .insert({
        project_id: projectId,
        title: `Blocked Mission ${runId}`,
        description: null,
        status: "todo",
        priority: "medium",
        created_by: outsiderId,
      });

    expect(outsiderProjectInsert.error).not.toBeNull();
    expect(outsiderMissionInsert.error).not.toBeNull();
  });

  it("allows a member to read the conversation and message", async () => {
    const memberConversation = await memberClient
      .from("conversations")
      .select("id")
      .eq("id", conversationId);

    const memberMessage = await memberClient
      .from("messages")
      .select("id")
      .eq("id", messageId);

    expect(memberConversation.error).toBeNull();
    expect(memberConversation.data).toHaveLength(1);
    expect(memberMessage.error).toBeNull();
    expect(memberMessage.data).toHaveLength(1);
  });

  it("hides the conversation from an outsider by direct ID", async () => {
    const outsiderConversation = await outsiderClient
      .from("conversations")
      .select("id")
      .eq("id", conversationId);

    expect(outsiderConversation.error).toBeNull();
    expect(outsiderConversation.data).toHaveLength(0);
  });

  it("hides the message from an outsider by direct ID", async () => {
    const outsiderMessage = await outsiderClient
      .from("messages")
      .select("id")
      .eq("id", messageId);

    expect(outsiderMessage.error).toBeNull();
    expect(outsiderMessage.data).toHaveLength(0);
  });
});

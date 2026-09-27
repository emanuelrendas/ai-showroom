"use server";

import { revalidatePath } from "next/cache";
import { getMissionById } from "@/features/missions/queries";
import { getProjectById } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { createClient } from "@/lib/supabase/server";
import { approveMissionAiDraft, dismissMissionAiDraft } from "./draft-mutations";
import { generateMissionAiDraft } from "./generate-mission-ai-draft";
import { InferenceExecutionWrapper, TASK_TYPES, type TaskType } from "./inference-wrapper";
import { SupabaseInferenceLogWriter } from "./inference-log-supabase-adapter";
import { SupabaseMissionAiDraftWriter } from "./mission-ai-draft-writer";
import { getCostEstimator, getModelProviderAdapter, getPromptTemplates } from "./provider";

export type MissionAiDraftActionState = {
  error: string | null;
  draftId?: string;
};

export async function generateMissionAiDraftAction(
  workspaceSlug: string,
  projectId: string,
  missionId: string,
  _prevState: MissionAiDraftActionState,
  formData: FormData,
): Promise<MissionAiDraftActionState> {
  const rawTaskType = formData.get("task_type");
  const promptContext = formData.get("prompt_context");

  if (
    typeof rawTaskType !== "string" ||
    !(TASK_TYPES as readonly string[]).includes(rawTaskType) ||
    typeof promptContext !== "string"
  ) {
    return { error: "Choose a task type and enter a prompt." };
  }

  const taskType = rawTaskType as TaskType;

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const project = await getProjectById(projectId);
  const mission = await getMissionById(missionId);

  if (
    !workspace ||
    !project ||
    !mission ||
    project.workspace_id !== workspace.id ||
    mission.project_id !== project.id
  ) {
    return { error: "Mission not found." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { error: "Authentication required." };
  }

  const wrapper = new InferenceExecutionWrapper({
    provider: getModelProviderAdapter(),
    promptTemplates: getPromptTemplates(),
    inferenceLogger: new SupabaseInferenceLogWriter(supabase),
    costEstimator: getCostEstimator(),
  });

  const result = await generateMissionAiDraft(
    { wrapper, draftWriter: new SupabaseMissionAiDraftWriter(supabase) },
    {
      taskType,
      createdBy: userId,
      input: {
        workspace_id: workspace.id,
        project_id: project.id,
        mission_id: mission.id,
        prompt_context: promptContext,
        caller_identity: "user",
      },
    },
  );

  if (!result.ok) {
    return { error: result.failure.message };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/missions/${missionId}`);
  return { error: null, draftId: result.draftId };
}

export async function approveMissionAiDraftAction(
  workspaceSlug: string,
  projectId: string,
  missionId: string,
  draftId: string,
): Promise<MissionAiDraftActionState> {
  const supabase = await createClient();
  const { error } = await approveMissionAiDraft(supabase, draftId);

  if (error) {
    return { error };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/missions/${missionId}`);
  return { error: null, draftId };
}

export async function dismissMissionAiDraftAction(
  workspaceSlug: string,
  projectId: string,
  missionId: string,
  draftId: string,
): Promise<MissionAiDraftActionState> {
  const supabase = await createClient();
  const { error } = await dismissMissionAiDraft(supabase, draftId);

  if (error) {
    return { error };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}/missions/${missionId}`);
  return { error: null, draftId };
}

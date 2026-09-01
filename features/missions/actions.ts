"use server";

import { revalidatePath } from "next/cache";
import { getProjectById } from "@/features/projects/queries";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { missionInputSchema } from "@/features/missions/schema";
import { createClient } from "@/lib/supabase/server";

export type MissionActionState = {
  error: string | null;
};

export async function createMissionAction(
  workspaceSlug: string,
  projectId: string,
  _state: MissionActionState,
  formData: FormData,
): Promise<MissionActionState> {
  const parsed = missionInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
  });

  if (!parsed.success) {
    return { error: "Enter valid mission details." };
  }

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const project = await getProjectById(projectId);

  if (!workspace || !project || project.workspace_id !== workspace.id) {
    return { error: "Project not found." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { error: "Authentication required." };
  }

  const { error } = await supabase.from("missions").insert({
    project_id: project.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    created_by: userId,
  });

  if (error) {
    return { error: "Unable to create mission." };
  }

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { error: null };
}

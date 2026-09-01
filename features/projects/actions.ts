"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceBySlug } from "@/features/workspaces/queries";
import { projectInputSchema } from "@/features/projects/schema";
import { createClient } from "@/lib/supabase/server";

export type ProjectActionState = {
  error: string | null;
};

export async function createProjectAction(
  workspaceSlug: string,
  _state: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = projectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid project name and description." };
  }

  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    return { error: "Workspace not found." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { error: "Authentication required." };
  }

  const { error } = await supabase.from("projects").insert({
    workspace_id: workspace.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    created_by: userId,
  });

  if (error) {
    return { error: "Unable to create project." };
  }

  revalidatePath(`/w/${workspaceSlug}`);
  return { error: null };
}

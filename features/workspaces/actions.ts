"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const workspaceInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type WorkspaceActionState = {
  error: string | null;
};

export async function createWorkspaceAction(
  _state: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = workspaceInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid workspace name and slug." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace_with_owner", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That workspace slug is already in use."
          : "Unable to create workspace.",
    };
  }

  revalidatePath("/app");
  redirect(`/w/${parsed.data.slug}`);
}

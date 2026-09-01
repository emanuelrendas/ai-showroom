import { createClient } from "@/lib/supabase/server";

export async function getProjectsForWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,workspace_id,name,description,status,created_by,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load projects: ${error.message}`);
  return data;
}

export async function getProjectById(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,workspace_id,name,description,status,created_by,created_at,updated_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load project: ${error.message}`);
  return data;
}

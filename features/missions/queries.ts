import { createClient } from "@/lib/supabase/server";

export async function getMissionsForProject(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("missions")
    .select("id,project_id,title,description,status,priority,created_by,created_at,updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load missions: ${error.message}`);
  }

  return data;
}

export async function getMissionById(missionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("missions")
    .select("id,project_id,title,description,status,priority,created_by,created_at,updated_at")
    .eq("id", missionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load mission: ${error.message}`);
  }

  return data;
}

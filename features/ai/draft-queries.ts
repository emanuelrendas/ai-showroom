import { createClient } from "@/lib/supabase/server";

export async function getMissionAiDrafts(missionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mission_ai_drafts")
    .select(
      "id,mission_id,project_id,workspace_id,schema_version,summary,suggested_actions,confidence_score,confidence_tier,is_ai_generated,status,approved_by,approved_at,created_by,created_at,updated_at",
    )
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load mission AI drafts: ${error.message}`);
  return data;
}

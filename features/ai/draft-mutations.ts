import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface DraftMutationResult {
  error: string | null;
}

/**
 * Invokes the approve_mission_ai_draft RPC (Section 4.4). All authorization
 * and the approved_by/approved_at stamping happen server-side inside that
 * SECURITY DEFINER function; this adapter never sets those fields itself.
 */
export async function approveMissionAiDraft(
  supabase: SupabaseClient<Database>,
  draftId: string,
): Promise<DraftMutationResult> {
  const { error } = await supabase.rpc("approve_mission_ai_draft", {
    p_draft_id: draftId,
  });

  return { error: error ? error.message : null };
}

/**
 * Dismisses a pending draft. Relies entirely on the mission_ai_drafts RLS
 * policy (pending_review only, result must stay pending_review/dismissed) to
 * reject anything else; this function does not duplicate that logic.
 */
export async function dismissMissionAiDraft(
  supabase: SupabaseClient<Database>,
  draftId: string,
): Promise<DraftMutationResult> {
  const { error } = await supabase
    .from("mission_ai_drafts")
    .update({ status: "dismissed" })
    .eq("id", draftId);

  return { error: error ? error.message : null };
}

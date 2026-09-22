import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SingleModelOutput } from "./schemas";

export interface MissionAiDraftInsert {
  mission_id: string;
  project_id: string;
  workspace_id: string;
  created_by: string;
  output: SingleModelOutput;
}

export interface MissionAiDraftWriter {
  write(record: MissionAiDraftInsert): Promise<{ id: string }>;
}

/**
 * Concrete MissionAiDraftWriter backed by Supabase. Every row is inserted as
 * status "pending_review" (the table default): nothing this adapter writes
 * ever reaches "applied" directly, per Section 4.4 — only the
 * approve_mission_ai_draft RPC can do that.
 */
export class SupabaseMissionAiDraftWriter implements MissionAiDraftWriter {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async write(record: MissionAiDraftInsert): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from("mission_ai_drafts")
      .insert({
        mission_id: record.mission_id,
        project_id: record.project_id,
        workspace_id: record.workspace_id,
        created_by: record.created_by,
        schema_version: record.output.schema_version,
        summary: record.output.summary,
        suggested_actions: record.output.suggested_actions,
        confidence_score: record.output.confidence_score,
        confidence_tier: record.output.confidence_tier,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Unable to persist mission AI draft: ${error?.message ?? "unknown error"}`);
    }

    return { id: data.id };
  }
}

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseMissionAiDraftWriter } from "@/features/ai/mission-ai-draft-writer";
import type { MissionAiDraftInsert } from "@/features/ai/mission-ai-draft-writer";
import type { Database } from "@/lib/supabase/database.types";

const draftRecord: MissionAiDraftInsert = {
  mission_id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33",
  project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22",
  workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11",
  created_by: "9f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a99",
  output: {
    schema_version: "1.0.0",
    summary: "The mission is on track.",
    suggested_actions: ["Follow up with the reviewer", "Update the draft"],
    confidence_score: 0.92,
    confidence_tier: "HIGH",
    requires_human_review: true,
  },
};

function createMockSupabase(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const supabase = { from } as unknown as SupabaseClient<Database>;
  return { supabase, from, insert, select, single };
}

describe("SupabaseMissionAiDraftWriter", () => {
  it("inserts a pending_review draft mapped from the validated output and returns its id", async () => {
    const { supabase, from, insert } = createMockSupabase({
      data: { id: "d1c1b1a1-0000-4000-8000-000000000001" },
      error: null,
    });
    const writer = new SupabaseMissionAiDraftWriter(supabase);

    const result = await writer.write(draftRecord);

    expect(from).toHaveBeenCalledWith("mission_ai_drafts");
    expect(insert).toHaveBeenCalledWith({
      mission_id: draftRecord.mission_id,
      project_id: draftRecord.project_id,
      workspace_id: draftRecord.workspace_id,
      created_by: draftRecord.created_by,
      schema_version: draftRecord.output.schema_version,
      summary: draftRecord.output.summary,
      suggested_actions: draftRecord.output.suggested_actions,
      confidence_score: draftRecord.output.confidence_score,
      confidence_tier: draftRecord.output.confidence_tier,
    });
    expect(result).toEqual({ id: "d1c1b1a1-0000-4000-8000-000000000001" });
  });

  it("propagates a Supabase insert failure instead of swallowing it (fail-closed)", async () => {
    const { supabase } = createMockSupabase({
      data: null,
      error: { message: "permission denied for table mission_ai_drafts" },
    });
    const writer = new SupabaseMissionAiDraftWriter(supabase);

    await expect(writer.write(draftRecord)).rejects.toThrow(
      /permission denied for table mission_ai_drafts/,
    );
  });
});

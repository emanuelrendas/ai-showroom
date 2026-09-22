import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { approveMissionAiDraft, dismissMissionAiDraft } from "@/features/ai/draft-mutations";
import type { Database } from "@/lib/supabase/database.types";

const draftId = "d1c1b1a1-0000-4000-8000-000000000001";

describe("approveMissionAiDraft", () => {
  it("invokes the approve_mission_ai_draft RPC with the draft id and reports success", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    const result = await approveMissionAiDraft(supabase, draftId);

    expect(rpc).toHaveBeenCalledWith("approve_mission_ai_draft", { p_draft_id: draftId });
    expect(result).toEqual({ error: null });
  });

  it("surfaces the RPC's error message instead of swallowing it", async () => {
    const rpc = vi.fn(async () => ({ error: { message: "Draft is not pending review" } }));
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    const result = await approveMissionAiDraft(supabase, draftId);

    expect(result).toEqual({ error: "Draft is not pending review" });
  });
});

describe("dismissMissionAiDraft", () => {
  function createMockSupabase(error: { message: string } | null) {
    const eq = vi.fn(async () => ({ error }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient<Database>;
    return { supabase, from, update, eq };
  }

  it("updates the draft's status to dismissed and reports success", async () => {
    const { supabase, from, update, eq } = createMockSupabase(null);

    const result = await dismissMissionAiDraft(supabase, draftId);

    expect(from).toHaveBeenCalledWith("mission_ai_drafts");
    expect(update).toHaveBeenCalledWith({ status: "dismissed" });
    expect(eq).toHaveBeenCalledWith("id", draftId);
    expect(result).toEqual({ error: null });
  });

  it("surfaces an RLS rejection instead of swallowing it", async () => {
    const { supabase } = createMockSupabase({
      message: "new row violates row-level security policy",
    });

    const result = await dismissMissionAiDraft(supabase, draftId);

    expect(result).toEqual({ error: "new row violates row-level security policy" });
  });
});

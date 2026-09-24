import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseInferenceLogWriter } from "@/features/ai/inference-log-supabase-adapter";
import type { InferenceLogRecord } from "@/features/ai/inference-wrapper";
import type { Database } from "@/lib/supabase/database.types";

const successRecord: InferenceLogRecord = {
  workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11",
  project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22",
  mission_id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33",
  task_type: "summarize",
  status: "success",
  prompt_tokens: 120,
  completion_tokens: 80,
  total_tokens: 200,
  model_identifier: "test-model-v1",
  latency_ms: 842,
  cost_usd_micros: 5_000,
  failure_reason: null,
};

function createMockSupabase(insertResult: { error: { message: string } | null }) {
  const insert = vi.fn(async () => insertResult);
  const from = vi.fn(() => ({ insert }));
  const supabase = { from } as unknown as SupabaseClient<Database>;
  return { supabase, from, insert };
}

describe("SupabaseInferenceLogWriter", () => {
  it("inserts a correctly mapped row into inference_logs", async () => {
    const { supabase, from, insert } = createMockSupabase({ error: null });
    const writer = new SupabaseInferenceLogWriter(supabase);

    await writer.write(successRecord);

    expect(from).toHaveBeenCalledWith("inference_logs");
    expect(insert).toHaveBeenCalledWith({
      workspace_id: successRecord.workspace_id,
      project_id: successRecord.project_id,
      mission_id: successRecord.mission_id,
      task_type: successRecord.task_type,
      status: successRecord.status,
      prompt_tokens: successRecord.prompt_tokens,
      completion_tokens: successRecord.completion_tokens,
      total_tokens: successRecord.total_tokens,
      model_identifier: successRecord.model_identifier,
      latency_ms: successRecord.latency_ms,
      cost_usd_micros: successRecord.cost_usd_micros,
      failure_reason: successRecord.failure_reason,
    });
  });

  it("propagates a Supabase insert failure instead of swallowing it (fail-closed)", async () => {
    const { supabase } = createMockSupabase({
      error: { message: "permission denied for table inference_logs" },
    });
    const writer = new SupabaseInferenceLogWriter(supabase);

    await expect(writer.write(successRecord)).rejects.toThrow(
      /permission denied for table inference_logs/,
    );
  });
});

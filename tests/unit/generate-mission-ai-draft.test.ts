import { describe, expect, it, vi } from "vitest";
import { generateMissionAiDraft } from "@/features/ai/generate-mission-ai-draft";
import type {
  InferenceExecutionResult,
  InferenceExecutionWrapper,
  InferenceLogRecord,
  TaskType,
} from "@/features/ai/inference-wrapper";
import type { MissionAiDraftInsert, MissionAiDraftWriter } from "@/features/ai/mission-ai-draft-writer";

const validInput = {
  workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11",
  project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22",
  mission_id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33",
  prompt_context: "Summarize the mission notes and produce suggested actions.",
  caller_identity: "user" as const,
};

const validOutput = {
  schema_version: "1.0.0" as const,
  summary: "The mission is on track.",
  suggested_actions: ["Follow up with the reviewer", "Update the draft"],
  confidence_score: 0.92,
  confidence_tier: "HIGH" as const,
  requires_human_review: true as const,
};

const successLog: InferenceLogRecord = {
  workspace_id: validInput.workspace_id,
  project_id: validInput.project_id,
  mission_id: validInput.mission_id,
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

function createDraftWriter(): MissionAiDraftWriter & {
  writes: MissionAiDraftInsert[];
} {
  const writes: MissionAiDraftInsert[] = [];
  return {
    writes,
    write: vi.fn(async (record: MissionAiDraftInsert) => {
      writes.push(record);
      return { id: "d1c1b1a1-0000-4000-8000-000000000001" };
    }),
  };
}

function wrapperReturning(
  result: InferenceExecutionResult,
): Pick<InferenceExecutionWrapper, "execute"> {
  return { execute: vi.fn(async () => result) };
}

describe("generateMissionAiDraft — success path", () => {
  it("writes a pending_review draft mapped from the wrapper's validated output", async () => {
    const draftWriter = createDraftWriter();
    const wrapper = wrapperReturning({ ok: true, output: validOutput, log: successLog });

    const result = await generateMissionAiDraft(
      { wrapper, draftWriter },
      { input: validInput, taskType: "summarize" as TaskType, createdBy: "user-1" },
    );

    expect(wrapper.execute).toHaveBeenCalledWith(validInput, "summarize");
    expect(draftWriter.write).toHaveBeenCalledTimes(1);
    expect(draftWriter.writes[0]).toEqual({
      mission_id: validInput.mission_id,
      project_id: validInput.project_id,
      workspace_id: validInput.workspace_id,
      created_by: "user-1",
      output: validOutput,
    });

    expect(result).toEqual({
      ok: true,
      draftId: "d1c1b1a1-0000-4000-8000-000000000001",
      output: validOutput,
      log: successLog,
    });
  });
});

describe("generateMissionAiDraft — fail-closed: no draft is ever written on a non-ok result", () => {
  const failureCases: Array<{
    name: string;
    result: InferenceExecutionResult;
  }> = [
    {
      name: "provider timeout",
      result: {
        ok: false,
        failure: {
          code: "PROVIDER_TIMEOUT",
          httpStatus: 504,
          message: "Model provider call timed out",
        },
        log: { ...successLog, status: "failed", failure_reason: "PROVIDER_TIMEOUT" },
      },
    },
    {
      name: "provider rate limit",
      result: {
        ok: false,
        failure: {
          code: "PROVIDER_RATE_LIMIT",
          httpStatus: 429,
          message: "Model provider rate limit exceeded",
        },
        log: { ...successLog, status: "failed", failure_reason: "PROVIDER_RATE_LIMIT" },
      },
    },
    {
      name: "malformed model output (schema violation)",
      result: {
        ok: false,
        failure: {
          code: "MODEL_SCHEMA_VIOLATION",
          httpStatus: 422,
          message: "SingleModelOutputSchema validation failed",
        },
        log: { ...successLog, status: "failed", failure_reason: "MODEL_SCHEMA_VIOLATION" },
      },
    },
    {
      name: "cost ceiling exceeded",
      result: {
        ok: false,
        failure: {
          code: "COST_CEILING_EXCEEDED",
          httpStatus: 402,
          message: "Estimated cost exceeds the hard ceiling",
        },
        log: { ...successLog, status: "refused", failure_reason: "COST_CEILING_EXCEEDED" },
      },
    },
    {
      name: "invalid input (rejected before the provider is ever called)",
      result: {
        ok: false,
        failure: {
          code: "INPUT_SCHEMA_VIOLATION",
          httpStatus: 422,
          message: "SingleModelInputSchema validation failed",
        },
        log: null,
      },
    },
  ];

  for (const { name, result } of failureCases) {
    it(`never calls draftWriter.write when the wrapper reports ${name}`, async () => {
      const draftWriter = createDraftWriter();
      const wrapper = wrapperReturning(result);

      const outcome = await generateMissionAiDraft(
        { wrapper, draftWriter },
        { input: validInput, taskType: "summarize" as TaskType, createdBy: "user-1" },
      );

      expect(draftWriter.write).not.toHaveBeenCalled();
      expect(outcome).toEqual(result);
    });
  }
});

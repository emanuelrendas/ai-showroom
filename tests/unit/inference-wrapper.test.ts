import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COST_CEILING_USD_MICROS,
  InferenceExecutionWrapper,
  ProviderRateLimitError,
  type InferenceLogRecord,
  type InferenceLogWriter,
  type ModelProviderAdapter,
  type ModelProviderResult,
  type PromptTemplateMap,
} from "@/features/ai/inference-wrapper";

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

const promptTemplates: PromptTemplateMap = {
  summarize: "Summarize: {{prompt_context}}",
  classify: "Classify: {{prompt_context}}",
  draft_response: "Draft a response for: {{prompt_context}}",
};

const validProviderResult: ModelProviderResult = {
  payload: validOutput,
  usage: { promptTokens: 120, completionTokens: 80, model: "test-model-v1" },
  costUsdMicros: 5_000,
};

function createLogger(): InferenceLogWriter & {
  records: InferenceLogRecord[];
} {
  const records: InferenceLogRecord[] = [];
  return {
    records,
    write: vi.fn(async (record: InferenceLogRecord) => {
      records.push(record);
    }),
  };
}

function createWrapper(overrides: {
  provider?: ModelProviderAdapter;
  costEstimator?: (params: unknown) => number;
  costCeilingUsdMicros?: number;
  timeoutMs?: number;
} = {}) {
  const provider: ModelProviderAdapter = overrides.provider ?? {
    invoke: vi.fn(async () => validProviderResult),
  };
  const logger = createLogger();

  const wrapper = new InferenceExecutionWrapper({
    provider,
    promptTemplates,
    inferenceLogger: logger,
    costEstimator: overrides.costEstimator as
      | ((params: { taskType: string; input: unknown }) => number)
      | undefined,
    costCeilingUsdMicros: overrides.costCeilingUsdMicros,
    timeoutMs: overrides.timeoutMs,
  });

  return { wrapper, provider, logger };
}

describe("InferenceExecutionWrapper — happy path", () => {
  it("validates input, calls the provider, validates output, and logs a success row before returning", async () => {
    const { wrapper, provider, logger } = createWrapper();

    const result = await wrapper.execute(validInput, "summarize");

    expect(provider.invoke).toHaveBeenCalledTimes(1);
    expect(provider.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "summarize",
        promptTemplate: promptTemplates.summarize,
        input: validInput,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toEqual(validOutput);
      expect(result.log.status).toBe("success");
      expect(result.log.task_type).toBe("summarize");
      expect(result.log.prompt_tokens).toBe(120);
      expect(result.log.completion_tokens).toBe(80);
      expect(result.log.total_tokens).toBe(200);
      expect(result.log.model_identifier).toBe("test-model-v1");
      expect(result.log.cost_usd_micros).toBe(5_000);
      expect(result.log.failure_reason).toBeNull();
      expect(result.log.latency_ms).toBeGreaterThanOrEqual(0);
    }

    expect(logger.write).toHaveBeenCalledTimes(1);
    expect(logger.records[0]?.status).toBe("success");
  });
});

describe("InferenceExecutionWrapper — input validation (HTTP 422)", () => {
  it("rejects an invalid input payload immediately, never invoking the provider or writing telemetry", async () => {
    const { wrapper, provider, logger } = createWrapper();

    const result = await wrapper.execute(
      { ...validInput, mission_id: "not-a-uuid" },
      "summarize",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("INPUT_SCHEMA_VIOLATION");
      expect(result.failure.httpStatus).toBe(422);
      expect(result.log).toBeNull();
    }

    expect(provider.invoke).not.toHaveBeenCalled();
    expect(logger.write).not.toHaveBeenCalled();
  });
});

describe("InferenceExecutionWrapper — cost ceiling ($0.02 hard limit)", () => {
  it("aborts before dispatching to the provider when estimated cost exceeds the ceiling", async () => {
    const { wrapper, provider, logger } = createWrapper({
      costEstimator: () => DEFAULT_COST_CEILING_USD_MICROS + 1,
    });

    const result = await wrapper.execute(validInput, "summarize");

    expect(provider.invoke).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("COST_CEILING_EXCEEDED");
      expect(result.failure.httpStatus).toBe(402);
      expect(result.log?.status).toBe("refused");
      expect(result.log?.failure_reason).toBe("COST_CEILING_EXCEEDED");
    }

    expect(logger.write).toHaveBeenCalledTimes(1);
  });

  it("dispatches to the provider when estimated cost is within the $0.02 ceiling", async () => {
    const { wrapper, provider } = createWrapper({
      costEstimator: () => DEFAULT_COST_CEILING_USD_MICROS,
    });

    const result = await wrapper.execute(validInput, "summarize");

    expect(provider.invoke).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});

describe("InferenceExecutionWrapper — fail-closed scenarios (Section 5)", () => {
  it("fails closed on provider timeout with an honest status: failed record, never a fabricated success", async () => {
    const provider: ModelProviderAdapter = {
      invoke: vi.fn(() => new Promise<ModelProviderResult>(() => {})),
    };
    const { wrapper, logger } = createWrapper({ provider, timeoutMs: 15 });

    const result = await wrapper.execute(validInput, "summarize");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("PROVIDER_TIMEOUT");
      expect(result.failure.httpStatus).toBe(504);
      expect(result.log?.status).toBe("failed");
      expect(result.log?.failure_reason).toBe("PROVIDER_TIMEOUT");
    }

    expect(logger.write).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a malformed model output, rejecting with MODEL_SCHEMA_VIOLATION and HTTP 422", async () => {
    const malformedProviderResult: ModelProviderResult = {
      payload: { ...validOutput, confidence_score: 42, extra_field: "not allowed" },
      usage: { promptTokens: 50, completionTokens: 10, model: "test-model-v1" },
      costUsdMicros: 1_000,
    };
    const provider: ModelProviderAdapter = {
      invoke: vi.fn(async () => malformedProviderResult),
    };
    const { wrapper, logger } = createWrapper({ provider });

    const result = await wrapper.execute(validInput, "classify");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("MODEL_SCHEMA_VIOLATION");
      expect(result.failure.httpStatus).toBe(422);
      expect(result.failure.issues?.length).toBeGreaterThan(0);
      expect(result.log?.status).toBe("failed");
      expect(result.log?.failure_reason).toBe("MODEL_SCHEMA_VIOLATION");
      expect(result.log?.prompt_tokens).toBe(50);
    }

    expect(logger.write).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a provider rate limit error with an honest status: failed record", async () => {
    const provider: ModelProviderAdapter = {
      invoke: vi.fn(async () => {
        throw new ProviderRateLimitError();
      }),
    };
    const { wrapper, logger } = createWrapper({ provider });

    const result = await wrapper.execute(validInput, "draft_response");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("PROVIDER_RATE_LIMIT");
      expect(result.failure.httpStatus).toBe(429);
      expect(result.log?.status).toBe("failed");
      expect(result.log?.failure_reason).toBe("PROVIDER_RATE_LIMIT");
    }

    expect(logger.write).toHaveBeenCalledTimes(1);
  });
});

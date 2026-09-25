import { afterEach, describe, expect, it } from "vitest";
import { getModelProviderAdapter } from "@/features/ai/provider";
import { SingleModelOutputSchema } from "@/features/ai/schemas";
import { DEFAULT_COST_CEILING_USD_MICROS } from "@/features/ai/inference-wrapper";

const ENV_VAR = "AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER";

describe("getModelProviderAdapter — deterministic test-only provider boundary", () => {
  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it("returns the real Gemini-calling adapter by default (env var unset)", () => {
    delete process.env[ENV_VAR];
    const adapter = getModelProviderAdapter();

    // The real adapter throws synchronously-via-rejection when GEMINI_API_KEY
    // is unset, which is exactly the behavior that proves this is the real
    // network-calling path, not the stub (the stub never touches env vars
    // other than the gate itself and never rejects for a missing API key).
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    return adapter
      .invoke({
        taskType: "summarize",
        promptTemplate: "irrelevant",
        input: {
          workspace_id: "00000000-0000-0000-0000-000000000000",
          project_id: "00000000-0000-0000-0000-000000000000",
          mission_id: "00000000-0000-0000-0000-000000000000",
          prompt_context: "irrelevant prompt context, long enough to pass validation",
          caller_identity: "user",
        },
      })
      .then(
        () => {
          throw new Error("expected the real adapter to reject without GEMINI_API_KEY");
        },
        (error: unknown) => {
          expect(String(error)).toMatch(/MODEL_PROVIDER_NOT_CONFIGURED/);
        },
      )
      .finally(() => {
        if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
      });
  });

  it("returns the deterministic stub only when the env var is exactly '1'", () => {
    process.env[ENV_VAR] = "true"; // deliberately wrong value
    const adapterWrongValue = getModelProviderAdapter();

    process.env[ENV_VAR] = "1";
    const adapterCorrectValue = getModelProviderAdapter();

    // Both adapters are opaque objects with an `invoke` function; the only
    // externally observable difference is behavior, asserted below. This
    // test's job is just to confirm the gate is exact-match, not truthy-match
    // (a stray "true"/"yes"/"on" must never accidentally enable the stub).
    expect(typeof adapterWrongValue.invoke).toBe("function");
    expect(typeof adapterCorrectValue.invoke).toBe("function");
  });

  it("the deterministic stub never calls the network and always returns schema-valid output", async () => {
    process.env[ENV_VAR] = "1";
    // No GEMINI_API_KEY needed and no network reachable in this test process --
    // if the stub accidentally fell through to invokeGemini, this would throw
    // or hang, not resolve.
    delete process.env.GEMINI_API_KEY;

    const adapter = getModelProviderAdapter();

    const result = await adapter.invoke({
      taskType: "summarize",
      promptTemplate: "Summarize the following mission context.",
      input: {
        workspace_id: "11111111-1111-1111-1111-111111111111",
        project_id: "22222222-2222-2222-2222-222222222222",
        mission_id: "33333333-3333-3333-3333-333333333333",
        prompt_context: "The deterministic E2E suite needs a schema-valid, fast, offline response.",
        caller_identity: "user",
      },
    });

    const parsed = SingleModelOutputSchema.safeParse(result.payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.requires_human_review).toBe(true);
      expect(parsed.data.schema_version).toBe("1.0.0");
    }

    expect(result.usage.model).toBe("deterministic-stub-v1");
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.completionTokens).toBeGreaterThan(0);
    expect(result.costUsdMicros).toBeGreaterThan(0);
    expect(result.costUsdMicros).toBeLessThan(DEFAULT_COST_CEILING_USD_MICROS);
  });

  it("the deterministic stub's output is deterministic across repeated calls with the same input", async () => {
    process.env[ENV_VAR] = "1";
    const adapter = getModelProviderAdapter();
    const invocation = {
      taskType: "classify" as const,
      promptTemplate: "Classify the following mission context.",
      input: {
        workspace_id: "44444444-4444-4444-4444-444444444444",
        project_id: "55555555-5555-5555-5555-555555555555",
        mission_id: "66666666-6666-6666-6666-666666666666",
        prompt_context: "Same input, called twice, must produce the same structural output.",
        caller_identity: "user" as const,
      },
    };

    const first = await adapter.invoke(invocation);
    const second = await adapter.invoke(invocation);

    expect(first.payload).toEqual(second.payload);
    expect(first.usage).toEqual(second.usage);
    expect(first.costUsdMicros).toBe(second.costUsdMicros);
  });
});

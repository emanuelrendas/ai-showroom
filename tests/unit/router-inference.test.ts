import { afterEach, describe, expect, it, vi } from "vitest";
import { InferenceExecutionWrapper, ProviderRateLimitError, type ModelProviderAdapter } from "@/features/ai/inference-wrapper";
import { generateMissionAiDraft } from "@/features/ai/generate-mission-ai-draft";
import { getPromptTemplates } from "@/features/ai/provider";
import { resolveModelProfile } from "@/features/ai/router/resolvers";
import { routeModel } from "@/features/ai/router/router";
import { toRouteMetadata, getRouterFailureMessage } from "@/features/ai/router/presentation";
import { routeRequest, syntheticRegistry, speedProfile, validInput, validOutput } from "./fixtures/router-profiles";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("profile resolution", () => {
  it("resolves Gemini's current adapter and pricing-aware estimator", async () => {
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", undefined);
    vi.stubEnv("GEMINI_API_KEY", "unit-test-placeholder");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validOutput) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    }) });
    vi.stubGlobal("fetch", fetchSpy);
    const result = resolveModelProfile("gemini-3.6-flash-live");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Resolution failed");
    expect(result.costEstimator({ taskType: "summarize", input: { ...validInput, prompt_context: "x".repeat(400) } })).toBe(215);
    const output = await result.provider.invoke({ taskType: "summarize", input: validInput, promptTemplate: "Summarize" });
    expect(output.usage.model).toBe("gemini-3.6-flash");
    expect(output.costUsdMicros).toBe(30);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain("/models/gemini-3.6-flash:generateContent");
  });

  it("fails truthfully before inference when configuration is unavailable", () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", undefined);
    expect(resolveModelProfile("gemini-3.6-flash-live"))
      .toEqual({ ok: false, failure: { code: "PROFILE_NOT_CONFIGURED" } });
    expect(resolveModelProfile("unknown"))
      .toEqual({ ok: false, failure: { code: "PROFILE_RESOLUTION_FAILED" } });
    expect(resolveModelProfile(speedProfile.id)).toMatchObject({ ok: false });
    expect(getRouterFailureMessage("PROFILE_NOT_CONFIGURED")).not.toMatch(/GEMINI_API_KEY|unit-test-placeholder/);
  });

  it("preserves the explicit deterministic M2 provider gate and its execution identity", async () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", "true");
    expect(resolveModelProfile("gemini-3.6-flash-live")).toMatchObject({ ok: false });
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", "1");
    const fetchSpy = vi.fn(() => { throw new Error("HTTP forbidden"); });
    vi.stubGlobal("fetch", fetchSpy);
    const resolution = resolveModelProfile("gemini-3.6-flash-live");
    const route = routeModel(routeRequest);
    if (!resolution.ok || !route.ok) throw new Error("Expected resolution");
    const write = vi.fn().mockResolvedValue(undefined);
    const wrapper = new InferenceExecutionWrapper({ ...resolution, promptTemplates: getPromptTemplates(), inferenceLogger: { write }, routeMetadata: toRouteMetadata(route.decision) });
    const result = await wrapper.execute(validInput, "summarize");
    expect(result).toMatchObject({ ok: true, log: {
      selected_profile_id: "gemini-3.6-flash-live", model_identifier: "deterministic-stub-v1",
      router_policy_version: "1.0.0", route_reason_code: "AUTO_ONLY_ELIGIBLE_PROFILE", override_source: "none",
    } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("selected route through the unchanged draft authority boundary", () => {
  const providerResult = { payload: validOutput, usage: { promptTokens: 10, completionTokens: 10, model: "provider-reported-identity" }, costUsdMicros: 5 };

  function setup(provider: ModelProviderAdapter, cost = 100, override = false) {
    const route = routeModel({ ...routeRequest,
      ...(override ? { override_profile_id: speedProfile.id, override_source: "test" as const } : {}),
    }, { registry: syntheticRegistry, execution_class: "synthetic" });
    if (!route.ok) throw new Error("Expected successful route");
    const metadata = toRouteMetadata(route.decision);
    const writeLog = vi.fn().mockResolvedValue(undefined);
    const writeDraft = vi.fn().mockResolvedValue({ id: "draft-1" });
    const wrapper = new InferenceExecutionWrapper({
      provider, costEstimator: () => cost, promptTemplates: getPromptTemplates(),
      inferenceLogger: { write: writeLog }, routeMetadata: metadata, timeoutMs: 10,
    });
    const run = () => generateMissionAiDraft({ wrapper, draftWriter: { write: writeDraft } }, { input: validInput, taskType: "summarize", createdBy: "user-1" });
    return { run, writeLog, writeDraft, route, metadata, wrapper };
  }

  it("writes one validated draft and logs frozen route metadata with actual execution identity", async () => {
    const invoke = vi.fn().mockResolvedValue(providerResult);
    const { run, writeLog, writeDraft, metadata } = setup({ invoke });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(await run()).toMatchObject({ ok: true, draftId: "draft-1" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({
      status: "success", model_identifier: "provider-reported-identity",
      router_policy_version: "1.0.0", selected_profile_id: "synthetic-quality-v1",
      route_reason_code: "AUTO_BALANCED_PRIORITY", override_source: "none",
    }));
    expect(writeDraft).toHaveBeenCalledTimes(1);
    expect(writeDraft).toHaveBeenCalledWith(expect.objectContaining({ output: validOutput }));
    expect(writeLog.mock.invocationCallOrder[0]).toBeLessThan(writeDraft.mock.invocationCallOrder[0]);
  });

  it.each([
    ["PROVIDER_ERROR", () => Promise.reject(new Error("Provider failed"))],
    ["PROVIDER_RATE_LIMIT", () => Promise.reject(new ProviderRateLimitError())],
    ["MODEL_SCHEMA_VIOLATION", () => Promise.resolve({ ...providerResult, payload: { ...validOutput, requires_human_review: false } })],
  ] as const)("stops %s after one selected invocation, with telemetry and no draft", async (code, implementation) => {
    const invoke = vi.fn(implementation);
    const { run, writeLog, writeDraft, route } = setup({ invoke });
    const before = JSON.stringify(route);
    expect(await run()).toMatchObject({ ok: false, failure: { code } });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(writeDraft).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledTimes(1);
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({
      failure_reason: code, router_policy_version: "1.0.0", selected_profile_id: "synthetic-quality-v1",
      route_reason_code: "AUTO_BALANCED_PRIORITY", override_source: "none",
    }));
    expect(JSON.stringify(route)).toBe(before);
  });

  it("times out without retry, alternate invocation, or late draft creation", async () => {
    vi.useFakeTimers();
    let finish!: (value: typeof providerResult) => void;
    const invoke = vi.fn(() => new Promise<typeof providerResult>((resolve) => { finish = resolve; }));
    const { run, writeDraft, writeLog } = setup({ invoke });
    const pending = run();
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ ok: false, failure: { code: "PROVIDER_TIMEOUT" } });
    finish(providerResult);
    await vi.runAllTimersAsync();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(writeDraft).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledTimes(1);
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({
      selected_profile_id: "synthetic-quality-v1", failure_reason: "PROVIDER_TIMEOUT",
      router_policy_version: "1.0.0", route_reason_code: "AUTO_BALANCED_PRIORITY", override_source: "none",
    }));
  });

  it.each([false, true])("refuses >20,000 before dispatch, including override=%s", async (override) => {
    const invoke = vi.fn().mockResolvedValue(providerResult);
    const { run, writeDraft, writeLog } = setup({ invoke }, 20_001, override);
    expect(await run()).toMatchObject({ ok: false, failure: { code: "COST_CEILING_EXCEEDED" } });
    expect(invoke).not.toHaveBeenCalled();
    expect(writeDraft).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({
      status: "refused", model_identifier: null, router_policy_version: "1.0.0",
      selected_profile_id: override ? "synthetic-speed-v1" : "synthetic-quality-v1",
      route_reason_code: override ? "MANUAL_OVERRIDE_APPROVED" : "AUTO_BALANCED_PRIORITY",
      override_source: override ? "test" : "none",
    }));
  });

  it("allows exactly 20,000 and preserves wrapper input validation", async () => {
    const invoke = vi.fn().mockResolvedValue(providerResult);
    const { run, wrapper, writeLog } = setup({ invoke }, 20_000);
    expect(await run()).toMatchObject({ ok: true });
    expect(await wrapper.execute({ ...validInput, prompt_context: "short" }, "summarize"))
      .toMatchObject({ ok: false, failure: { code: "INPUT_SCHEMA_VIOLATION" }, log: null });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(writeLog).toHaveBeenCalledTimes(1);
  });

  it("snapshots caller-owned metadata and keeps legacy callers nullable", async () => {
    const provider = { invoke: vi.fn().mockResolvedValue(providerResult) };
    const metadata = {
      router_policy_version: "1.0.0" as const, selected_profile_id: "synthetic-quality-v1",
      route_reason_code: "AUTO_BALANCED_PRIORITY" as const, override_source: "none" as const,
    };
    const deps = { provider, promptTemplates: getPromptTemplates(), inferenceLogger: { write: vi.fn().mockResolvedValue(undefined) } };
    const routed = new InferenceExecutionWrapper({ ...deps, routeMetadata: metadata });
    metadata.selected_profile_id = "changed-after-construction";
    expect(await routed.execute(validInput, "summarize")).toMatchObject({ ok: true, log: { selected_profile_id: "synthetic-quality-v1" } });
    expect(await new InferenceExecutionWrapper(deps).execute(validInput, "summarize")).toMatchObject({ ok: true, log: {
      router_policy_version: null, selected_profile_id: null, route_reason_code: null, override_source: null,
    } });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_REGISTRY } from "@/features/ai/router/model-registry";
import { routeModel } from "@/features/ai/router/router";
import { RouteDecisionSchema } from "@/features/ai/router/schemas";
import type { ModelProfile, RouteRequest } from "@/features/ai/router/types";
import { qualityProfile, speedProfile, syntheticRegistry, routeRequest } from "./fixtures/router-profiles";

const synthetic = (registry: readonly ModelProfile[] = syntheticRegistry) => ({
  registry,
  execution_class: "synthetic" as const,
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("deterministic routing policy v1", () => {
  it.each([
    ["summarize", ["summarization", "structured_output"]],
    ["classify", ["classification", "structured_output"]],
    ["draft_response", ["drafting", "structured_output"]],
  ] as const)("routes %s to the sole approved live profile without services or credentials", (task_type, required_capabilities) => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const fetchSpy = vi.fn(() => { throw new Error("HTTP forbidden"); });
    vi.stubGlobal("fetch", fetchSpy);
    const result = routeModel({ ...routeRequest, task_type, required_capabilities });
    expect(result).toEqual({ ok: true, decision: {
      schema_version: "1.0.0", policy_version: "1.0.0",
      selected_profile_id: "gemini-3.6-flash-live",
      reason_code: "AUTO_ONLY_ELIGIBLE_PROFILE",
      candidate_profile_ids: ["gemini-3.6-flash-live"], override_source: "none",
    } });
    expect(MODEL_REGISTRY).toHaveLength(1);
    expect(MODEL_REGISTRY[0]).toMatchObject({
      execution_class: "live", provider: "google-gemini", model_identifier: "gemini-3.6-flash",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["balanced", "synthetic-quality-v1", "AUTO_BALANCED_PRIORITY"],
    ["quality", "synthetic-quality-v1", "AUTO_QUALITY_PRIORITY"],
    ["latency", "synthetic-speed-v1", "AUTO_LATENCY_PRIORITY"],
    ["cost", "synthetic-speed-v1", "AUTO_COST_PRIORITY"],
  ] as const)("freezes %s ranking and survives registry permutation", (preference, selected, reason) => {
    const request = { ...routeRequest, preference };
    const first = routeModel(request, synthetic());
    expect(first).toEqual({ ok: true, decision: {
      schema_version: "1.0.0", policy_version: "1.0.0", selected_profile_id: selected,
      reason_code: reason, candidate_profile_ids: ["synthetic-quality-v1", "synthetic-speed-v1"],
      override_source: "none",
    } });
    for (let i = 0; i < 10; i++) {
      expect(routeModel(request, synthetic([...syntheticRegistry].reverse()))).toEqual(first);
    }
    if (first.ok) {
      expect(RouteDecisionSchema.safeParse(first.decision).success).toBe(true);
      expect(Object.isFrozen(first.decision)).toBe(true);
      expect(Object.isFrozen(first.decision.candidate_profile_ids)).toBe(true);
    }
  });

  it.each(["balanced", "quality", "latency", "cost"] as const)("uses lexical ID as the last %s tie-break", (preference) => {
    const registry = ["z-profile", "a-profile", "m-profile"].map((id) => ({ ...qualityProfile, id }));
    expect(routeModel({ ...routeRequest, preference }, synthetic(registry))).toMatchObject({
      ok: true, decision: { selected_profile_id: "a-profile", candidate_profile_ids: ["a-profile", "m-profile", "z-profile"] },
    });
  });

  it.each([
    ["balanced", { latency_class: "low" }, {}],
    ["balanced", { cost_class: "low" }, {}],
    ["quality", { latency_class: "low" }, {}],
    ["quality", { cost_class: "low" }, {}],
    ["latency", {}, { quality_class: "standard" }],
    ["latency", { cost_class: "low" }, {}],
    ["cost", {}, { quality_class: "standard" }],
    ["cost", { latency_class: "low" }, {}],
  ] as const)("uses secondary/tertiary criteria before ID for %s (%j / %j)", (preference, better, worse) => {
    expect(routeModel({ ...routeRequest, preference }, synthetic([
      { ...qualityProfile, id: "a-worse", ...worse },
      { ...qualityProfile, id: "z-better", ...better },
    ]))).toMatchObject({ ok: true, decision: { selected_profile_id: "z-better" } });
  });

  it.each([
    { enabled: false }, { capabilities: ["structured_output"] },
    { supports_structured_output: false }, { execution_class: "live" },
  ] satisfies Partial<ModelProfile>[])("excludes ineligible profiles (%j)", (change) => {
    const invalid = { ...qualityProfile, ...change };
    expect(routeModel(routeRequest, synthetic([invalid]))).toEqual({ ok: false, failure: { code: "ROUTER_NO_ELIGIBLE_PROFILE" } });
    expect(routeModel(routeRequest, synthetic([invalid, speedProfile]))).toMatchObject({
      ok: true, decision: { selected_profile_id: speedProfile.id, candidate_profile_ids: [speedProfile.id], reason_code: "AUTO_ONLY_ELIGIBLE_PROFILE" },
    });
  });

  it.each([
    ["balanced", { latency_class: "low", cost_class: "high" }, { latency_class: "medium", cost_class: "low" }],
    ["quality", { latency_class: "low", cost_class: "high" }, { latency_class: "medium", cost_class: "low" }],
    ["latency", { quality_class: "high", cost_class: "high" }, { quality_class: "standard", cost_class: "low" }],
    ["cost", { quality_class: "high", latency_class: "high" }, { quality_class: "standard", latency_class: "low" }],
  ] as const)("gives the secondary criterion precedence over a conflicting tertiary criterion for %s", (preference, better, worse) => {
    expect(routeModel({ ...routeRequest, preference }, synthetic([
      { ...qualityProfile, id: "a-worse", ...worse },
      { ...qualityProfile, id: "z-better", ...better },
    ]))).toMatchObject({ ok: true, decision: { selected_profile_id: "z-better" } });
  });

  it("never crosses execution classes, even with a mixed registry or override", () => {
    const registry = [...MODEL_REGISTRY, ...syntheticRegistry];
    expect(routeModel(routeRequest, { registry, execution_class: "live" })).toMatchObject({
      ok: true, decision: { candidate_profile_ids: ["gemini-3.6-flash-live"] },
    });
    expect(routeModel({ ...routeRequest, override_profile_id: speedProfile.id, override_source: "test" }, { registry, execution_class: "live" }))
      .toEqual({ ok: false, failure: { code: "ROUTER_OVERRIDE_INCOMPATIBLE" } });
    expect(routeModel(routeRequest, synthetic(MODEL_REGISTRY))).toMatchObject({ ok: false });
  });

  it.each(["user", "test"] as const)("honors explicit %s override over ranking", (override_source) => {
    expect(routeModel({ ...routeRequest, override_profile_id: speedProfile.id, override_source }, synthetic()))
      .toMatchObject({ ok: true, decision: { selected_profile_id: speedProfile.id, reason_code: "MANUAL_OVERRIDE_APPROVED", override_source } });
  });

  it.each([
    ["absent", {}, "ROUTER_OVERRIDE_NOT_FOUND"],
    [qualityProfile.id, { enabled: false }, "ROUTER_OVERRIDE_DISABLED"],
    [qualityProfile.id, { capabilities: ["structured_output"] }, "ROUTER_OVERRIDE_INCOMPATIBLE"],
    [qualityProfile.id, { supports_structured_output: false }, "ROUTER_OVERRIDE_INCOMPATIBLE"],
    [qualityProfile.id, { execution_class: "live" }, "ROUTER_OVERRIDE_INCOMPATIBLE"],
  ] as const)("fails closed for override %s (%j)", (override_profile_id, change, code) => {
    const registry = [{ ...qualityProfile, ...change }, speedProfile];
    expect(routeModel({ ...routeRequest, override_profile_id, override_source: "user" }, synthetic(registry)))
      .toEqual({ ok: false, failure: { code } });
  });

  it.each([
    { task_type: "unknown" }, { required_capabilities: [] },
    { required_capabilities: ["structured_output"] }, { required_capabilities: ["unknown"] },
    { prompt_context_chars: -1 }, { prompt_context_chars: 1.5 }, { prompt_context_chars: Infinity },
    { preference: "random" }, { override_source: "inferred" },
    { override_profile_id: speedProfile.id }, { override_source: "user" },
    { override_profile_id: "", override_source: "test" }, { demographics: "must be rejected" },
    { override_profile_id: " gemini-3.6-flash-live ", override_source: "user" },
  ])("runtime-rejects invalid request %j", (change) => {
    expect(routeModel({ ...routeRequest, ...change })).toEqual({ ok: false, failure: { code: "ROUTER_INPUT_INVALID" } });
  });

  it("requires the task's actual capabilities even if the caller omits them", () => {
    for (const task_type of ["classify", "draft_response"] as const) {
      expect(routeModel({ ...routeRequest, task_type })).toMatchObject({ ok: false, failure: { code: "ROUTER_INPUT_INVALID" } });
    }
  });

  it("validates registry IDs and profile data instead of depending on ambiguous insertion order", () => {
    expect(routeModel(routeRequest, synthetic([qualityProfile, { ...speedProfile, id: qualityProfile.id }])))
      .toMatchObject({ ok: false, failure: { code: "ROUTER_INPUT_INVALID" } });
    expect(routeModel(routeRequest, synthetic([{ ...qualityProfile, cost_class: "unknown" } as unknown as ModelProfile])))
      .toMatchObject({ ok: false, failure: { code: "ROUTER_INPUT_INVALID" } });
  });

  it("fails closed on an empty registry and does not inspect prompt content", () => {
    expect(routeModel(routeRequest, synthetic([]))).toMatchObject({ ok: false, failure: { code: "ROUTER_NO_ELIGIBLE_PROFILE" } });
    const request: RouteRequest = { ...routeRequest, prompt_context_chars: 0 };
    expect(routeModel(request, synthetic())).toEqual(routeModel({ ...request, prompt_context_chars: 10_000 }, synthetic()));
  });

  it.each(["balanced", "quality", "latency", "cost"] as const)("orders medium ahead of high latency/cost for %s", (preference) => {
    for (const field of ["latency_class", "cost_class"] as const) {
      expect(routeModel({ ...routeRequest, preference }, synthetic([
        { ...qualityProfile, id: "a-high", [field]: "high" },
        { ...qualityProfile, id: "z-medium", [field]: "medium" },
      ]))).toMatchObject({ ok: true, decision: { selected_profile_id: "z-medium" } });
    }
  });

  it("requires all explicitly requested capabilities beyond the task minimum", () => {
    expect(routeModel({ ...routeRequest, required_capabilities: ["summarization", "structured_output", "classification"] }, synthetic([
      { ...qualityProfile, capabilities: ["summarization", "structured_output"] }, speedProfile,
    ]))).toMatchObject({ ok: true, decision: { selected_profile_id: speedProfile.id, candidate_profile_ids: [speedProfile.id] } });
  });
});

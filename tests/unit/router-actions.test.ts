import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateMissionAiDraftAction } from "@/features/ai/actions";
import * as router from "@/features/ai/router/router";
import * as resolver from "@/features/ai/router/resolvers";
import * as provider from "@/features/ai/provider";
import { ProviderTimeoutError } from "@/features/ai/inference-wrapper";
import { validInput, validOutput } from "./fixtures/router-profiles";

const db = vi.hoisted(() => ({ from: vi.fn(), logInsert: vi.fn(), draftInsert: vi.fn(), getClaims: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: db.revalidate }));
vi.mock("@/features/workspaces/queries", () => ({ getWorkspaceBySlug: async () => ({ id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11" }) }));
vi.mock("@/features/projects/queries", () => ({ getProjectById: async () => ({ id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22", workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11" }) }));
vi.mock("@/features/missions/queries", () => ({ getMissionById: async () => ({ id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33", project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: db.from, auth: { getClaims: db.getClaims } }) }));

function run() {
  const form = new FormData();
  form.set("task_type", "summarize");
  form.set("prompt_context", validInput.prompt_context);
  // Client fields must not change the frozen production routing state.
  form.set("override_profile_id", "synthetic-speed-v1");
  form.set("preference", "cost");
  return generateMissionAiDraftAction("workspace", validInput.project_id, validInput.mission_id, { error: null }, form);
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", undefined);
  vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", "1");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected HTTP"); }));
  db.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
  db.logInsert.mockResolvedValue({ error: null });
  db.draftInsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "draft-1" }, error: null }) }) });
  db.from.mockImplementation((table: string) => {
    if (table === "inference_logs") return { insert: db.logInsert };
    if (table === "mission_ai_drafts") return { insert: db.draftInsert };
    throw new Error(`Unexpected mutation target: ${table}`);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("production action routing boundary", () => {
  it("constructs explicit balanced routing and persists only a validated draft plus telemetry", async () => {
    const routeSpy = vi.spyOn(router, "routeModel");
    expect(await run()).toEqual({ error: null, draftId: "draft-1" });
    expect(routeSpy).toHaveBeenCalledExactlyOnceWith({
      task_type: "summarize", required_capabilities: ["summarization", "structured_output"],
      prompt_context_chars: validInput.prompt_context.length, preference: "balanced",
      override_profile_id: null, override_source: "none",
    });
    expect(db.logInsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      selected_profile_id: "gemini-3.6-flash-live", router_policy_version: "1.0.0",
      route_reason_code: "AUTO_ONLY_ELIGIBLE_PROFILE", override_source: "none",
      model_identifier: "deterministic-stub-v1",
    }));
    expect(db.draftInsert).toHaveBeenCalledTimes(1);
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(["inference_logs", "mission_ai_drafts"]);
    expect(db.revalidate).toHaveBeenCalledTimes(1);
  });

  it("does not fabricate telemetry or draft rows on missing profile configuration", async () => {
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", undefined);
    const resolveSpy = vi.spyOn(resolver, "resolveModelProfile");
    expect(await run()).toEqual({ error: "The selected model profile is not configured." });
    expect(resolveSpy).toHaveBeenCalledExactlyOnceWith("gemini-3.6-flash-live");
    expect(db.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops Router failure before resolution, inference, or telemetry", async () => {
    vi.spyOn(router, "routeModel").mockReturnValue({ ok: false, failure: { code: "ROUTER_NO_ELIGIBLE_PROFILE" } });
    const resolveSpy = vi.spyOn(resolver, "resolveModelProfile");
    expect(await run()).toEqual({ error: "No eligible model profile is available." });
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops an unresolvable selected profile without fallback or fabricated telemetry", async () => {
    const resolveSpy = vi.spyOn(resolver, "resolveModelProfile").mockReturnValue({ ok: false, failure: { code: "PROFILE_RESOLUTION_FAILED" } });
    expect(await run()).toEqual({ error: "The selected model profile could not be resolved." });
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(db.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["timeout", "error", "rate-limit", "malformed"] as const)("stops selected-provider %s without re-routing or alternate dispatch", async (scenario) => {
    vi.stubEnv("AI_SHOWROOM_DETERMINISTIC_TEST_PROVIDER", undefined);
    vi.stubEnv("GEMINI_API_KEY", "unit-test-placeholder");
    const fetchSpy = vi.fn();
    if (scenario === "timeout") fetchSpy.mockRejectedValue(new ProviderTimeoutError());
    if (scenario === "error") fetchSpy.mockRejectedValue(new Error("Provider unavailable"));
    if (scenario === "rate-limit") fetchSpy.mockResolvedValue({ status: 429 });
    if (scenario === "malformed") fetchSpy.mockResolvedValue({ status: 200, ok: true, json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ...validOutput, requires_human_review: false }) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
    }) });
    vi.stubGlobal("fetch", fetchSpy);
    const routeSpy = vi.spyOn(router, "routeModel");
    const resolveSpy = vi.spyOn(resolver, "resolveModelProfile");
    expect((await run()).error).not.toBeNull();
    expect(routeSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(db.draftInsert).not.toHaveBeenCalled();
    expect(db.logInsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      status: "failed", selected_profile_id: "gemini-3.6-flash-live",
      router_policy_version: "1.0.0", route_reason_code: "AUTO_ONLY_ELIGIBLE_PROFILE", override_source: "none",
    }));
    expect(db.revalidate).not.toHaveBeenCalled();
  });

  it("enforces the resolver's cost estimate before dispatch", async () => {
    vi.spyOn(provider, "getCostEstimator").mockReturnValue(() => 20_001);
    expect((await run()).error).toContain("hard ceiling");
    expect(fetch).not.toHaveBeenCalled();
    expect(db.draftInsert).not.toHaveBeenCalled();
    expect(db.logInsert).toHaveBeenCalledWith(expect.objectContaining({
      status: "refused", selected_profile_id: "gemini-3.6-flash-live", model_identifier: null,
    }));
  });

  it("requires authentication before routing or inference", async () => {
    db.getClaims.mockResolvedValue({ data: null, error: { message: "not signed in" } });
    const routeSpy = vi.spyOn(router, "routeModel");
    expect(await run()).toEqual({ error: "Authentication required." });
    expect(routeSpy).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
});

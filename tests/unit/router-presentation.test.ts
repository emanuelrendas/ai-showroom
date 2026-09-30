import { describe, expect, it } from "vitest";
import { getGenerationFailureMessage, toRoutePresentation } from "@/features/ai/router/presentation";
import { routeModel } from "@/features/ai/router/router";
import type { RouteDecision } from "@/features/ai/router/types";
import { routeRequest, syntheticRegistry } from "./fixtures/router-profiles";

function liveDecision(): RouteDecision {
  const result = routeModel(routeRequest);
  if (!result.ok) throw new Error("Expected the production route to succeed");
  return result.decision;
}

describe("safe route presentation", () => {
  it("serializes only human-facing fields from a genuine production decision", () => {
    const presentation = toRoutePresentation(liveDecision());
    expect(presentation).toEqual({
      mode: "Auto", modelLabel: "Gemini 3.6 Flash", reason: "Automatically selected",
    });
    expect(JSON.parse(JSON.stringify(presentation))).toEqual(presentation);
  });

  it.each([
    ["AUTO_ONLY_ELIGIBLE_PROFILE", "Automatically selected"],
    ["AUTO_BALANCED_PRIORITY", "Automatically selected for balanced performance"],
    ["AUTO_QUALITY_PRIORITY", "Automatically selected for quality"],
    ["AUTO_LATENCY_PRIORITY", "Automatically selected for speed"],
    ["AUTO_COST_PRIORITY", "Automatically selected for cost"],
  ] as const)("derives a fixed friendly reason from %s metadata", (reason_code, reason) => {
    expect(toRoutePresentation({ ...liveDecision(), reason_code })?.reason).toBe(reason);
  });

  it.each(["balanced", "latency"] as const)("withholds synthetic %s profile identity", (preference) => {
    const result = routeModel({ ...routeRequest, preference }, { registry: syntheticRegistry, execution_class: "synthetic" });
    if (!result.ok) throw new Error("Expected synthetic test route to succeed");
    expect(toRoutePresentation(result.decision)).toBeNull();
  });

  it("withholds unknown profile identity and arbitrary candidate data", () => {
    expect(toRoutePresentation({ ...liveDecision(), selected_profile_id: "private-profile-marker" })).toBeNull();
    expect(toRoutePresentation({ ...liveDecision(), candidate_profile_ids: ["private-candidate-marker"] })).toEqual({
      mode: "Auto", modelLabel: "Gemini 3.6 Flash", reason: "Automatically selected",
    });
  });

  it.each(["user", "test"] as const)("does not misrepresent a %s override as Auto", (override_source) => {
    const result = routeModel({ ...routeRequest, override_profile_id: "gemini-3.6-flash-live", override_source });
    if (!result.ok) throw new Error("Expected explicit internal override to succeed");
    expect(toRoutePresentation(result.decision)).toBeNull();
  });

  it("does not label a manual reason as automatic", () => {
    expect(toRoutePresentation({ ...liveDecision(), reason_code: "MANUAL_OVERRIDE_APPROVED" })).toBeNull();
  });
});

describe("safe generation failures", () => {
  it.each([
    ["INPUT_SCHEMA_VIOLATION", "The generation input is invalid. No draft was saved."],
    ["COST_CEILING_EXCEEDED", "Estimated cost exceeds the 20,000 usd_micros hard ceiling. No draft was saved."],
    ["PROVIDER_TIMEOUT", "The selected model timed out. No draft was saved."],
    ["PROVIDER_RATE_LIMIT", "The selected model is rate limited. No draft was saved."],
    ["PROVIDER_ERROR", "The selected model could not complete the request. No draft was saved."],
    ["MODEL_SCHEMA_VIOLATION", "The selected model returned an invalid draft. No draft was saved."],
  ] as const)("translates %s without taking raw provider text", (code, message) => {
    expect(getGenerationFailureMessage(code)).toBe(message);
  });
});

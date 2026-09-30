import type { InferenceFailureCode } from "../inference-wrapper";
import type { ProfileResolutionFailureCode, RouteDecision, RouteMetadata, RouteReasonCode, RouterFailureCode } from "./types";

export type RoutePresentation = Readonly<{
  mode: "Auto";
  modelLabel: "Gemini 3.6 Flash";
  reason: string;
}>;

const automaticReasons: Record<RouteReasonCode, string | null> = {
  AUTO_ONLY_ELIGIBLE_PROFILE: "Automatically selected",
  AUTO_BALANCED_PRIORITY: "Automatically selected for balanced performance",
  AUTO_QUALITY_PRIORITY: "Automatically selected for quality",
  AUTO_LATENCY_PRIORITY: "Automatically selected for speed",
  AUTO_COST_PRIORITY: "Automatically selected for cost",
  MANUAL_OVERRIDE_APPROVED: null,
};

/** Selected-route facts only, never a claim that inference ran or succeeded. */
export function toRoutePresentation(decision: RouteDecision): RoutePresentation | null {
  // Explicit display allowlist: never echo arbitrary or synthetic profile identities.
  if (decision.selected_profile_id !== "gemini-3.6-flash-live" || decision.override_source !== "none") {
    return null;
  }
  const reason = automaticReasons[decision.reason_code];
  if (!reason) return null;
  return { mode: "Auto", modelLabel: "Gemini 3.6 Flash", reason };
}

const generationFailureMessages: Record<InferenceFailureCode, string> = {
  INPUT_SCHEMA_VIOLATION: "The generation input is invalid. No draft was saved.",
  COST_CEILING_EXCEEDED: "Estimated cost exceeds the 20,000 usd_micros hard ceiling. No draft was saved.",
  PROVIDER_TIMEOUT: "The selected model timed out. No draft was saved.",
  PROVIDER_RATE_LIMIT: "The selected model is rate limited. No draft was saved.",
  PROVIDER_ERROR: "The selected model could not complete the request. No draft was saved.",
  MODEL_SCHEMA_VIOLATION: "The selected model returned an invalid draft. No draft was saved.",
};

export function getGenerationFailureMessage(code: InferenceFailureCode): string {
  // Raw provider messages can include response bodies or configuration details.
  return generationFailureMessages[code];
}

// Safe, fixed messages only. No provider configuration or hidden reasoning.
const failureMessages: Record<RouterFailureCode | ProfileResolutionFailureCode, string> = {
  ROUTER_INPUT_INVALID: "The routing request is invalid.",
  ROUTER_NO_ELIGIBLE_PROFILE: "No eligible model profile is available.",
  ROUTER_OVERRIDE_NOT_FOUND: "The requested model profile was not found.",
  ROUTER_OVERRIDE_DISABLED: "The requested model profile is disabled.",
  ROUTER_OVERRIDE_INCOMPATIBLE: "The requested model profile is incompatible with this task.",
  PROFILE_RESOLUTION_FAILED: "The selected model profile could not be resolved.",
  PROFILE_NOT_CONFIGURED: "The selected model profile is not configured.",
};

export function getRouterFailureMessage(code: RouterFailureCode | ProfileResolutionFailureCode): string {
  return failureMessages[code];
}

export function toRouteMetadata(decision: RouteDecision): RouteMetadata {
  return Object.freeze({
    router_policy_version: decision.policy_version,
    selected_profile_id: decision.selected_profile_id,
    route_reason_code: decision.reason_code,
    override_source: decision.override_source,
  });
}

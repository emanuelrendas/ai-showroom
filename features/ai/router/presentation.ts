import type { ProfileResolutionFailureCode, RouteDecision, RouteMetadata, RouterFailureCode } from "./types";

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

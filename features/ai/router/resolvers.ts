import type { CostEstimator, ModelProviderAdapter } from "../inference-wrapper";
import { getCostEstimator, getModelProviderAdapter, isModelProviderConfigured } from "../provider";
import { MODEL_REGISTRY } from "./model-registry";
import type { ProfileResolutionFailureCode } from "./types";

export type ProfileResolutionResult =
  | { ok: true; provider: ModelProviderAdapter; costEstimator: CostEstimator }
  | { ok: false; failure: { code: ProfileResolutionFailureCode } };

/** Resolve only the approved production profile; never substitute another one. */
export function resolveModelProfile(selectedProfileId: string): ProfileResolutionResult {
  const profile = MODEL_REGISTRY.find((entry) => entry.id === selectedProfileId);
  if (!profile || !profile.enabled || profile.execution_class !== "live" ||
      profile.id !== "gemini-3.6-flash-live" || profile.provider !== "google-gemini" ||
      profile.model_identifier !== "gemini-3.6-flash") {
    return { ok: false, failure: { code: "PROFILE_RESOLUTION_FAILED" } };
  }
  if (!isModelProviderConfigured()) {
    return { ok: false, failure: { code: "PROFILE_NOT_CONFIGURED" } };
  }
  return { ok: true, provider: getModelProviderAdapter(), costEstimator: getCostEstimator() };
}

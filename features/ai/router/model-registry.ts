import type { ModelProfile } from "./types";

// The production registry contains only the single approved live model.
// Synthetic profiles are supplied by tests, never registered here.
export const MODEL_REGISTRY: readonly ModelProfile[] = Object.freeze([
  Object.freeze({
    id: "gemini-3.6-flash-live",
    execution_class: "live",
    provider: "google-gemini",
    model_identifier: "gemini-3.6-flash",
    enabled: true,
    capabilities: Object.freeze(["structured_output", "summarization", "classification", "drafting"] as const),
    quality_class: "high",
    latency_class: "medium",
    cost_class: "low",
    supports_structured_output: true,
  }),
]);

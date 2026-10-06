import type { TaskType } from "../inference-wrapper";
import type { ModelCapability, ModelProfile, RoutePreference, RouteReasonCode } from "./types";

export const ROUTER_POLICY_VERSION = "1.0.0" as const;

export const TASK_REQUIRED_CAPABILITIES: Readonly<Record<TaskType, readonly ModelCapability[]>> = Object.freeze({
  summarize: Object.freeze(["summarization", "structured_output"] as const),
  classify: Object.freeze(["classification", "structured_output"] as const),
  draft_response: Object.freeze(["drafting", "structured_output"] as const),
});

const qualityRank = { high: 0, standard: 1 } as const;
const latencyRank = { low: 0, medium: 1, high: 2 } as const;
const costRank = { low: 0, medium: 1, high: 2 } as const;

// Code-unit ordering is stable across hosts/locales. Never use localeCompare.
export function compareProfileIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareProfiles(a: ModelProfile, b: ModelProfile, preference: RoutePreference): number {
  const quality = qualityRank[a.quality_class] - qualityRank[b.quality_class];
  const latency = latencyRank[a.latency_class] - latencyRank[b.latency_class];
  const cost = costRank[a.cost_class] - costRank[b.cost_class];
  const tie = compareProfileIds(a.id, b.id);
  switch (preference) {
    case "balanced":
    case "quality": return quality || latency || cost || tie;
    case "latency": return latency || quality || cost || tie;
    case "cost": return cost || quality || latency || tie;
  }
}

export const AUTO_REASON_CODES: Readonly<Record<RoutePreference, RouteReasonCode>> = Object.freeze({
  balanced: "AUTO_BALANCED_PRIORITY",
  quality: "AUTO_QUALITY_PRIORITY",
  latency: "AUTO_LATENCY_PRIORITY",
  cost: "AUTO_COST_PRIORITY",
});

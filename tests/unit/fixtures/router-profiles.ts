import type { ModelProfile, RouteRequest } from "@/features/ai/router/types";

export const qualityProfile: ModelProfile = {
  id: "synthetic-quality-v1",
  execution_class: "synthetic",
  provider: "test-only",
  model_identifier: "synthetic-quality-v1",
  enabled: true,
  capabilities: ["structured_output", "summarization", "classification", "drafting"],
  quality_class: "high",
  latency_class: "medium",
  cost_class: "medium",
  supports_structured_output: true,
};

export const speedProfile: ModelProfile = {
  ...qualityProfile,
  id: "synthetic-speed-v1",
  model_identifier: "synthetic-speed-v1",
  quality_class: "standard",
  latency_class: "low",
  cost_class: "low",
};

export const syntheticRegistry = [speedProfile, qualityProfile] as const;
export const routeRequest: RouteRequest = {
  task_type: "summarize",
  required_capabilities: ["summarization", "structured_output"],
  prompt_context_chars: 100,
  preference: "balanced",
  override_profile_id: null,
  override_source: "none",
};

export const validInput = {
  workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11",
  project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22",
  mission_id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33",
  prompt_context: "Summarize the mission notes and produce suggested actions.",
  caller_identity: "user" as const,
};

export const validOutput = {
  schema_version: "1.0.0" as const,
  summary: "The mission is on track.",
  suggested_actions: ["Review the draft"],
  confidence_score: 0.92,
  confidence_tier: "HIGH" as const,
  requires_human_review: true as const,
};

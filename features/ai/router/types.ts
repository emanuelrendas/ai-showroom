import type { TaskType } from "../inference-wrapper";

export const MODEL_CAPABILITIES = ["structured_output", "summarization", "classification", "drafting"] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export type ExecutionClass = "live" | "synthetic";
export type RoutePreference = "balanced" | "quality" | "latency" | "cost";
export type OverrideSource = "none" | "user" | "test";

export type ModelProfile = Readonly<{
  id: string;
  execution_class: ExecutionClass;
  provider: string;
  model_identifier: string;
  enabled: boolean;
  capabilities: readonly ModelCapability[];
  quality_class: "standard" | "high";
  latency_class: "low" | "medium" | "high";
  cost_class: "low" | "medium" | "high";
  supports_structured_output: boolean;
}>;

export type RouteRequest = Readonly<{
  task_type: TaskType;
  required_capabilities: readonly ModelCapability[];
  prompt_context_chars: number;
  preference: RoutePreference;
  override_profile_id: string | null;
  override_source: OverrideSource;
}>;

export const ROUTE_REASON_CODES = [
  "AUTO_ONLY_ELIGIBLE_PROFILE", "AUTO_BALANCED_PRIORITY", "AUTO_QUALITY_PRIORITY",
  "AUTO_LATENCY_PRIORITY", "AUTO_COST_PRIORITY", "MANUAL_OVERRIDE_APPROVED",
] as const;
export type RouteReasonCode = (typeof ROUTE_REASON_CODES)[number];

export type RouteDecision = Readonly<{
  schema_version: "1.0.0";
  policy_version: "1.0.0";
  selected_profile_id: string;
  reason_code: RouteReasonCode;
  candidate_profile_ids: readonly string[];
  override_source: OverrideSource;
}>;

export type RouterFailureCode =
  | "ROUTER_INPUT_INVALID"
  | "ROUTER_NO_ELIGIBLE_PROFILE"
  | "ROUTER_OVERRIDE_NOT_FOUND"
  | "ROUTER_OVERRIDE_DISABLED"
  | "ROUTER_OVERRIDE_INCOMPATIBLE";
export type ProfileResolutionFailureCode = "PROFILE_RESOLUTION_FAILED" | "PROFILE_NOT_CONFIGURED";

export type RouteResult =
  | { ok: true; decision: RouteDecision }
  | { ok: false; failure: { code: RouterFailureCode } };

export type RouteMetadata = Readonly<{
  router_policy_version: RouteDecision["policy_version"];
  selected_profile_id: string;
  route_reason_code: RouteReasonCode;
  override_source: OverrideSource;
}>;

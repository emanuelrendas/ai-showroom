import { z } from "zod";
import { TASK_TYPES } from "../inference-wrapper";
import { TASK_REQUIRED_CAPABILITIES } from "./routing-policy";
import { MODEL_CAPABILITIES, ROUTE_REASON_CODES } from "./types";

export const ModelCapabilitySchema = z.enum(MODEL_CAPABILITIES);
const profileId = z.string().min(1).refine((id) => id === id.trim(), {
  message: "Profile IDs must be exact, without surrounding whitespace",
});
const overrideSource = z.enum(["none", "user", "test"]);
const executionClass = z.enum(["live", "synthetic"]);

export const ModelProfileSchema = z.object({
  id: profileId,
  execution_class: executionClass,
  provider: z.string().min(1),
  model_identifier: z.string().min(1),
  enabled: z.boolean(),
  capabilities: z.array(ModelCapabilitySchema).readonly(),
  quality_class: z.enum(["standard", "high"]),
  latency_class: z.enum(["low", "medium", "high"]),
  cost_class: z.enum(["low", "medium", "high"]),
  supports_structured_output: z.boolean(),
}).strict().readonly();

export const RouteRequestSchema = z.object({
  task_type: z.enum(TASK_TYPES),
  required_capabilities: z.array(ModelCapabilitySchema).readonly(),
  prompt_context_chars: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  preference: z.enum(["balanced", "quality", "latency", "cost"]),
  override_profile_id: profileId.nullable(),
  override_source: overrideSource,
}).strict().refine(
  (request) => (request.override_profile_id === null) === (request.override_source === "none"),
  { message: "Override ID and source must agree" },
).refine(
  (request) => TASK_REQUIRED_CAPABILITIES[request.task_type].every((capability) => request.required_capabilities.includes(capability)),
  { message: "Task capabilities must be required" },
).readonly();

export const RouterContextSchema = z.object({
  registry: z.array(ModelProfileSchema).refine(
    (profiles) => new Set(profiles.map((profile) => profile.id)).size === profiles.length,
    { message: "Profile IDs must be unique" },
  ).readonly(),
  execution_class: executionClass,
}).strict();

export const RouteDecisionSchema = z.object({
  schema_version: z.literal("1.0.0"),
  policy_version: z.literal("1.0.0"),
  selected_profile_id: profileId,
  reason_code: z.enum(ROUTE_REASON_CODES),
  candidate_profile_ids: z.array(profileId).nonempty().readonly(),
  override_source: overrideSource,
}).strict().refine(
  (decision) => decision.candidate_profile_ids.includes(decision.selected_profile_id),
  { message: "Selected profile must be a candidate" },
).readonly();

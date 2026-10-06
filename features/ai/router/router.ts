import { MODEL_REGISTRY } from "./model-registry";
import { AUTO_REASON_CODES, compareProfileIds, compareProfiles, ROUTER_POLICY_VERSION } from "./routing-policy";
import { RouteRequestSchema, RouterContextSchema } from "./schemas";
import type { ExecutionClass, ModelProfile, RouteReasonCode, RouteResult, RouterFailureCode } from "./types";

export type RouterContext = Readonly<{
  registry: readonly ModelProfile[];
  execution_class: ExecutionClass;
}>;

/** Pure policy: no environment, secrets, HTTP, inference, or fallback. */
export function routeModel(
  rawRequest: unknown,
  context: RouterContext = { registry: MODEL_REGISTRY, execution_class: "live" },
): RouteResult {
  const fail = (code: RouterFailureCode): RouteResult => ({ ok: false, failure: { code } });
  const parsedRequest = RouteRequestSchema.safeParse(rawRequest);
  const parsedContext = RouterContextSchema.safeParse(context);
  if (!parsedRequest.success || !parsedContext.success) return fail("ROUTER_INPUT_INVALID");

  const request = parsedRequest.data;
  const { registry, execution_class } = parsedContext.data;
  const compatible = (profile: ModelProfile) =>
    request.required_capabilities.every((capability) => profile.capabilities.includes(capability)) &&
    profile.supports_structured_output;

  const eligible = registry
    .filter((profile) => profile.execution_class === execution_class)
    .filter((profile) => profile.enabled)
    .filter(compatible)
    .sort((a, b) => compareProfileIds(a.id, b.id));

  let selected: ModelProfile;
  let reason: RouteReasonCode;
  if (request.override_profile_id !== null) {
    const override = registry.find((profile) => profile.id === request.override_profile_id);
    if (!override) return fail("ROUTER_OVERRIDE_NOT_FOUND");
    if (override.execution_class !== execution_class) return fail("ROUTER_OVERRIDE_INCOMPATIBLE");
    if (!override.enabled) return fail("ROUTER_OVERRIDE_DISABLED");
    if (!compatible(override)) return fail("ROUTER_OVERRIDE_INCOMPATIBLE");
    selected = override;
    reason = "MANUAL_OVERRIDE_APPROVED";
  } else {
    if (eligible.length === 0) return fail("ROUTER_NO_ELIGIBLE_PROFILE");
    selected = [...eligible].sort((a, b) => compareProfiles(a, b, request.preference))[0];
    reason = eligible.length === 1 ? "AUTO_ONLY_ELIGIBLE_PROFILE" : AUTO_REASON_CODES[request.preference];
  }

  return { ok: true, decision: Object.freeze({
    schema_version: "1.0.0", policy_version: ROUTER_POLICY_VERSION,
    selected_profile_id: selected.id, reason_code: reason,
    candidate_profile_ids: Object.freeze(eligible.map((profile) => profile.id)),
    override_source: request.override_source,
  }) };
}

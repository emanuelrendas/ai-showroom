-- Nullable route provenance preserves existing inference rows and M2 callers.
-- No changes to RLS, grants, partition ACLs, or append-only enforcement.
alter table public.inference_logs
  add column router_policy_version text,
  add column selected_profile_id text,
  add column route_reason_code text,
  add column override_source text;

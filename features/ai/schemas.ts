import { z } from "zod";

export const SingleModelInputSchema = z
  .object({
    workspace_id: z.string().uuid(),
    project_id: z.string().uuid(),
    mission_id: z.string().uuid(),
    prompt_context: z.string().min(10).max(10000),
    caller_identity: z.enum(["user", "system_trigger"]),
  })
  .strict();

export const SingleModelOutputSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    summary: z.string().min(1),
    suggested_actions: z.array(z.string()).nonempty(),
    confidence_score: z.number().min(0).max(1),
    confidence_tier: z.enum(["HIGH", "MEDIUM", "LOW"]),
    requires_human_review: z.literal(true),
  })
  .strict();

export type SingleModelInput = z.infer<typeof SingleModelInputSchema>;
export type SingleModelOutput = z.infer<typeof SingleModelOutputSchema>;

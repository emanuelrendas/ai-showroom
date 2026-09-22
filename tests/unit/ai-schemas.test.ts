import { describe, expect, it } from "vitest";
import {
  SingleModelInputSchema,
  SingleModelOutputSchema,
} from "@/features/ai/schemas";

const validInput = {
  workspace_id: "5f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a11",
  project_id: "6f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a22",
  mission_id: "7f8a2e10-3b1a-4c6a-9d2a-8e1b6f0c1a33",
  prompt_context: "Summarize the mission notes and produce suggested actions.",
  caller_identity: "user" as const,
};

const validOutput = {
  schema_version: "1.0.0" as const,
  summary: "The mission is on track.",
  suggested_actions: ["Follow up with the reviewer", "Update the draft"],
  confidence_score: 0.92,
  confidence_tier: "HIGH" as const,
  requires_human_review: true as const,
};

describe("SingleModelInputSchema", () => {
  it("accepts a complete valid payload", () => {
    const result = SingleModelInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts system_trigger as caller_identity", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      caller_identity: "system_trigger",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing a required field", () => {
    const withoutMissionId = {
      workspace_id: validInput.workspace_id,
      project_id: validInput.project_id,
      prompt_context: validInput.prompt_context,
      caller_identity: validInput.caller_identity,
    };
    const result = SingleModelInputSchema.safeParse(withoutMissionId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "mission_id"),
      ).toBe(true);
    }
  });

  it("rejects a non-uuid workspace_id", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      workspace_id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "workspace_id"),
      ).toBe(true);
    }
  });

  it("rejects prompt_context shorter than 10 characters", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      prompt_context: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects prompt_context longer than 10000 characters", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      prompt_context: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported caller_identity value", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      caller_identity: "autonomous_agent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with an unexpected extra key (.strict())", () => {
    const result = SingleModelInputSchema.safeParse({
      ...validInput,
      task_type: "summarize",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});

describe("SingleModelOutputSchema", () => {
  it("accepts a complete valid payload", () => {
    const result = SingleModelOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing a required field", () => {
    const withoutSummary = {
      schema_version: validOutput.schema_version,
      suggested_actions: validOutput.suggested_actions,
      confidence_score: validOutput.confidence_score,
      confidence_tier: validOutput.confidence_tier,
      requires_human_review: validOutput.requires_human_review,
    };
    const result = SingleModelOutputSchema.safeParse(withoutSummary);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "summary"),
      ).toBe(true);
    }
  });

  it("rejects a schema_version other than the literal 1.0.0", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      schema_version: "2.0.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty suggested_actions array", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      suggested_actions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a suggested_actions array with a non-string element", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      suggested_actions: ["Valid action", 42],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence_score outside the 0..1 range", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      confidence_score: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported confidence_tier value", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      confidence_tier: "VERY_HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("rejects requires_human_review set to false", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      requires_human_review: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with an unexpected extra key (.strict())", () => {
    const result = SingleModelOutputSchema.safeParse({
      ...validOutput,
      latency_ms: 1200,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});

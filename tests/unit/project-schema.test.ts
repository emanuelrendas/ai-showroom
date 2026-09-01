import { describe, expect, it } from "vitest";
import { projectInputSchema } from "@/features/projects/schema";

describe("projectInputSchema", () => {
  it("accepts a valid project", () => {
    expect(
      projectInputSchema.safeParse({
        name: "AI Ecosystem",
        description: "Core RAIOC work",
      }).success,
    ).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(
      projectInputSchema.safeParse({ name: " ", description: "" }).success,
    ).toBe(false);
  });

  it("rejects descriptions over 500 characters", () => {
    expect(
      projectInputSchema.safeParse({
        name: "Valid",
        description: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

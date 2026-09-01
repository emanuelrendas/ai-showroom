import { describe, expect, it } from "vitest";
import { missionInputSchema } from "@/features/missions/schema";

describe("missionInputSchema", () => {
  it("accepts the complete valid input", () => {
    expect(
      missionInputSchema.safeParse({
        title: "Build Model Router",
        description: "Create the future routing boundary without provider calls.",
        status: "in_progress",
        priority: "high",
      }).success,
    ).toBe(true);
  });

  it("rejects an unsupported status", () => {
    expect(
      missionInputSchema.safeParse({
        title: "Mission",
        description: "",
        status: "almost_done",
        priority: "medium",
      }).success,
    ).toBe(false);
  });

  it("rejects descriptions over 1000 characters", () => {
    expect(
      missionInputSchema.safeParse({
        title: "Mission",
        description: "x".repeat(1001),
        status: "todo",
        priority: "medium",
      }).success,
    ).toBe(false);
  });
});

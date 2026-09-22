import { describe, expect, it } from "vitest";
import {
  formatConfidenceScore,
  getConfidenceTierPresentation,
  getDraftStatusPresentation,
  isPromptContextLengthValid,
  PROMPT_CONTEXT_MAX_LENGTH,
  PROMPT_CONTEXT_MIN_LENGTH,
} from "@/features/ai/draft-presentation";

describe("getDraftStatusPresentation", () => {
  it("maps pending_review to an outline badge", () => {
    expect(getDraftStatusPresentation("pending_review")).toEqual({
      label: "Pending review",
      variant: "outline",
    });
  });

  it("maps applied to a default badge", () => {
    expect(getDraftStatusPresentation("applied")).toEqual({
      label: "Applied",
      variant: "default",
    });
  });

  it("maps dismissed to a secondary badge", () => {
    expect(getDraftStatusPresentation("dismissed")).toEqual({
      label: "Dismissed",
      variant: "secondary",
    });
  });

  it("falls back gracefully for an unknown status", () => {
    expect(getDraftStatusPresentation("archived")).toEqual({
      label: "archived",
      variant: "ghost",
    });
  });
});

describe("getConfidenceTierPresentation", () => {
  it("maps HIGH to a default badge", () => {
    expect(getConfidenceTierPresentation("HIGH")).toEqual({
      label: "High confidence",
      variant: "default",
    });
  });

  it("maps MEDIUM to a secondary badge", () => {
    expect(getConfidenceTierPresentation("MEDIUM")).toEqual({
      label: "Medium confidence",
      variant: "secondary",
    });
  });

  it("maps LOW to a destructive badge", () => {
    expect(getConfidenceTierPresentation("LOW")).toEqual({
      label: "Low confidence",
      variant: "destructive",
    });
  });

  it("falls back gracefully for an unknown tier", () => {
    expect(getConfidenceTierPresentation("UNKNOWN")).toEqual({
      label: "UNKNOWN",
      variant: "ghost",
    });
  });
});

describe("formatConfidenceScore", () => {
  it("formats a fractional score as a rounded percentage", () => {
    expect(formatConfidenceScore(0.92)).toBe("92%");
    expect(formatConfidenceScore(0.005)).toBe("1%");
    expect(formatConfidenceScore(0)).toBe("0%");
    expect(formatConfidenceScore(1)).toBe("100%");
  });
});

describe("isPromptContextLengthValid", () => {
  it("rejects strings shorter than the schema's minimum", () => {
    expect(isPromptContextLengthValid("x".repeat(PROMPT_CONTEXT_MIN_LENGTH - 1))).toBe(
      false,
    );
  });

  it("accepts strings at the boundaries", () => {
    expect(isPromptContextLengthValid("x".repeat(PROMPT_CONTEXT_MIN_LENGTH))).toBe(true);
    expect(isPromptContextLengthValid("x".repeat(PROMPT_CONTEXT_MAX_LENGTH))).toBe(true);
  });

  it("rejects strings longer than the schema's maximum", () => {
    expect(isPromptContextLengthValid("x".repeat(PROMPT_CONTEXT_MAX_LENGTH + 1))).toBe(
      false,
    );
  });
});

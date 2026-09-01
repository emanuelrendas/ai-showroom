import { describe, expect, it } from "vitest";
import { userIdFromClaimsResult } from "@/features/auth/auth-state";
import { signInSchema } from "@/features/auth/schema";

describe("authentication state", () => {
  it("extracts the authenticated subject from verified claims", () => {
    expect(
      userIdFromClaimsResult({ data: { claims: { sub: "user-123" } }, error: null }),
    ).toBe("user-123");
  });

  it("returns null when claims are unavailable", () => {
    expect(userIdFromClaimsResult({ data: null, error: new Error("invalid") })).toBeNull();
  });

  it("rejects an invalid sign-in payload", () => {
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "123" }).success,
    ).toBe(false);
  });
});

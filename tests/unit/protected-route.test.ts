import { describe, expect, it } from "vitest";
import { isProtectedAppPath } from "@/lib/supabase/proxy";

describe("isProtectedAppPath", () => {
  it("protects the app home", () => {
    expect(isProtectedAppPath("/app")).toBe(true);
  });

  it("protects workspace routes", () => {
    expect(isProtectedAppPath("/w/raioc")).toBe(true);
    expect(isProtectedAppPath("/w/raioc/projects/123")).toBe(true);
  });

  it("leaves public routes unprotected", () => {
    expect(isProtectedAppPath("/")).toBe(false);
    expect(isProtectedAppPath("/sign-in")).toBe(false);
  });
});

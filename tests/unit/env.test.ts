import { describe, expect, it } from "vitest";
import { getPublicSupabaseEnv } from "@/lib/env";

describe("getPublicSupabaseEnv", () => {
  it("returns the two required public values", () => {
    expect(
      getPublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("fails fast when configuration is missing", () => {
    expect(() => getPublicSupabaseEnv({})).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

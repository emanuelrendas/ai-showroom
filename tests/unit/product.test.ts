import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/product";

describe("product identity", () => {
  it("uses the locked AI Showroom name", () => {
    expect(PRODUCT_NAME).toBe("AI SHOWROOM");
  });
});

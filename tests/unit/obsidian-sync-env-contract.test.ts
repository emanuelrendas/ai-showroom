import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Obsidian Sync Environment Contract (.env.example)", () => {
  const envExamplePath = path.resolve(__dirname, "../../.env.example");
  const envContent = fs.readFileSync(envExamplePath, "utf-8");

  function parseEnvLines(content: string) {
    const lines = content.split(/\r?\n/);
    const keys: string[] = [];
    const map = new Map<string, string>();
    const duplicates: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();

      if (keys.includes(key)) {
        duplicates.push(key);
      }
      keys.push(key);
      map.set(key, val);
    }

    return { keys, map, duplicates };
  }

  it("preserves the existing Supabase example contract", () => {
    const { map } = parseEnvLines(envContent);
    expect(map.has("NEXT_PUBLIC_SUPABASE_URL")).toBe(true);
    expect(map.get("NEXT_PUBLIC_SUPABASE_URL")).toBe("https://example.supabase.co");
    expect(map.has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toBe(true);
    expect(map.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toBe(
      "sb_publishable_example_not_a_real_key",
    );
  });

  it("documents required AI Showroom Obsidian sync keys", () => {
    const { map } = parseEnvLines(envContent);
    expect(map.has("AI_SHOWROOM_VAULT_PATH")).toBe(true);
    expect(map.get("AI_SHOWROOM_VAULT_PATH")?.length).toBeGreaterThan(0);

    expect(map.has("AI_SHOWROOM_VAULT_REMOTE")).toBe(true);
    expect(map.get("AI_SHOWROOM_VAULT_REMOTE")).toBe(
      "https://github.com/emanuelrendas/raioc-obsidian-vault2.git",
    );
  });

  it("documents AI_SHOWROOM_FOUNDATION_REVIEW_ARM as empty and unarmed", () => {
    const { map } = parseEnvLines(envContent);
    expect(map.has("AI_SHOWROOM_FOUNDATION_REVIEW_ARM")).toBe(true);
    expect(map.get("AI_SHOWROOM_FOUNDATION_REVIEW_ARM")).toBe("");
    expect(map.get("AI_SHOWROOM_FOUNDATION_REVIEW_ARM")).not.toBe("AUTHORIZED_BY_TIAGO");
  });

  it("does not advertise retired, closed-task, or test-only variables", () => {
    const { map } = parseEnvLines(envContent);
    const retiredKeys = [
      "AI_SHOWROOM_GATE_G_ARM",
      "AI_SHOWROOM_CANARY_APPLICATION_SHA",
      "AI_SHOWROOM_FOUNDATION_DOSSIER_CREATE_ARM",
      "AI_SHOWROOM_REVIEW_CLOSURE_ARM",
      "AI_SHOWROOM_VAULT_TOKEN",
    ];

    for (const key of retiredKeys) {
      expect(map.has(key)).toBe(false);
      expect(envContent).not.toContain(key);
    }
  });

  it("contains no duplicate AI_SHOWROOM_* contract keys", () => {
    const { duplicates } = parseEnvLines(envContent);
    expect(duplicates).toEqual([]);
  });

  it("contains no secrets, private keys, or credential material", () => {
    expect(envContent).not.toMatch(/-----BEGIN/);
    expect(envContent).not.toMatch(/bearer\s+/i);
    expect(envContent).not.toMatch(/secret_key/i);
    expect(envContent).not.toMatch(/password/i);
  });
});

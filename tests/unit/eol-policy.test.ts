import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const gitattributesPath = path.resolve(import.meta.dirname, "../../.gitattributes");

describe("EOL policy (FIND-T2-005)", () => {
  it("declares a .gitattributes file at the repo root", () => {
    expect(fs.existsSync(gitattributesPath)).toBe(true);
  });

  it("normalizes all text files to LF on checkin and checkout", () => {
    const contents = fs.readFileSync(gitattributesPath, "utf8");
    expect(contents).toMatch(/^\*\s+text=auto\s+eol=lf\s*$/m);
  });
});

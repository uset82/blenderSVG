import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAgentProfile } from "../src/subagentProfiles.js";

const designDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../skills/design");

describe("design skills", () => {
  it("includes the six prompt packs", () => {
    const names = readdirSync(designDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => parseAgentProfile(readFileSync(path.join(designDir, file), "utf8")).name);
    expect(names.sort()).toEqual(["Avatar", "Dashboard", "Icon set", "Landing", "Logo", "Mobile"]);
  });
});

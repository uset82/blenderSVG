import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESIGN_SKILLS } from "../src/components/designSkills.js";

describe("design skills", () => {
  it("matches the prompt packs in skills/design", () => {
    const directory = fileURLToPath(new URL("../../../skills/design/", import.meta.url));
    const fromDisk = readdirSync(directory)
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const source = readFileSync(path.join(directory, file), "utf8");
        const name = source.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
        const prompt = source.split(/^---$/m).at(-1)?.trim() ?? "";
        return { id: file.replace(/\.md$/, ""), name, prompt };
      })
      .sort((left, right) => left.id.localeCompare(right.id));
    const bundled = [...DESIGN_SKILLS].sort((left, right) => left.id.localeCompare(right.id));
    expect(bundled).toEqual(fromDisk);
  });
});

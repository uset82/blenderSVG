import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESIGN_SKILLS } from "../src/designSkills.js";
import { parseAgentProfile } from "../src/subagentProfiles.js";

const designDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../skills/design");

describe("design skills", () => {
  it("includes the design skills, each with a real guide", () => {
    const profiles = readdirSync(designDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => parseAgentProfile(readFileSync(path.join(designDir, file), "utf8")));
    expect(profiles.map((profile) => profile.name).sort()).toEqual([
      "Avatar",
      "Dashboard",
      "Icon set",
      "Illustration",
      "Landing page",
      "Logo",
      "Mobile app",
      "Slides",
      "Web app"
    ]);
    for (const profile of profiles) expect(profile.body.length).toBeGreaterThan(200);
  });

  it("keeps the bundled skills equal to the Markdown files", () => {
    const fromDisk = readdirSync(designDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const profile = parseAgentProfile(readFileSync(path.join(designDir, file), "utf8"));
        return { id: file.replace(/\.md$/, ""), name: profile.name, prompt: profile.body };
      })
      .sort((left, right) => left.id.localeCompare(right.id));
    expect([...DESIGN_SKILLS].sort((left, right) => left.id.localeCompare(right.id))).toEqual(fromDisk);
  });
});

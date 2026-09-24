import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canStartSubagent, parseAgentProfile } from "../src/subagentProfiles.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("subagent profiles", () => {
  it("loads Designer, Reviewer, and Vectorizer and allows only one nesting level", () => {
    const profiles = ["designer", "reviewer", "vectorizer"].map((name) =>
      parseAgentProfile(readFileSync(path.join(root, "skills", "agents", `${name}.md`), "utf8"))
    );
    expect(profiles.map((profile) => profile.name)).toEqual(["Designer", "Reviewer", "Vectorizer"]);
    expect(profiles[1]?.tools).toContain("screenshot_frame");
    expect(profiles[1]?.body).toMatch(/vision model/);
    expect(profiles.every((profile) => profile.body.includes("do not start another agent"))).toBe(true);
    expect(canStartSubagent(0)).toBe(true);
    expect(canStartSubagent(1)).toBe(false);
  });
});

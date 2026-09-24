import { describe, expect, it } from "vitest";
import { AGENT_EMPTY_HEADLINE, AGENT_EMPTY_TIPS, AGENT_SUGGESTIONS } from "../src/components/agentEmptyState.js";

describe("agent empty state", () => {
  it("offers six suggestions and two tips in our own words", () => {
    expect(AGENT_EMPTY_HEADLINE).toBe("Ask me to design anything");
    expect(AGENT_SUGGESTIONS).toHaveLength(6);
    expect(AGENT_EMPTY_TIPS).toHaveLength(2);
    expect(AGENT_EMPTY_TIPS[0]).toMatch(/Export/);
    expect(AGENT_EMPTY_TIPS[1]).toMatch(/Attach/);
    expect(AGENT_SUGGESTIONS.join(" ")).not.toMatch(/pen\.dev/i);
  });
});

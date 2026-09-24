import { describe, expect, it } from "vitest";
import { sessionPillStatus } from "../src/components/agentSessions.js";

describe("agent session pill", () => {
  it("marks only the active chat as running or finished", () => {
    expect(sessionPillStatus(true, "streaming")).toBe("running");
    expect(sessionPillStatus(true, "stopping")).toBe("running");
    expect(sessionPillStatus(true, "complete")).toBe("finished");
    expect(sessionPillStatus(false, "streaming")).toBe("idle");
    expect(sessionPillStatus(true, null)).toBe("idle");
  });
});

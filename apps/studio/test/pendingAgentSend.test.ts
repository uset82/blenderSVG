/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { savePendingAgentSend, takePendingAgentSend } from "../src/components/pendingAgentSend.js";

afterEach(() => window.sessionStorage.clear());

describe("pending agent send", () => {
  it("keeps a message across a redirect for the same project, once", () => {
    savePendingAgentSend({ projectId: "p1", text: "Design a landing page", skill: "landing" }, 1_000);
    expect(takePendingAgentSend("p2", 2_000)).toBeNull();
    expect(takePendingAgentSend("p1", 2_000)).toEqual({
      projectId: "p1",
      text: "Design a landing page",
      skill: "landing",
      savedAt: 1_000
    });
    expect(takePendingAgentSend("p1", 3_000)).toBeNull();
  });

  it("drops a stale or malformed entry", () => {
    savePendingAgentSend({ projectId: "p1", text: "Old" }, 0);
    expect(takePendingAgentSend("p1", 31 * 60_000)).toBeNull();
    window.sessionStorage.setItem("kurva-pending-agent-send", "{not json");
    expect(takePendingAgentSend("p1")).toBeNull();
  });
});

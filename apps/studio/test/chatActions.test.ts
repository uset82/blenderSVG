import { describe, expect, it } from "vitest";
import { canStartSend, lastExchange } from "../src/components/chatActions.js";

describe("chat actions", () => {
  it("refuses a second send while one is running or waiting for review", () => {
    expect(canStartSend({ busy: false, previewOpen: false })).toBe(true);
    expect(canStartSend({ busy: true, previewOpen: false })).toBe(false);
    expect(canStartSend({ busy: false, previewOpen: true })).toBe(false);
  });

  it("finds the last user message", () => {
    const messages = [
      { role: "user" as const, content: "First" },
      { role: "assistant" as const, content: "Reply" },
      { role: "user" as const, content: "Second" }
    ];
    expect(lastExchange(messages)?.user.content).toBe("Second");
    expect(lastExchange([])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { capCanvasSummary, compactHistory, contextCharacterBudget } from "../src/components/contextBudget.js";

describe("context budget", () => {
  it("derives a character budget from context length and compacts older messages", () => {
    expect(contextCharacterBudget(128_000)).toBeGreaterThan(contextCharacterBudget(8_000));
    const messages = Array.from({ length: 5 }, (_, index) => ({ content: "x".repeat(3_000), id: index }));
    const compact = compactHistory(messages, 2_000);
    expect(compact.history.length).toBeLessThan(messages.length);
    expect(compact.omittedMessages).toBe(messages.length - compact.history.length);
    expect(compact.history.at(-1)?.id).toBe(4);
  });

  it("caps a long canvas summary", () => {
    expect(capCanvasSummary("short")).toBe("short");
    expect(capCanvasSummary("y".repeat(2_000)).endsWith("…")).toBe(true);
    expect(capCanvasSummary("y".repeat(2_000)).length).toBe(1_500);
  });
});

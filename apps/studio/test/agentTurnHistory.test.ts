import { describe, expect, it, vi } from "vitest";
import { beginAgentTurnChange } from "../src/components/agentTurnHistory.js";

describe("agent turn history", () => {
  it("marks one stopping point per request, before its first change", () => {
    const editor = { markHistoryStoppingPoint: vi.fn() };
    const marked = new Set<string>();
    beginAgentTurnChange(editor, marked, "chat-1");
    beginAgentTurnChange(editor, marked, "chat-1");
    beginAgentTurnChange(editor, marked, "chat-2");
    expect(editor.markHistoryStoppingPoint.mock.calls).toEqual([["agent-turn:chat-1"], ["agent-turn:chat-2"]]);
  });
});

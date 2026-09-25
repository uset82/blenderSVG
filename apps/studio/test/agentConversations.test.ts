import { describe, expect, it } from "vitest";
import {
  conversationTitleFromMessage,
  createAgentConversation,
  formatConversationStamp,
  restoreConversationMessages
} from "../src/components/agentConversations.js";

describe("agent conversations", () => {
  it("starts a session with a title, model, and time", () => {
    const conversation = createAgentConversation("openrouter/auto", "2026-09-24T06:00:00.000Z");
    expect(conversation.title).toBe("New agent");
    expect(conversation.modelId).toBe("openrouter/auto");
    expect(formatConversationStamp(conversation.updatedAt)).not.toBe("");
  });

  it("uses the first message as the title", () => {
    expect(conversationTitleFromMessage("  Design a   landing page  ")).toBe("Design a landing page");
    expect(conversationTitleFromMessage("   ")).toBe("New agent");
  });

  it("restores saved messages as a completed transcript", () => {
    expect(
      restoreConversationMessages({
        id: "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6",
        title: "Landing",
        modelId: "openrouter/auto",
        updatedAt: "2026-09-24T07:00:00.000Z",
        messages: [
          { role: "user", content: "Frame a page" },
          { role: "assistant", content: "I have a first layout." }
        ]
      })
    ).toEqual([
      {
        id: "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6-0",
        role: "user",
        content: "Frame a page",
        status: "complete"
      },
      {
        id: "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6-1",
        role: "assistant",
        content: "I have a first layout.",
        status: "complete"
      }
    ]);
  });
});

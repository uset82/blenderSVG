import { describe, expect, it } from "vitest";
import {
  conversationTitleFromMessage,
  createAgentConversation,
  formatConversationStamp
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
});

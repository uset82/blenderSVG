export interface AgentConversation {
  id: string;
  title: string;
  modelId: string;
  updatedAt: string;
}

export interface StoredAgentConversation extends AgentConversation {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface RestoredConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete";
}

export function restoreConversationMessages(conversation: StoredAgentConversation): RestoredConversationMessage[] {
  return conversation.messages.map((message, index) => ({
    id: `${conversation.id}-${index}`,
    role: message.role,
    content: message.content,
    status: "complete"
  }));
}

export function createAgentConversation(modelId: string, now = new Date().toISOString()): AgentConversation {
  return { id: crypto.randomUUID(), title: "New agent", modelId, updatedAt: now };
}

export function conversationTitleFromMessage(text: string): string {
  const title = text.trim().replace(/\s+/g, " ").slice(0, 48);
  return title || "New agent";
}

export function formatConversationStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

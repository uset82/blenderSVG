export function canStartSend(input: { busy: boolean; previewOpen: boolean }): boolean {
  return !input.busy && !input.previewOpen;
}

export function lastExchange<T extends { role: "user" | "assistant" }>(
  messages: readonly T[]
): { userIndex: number; user: T } | null {
  const userIndex = messages.map((message) => message.role).lastIndexOf("user");
  const user = userIndex >= 0 ? messages[userIndex] : undefined;
  return user ? { userIndex, user } : null;
}

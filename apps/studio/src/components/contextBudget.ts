const FALLBACK_CONTEXT_TOKENS = 8_000;
const CANVAS_SUMMARY_CAP = 1_500;

/** Character budget from the model's context length, leaving room for the reply. */
export function contextCharacterBudget(contextLength: number): number {
  const tokens =
    Number.isFinite(contextLength) && contextLength > 0 ? Math.floor(contextLength) : FALLBACK_CONTEXT_TOKENS;
  const reserved = Math.min(2_048, Math.floor(tokens / 4));
  return Math.max(1_000, (tokens - reserved) * 4);
}

export function capCanvasSummary(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length <= CANVAS_SUMMARY_CAP) return trimmed;
  return `${trimmed.slice(0, CANVAS_SUMMARY_CAP - 1)}…`;
}

export function compactHistory<T extends { content: string }>(
  messages: readonly T[],
  contextLength: number
): { history: T[]; omittedMessages: number } {
  const budget = contextCharacterBudget(contextLength);
  const selected: T[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) break;
    if (characters + message.content.length > budget) break;
    selected.push(message);
    characters += message.content.length;
  }
  selected.reverse();
  return { history: selected, omittedMessages: messages.length - selected.length };
}

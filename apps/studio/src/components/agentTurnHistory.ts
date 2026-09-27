import type { Editor } from "tldraw";

/**
 * One Undo reverts a whole agent reply. Before the first canvas change of a request, this marks a
 * history stopping point; the tools of that request then run without their own marks, so every change
 * in the reply lands in one undo step. Each request is marked once.
 */
export function beginAgentTurnChange(
  editor: Pick<Editor, "markHistoryStoppingPoint">,
  marked: Set<string>,
  requestId: string
): void {
  if (marked.has(requestId)) return;
  marked.add(requestId);
  editor.markHistoryStoppingPoint(`agent-turn:${requestId}`);
  // Keep the set small; old requests never execute again.
  if (marked.size > 50) marked.delete(marked.values().next().value as string);
}

export type TurnState =
  | "input"
  | "model"
  | "streaming"
  | "schedule-tools"
  | "await-permission"
  | "execute"
  | "aggregate"
  | "done"
  | "error";

export interface ToolCallDraft {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

export interface TurnSnapshot {
  state: TurnState;
  text: string;
  tools: ToolCallDraft[];
  toolRound: number;
  error: string | null;
}

export type TurnInput =
  | { type: "start" }
  | { type: "text"; text: string }
  | { type: "tool-delta"; index: number; id?: string; name?: string; arguments?: string }
  | { type: "stream-end" }
  | { type: "permission"; granted: boolean }
  | { type: "tool-result"; ok: boolean }
  | { type: "cancel" };

export function createTurn(maxToolRounds = 4): TurnSnapshot {
  return { state: "input", text: "", tools: [], toolRound: 0, error: null };
}

export function reduceTurn(current: TurnSnapshot, event: TurnInput, maxToolRounds = 4): TurnSnapshot {
  if (current.state === "done" || current.state === "error") return current;
  if (event.type === "cancel") return { ...current, state: "error", error: "The turn was cancelled." };
  if (current.state === "input" && event.type === "start") return { ...current, state: "model" };
  if (current.state === "model" && (event.type === "text" || event.type === "tool-delta")) {
    return reduceTurn({ ...current, state: "streaming" }, event, maxToolRounds);
  }
  if (current.state === "streaming" && event.type === "text") {
    return { ...current, text: current.text + event.text };
  }
  if (current.state === "streaming" && event.type === "tool-delta") {
    return { ...current, tools: applyToolDelta(current.tools, event) };
  }
  if (current.state === "streaming" && event.type === "stream-end") {
    if (current.tools.length === 0) return { ...current, state: "done" };
    if (current.toolRound >= maxToolRounds) {
      return { ...current, state: "error", error: "The turn reached its tool limit." };
    }
    return { ...current, state: "schedule-tools" };
  }
  if (current.state === "schedule-tools") return { ...current, state: "await-permission" };
  if (current.state === "await-permission" && event.type === "permission") {
    if (!event.granted) return { ...current, state: "error", error: "The tool call was not approved." };
    return { ...current, state: "execute" };
  }
  if (current.state === "execute" && event.type === "tool-result") {
    if (!event.ok) return { ...current, state: "error", error: "A tool call failed." };
    return { ...current, state: "aggregate", toolRound: current.toolRound + 1, tools: [] };
  }
  if (current.state === "aggregate") return { ...current, state: "model" };
  return current;
}

export function applyToolDelta(
  tools: ToolCallDraft[],
  delta: { index: number; id?: string; name?: string; arguments?: string }
): ToolCallDraft[] {
  const next = tools.map((tool) => ({ ...tool }));
  const existing = next.find((tool) => tool.index === delta.index);
  if (!existing) {
    next.push({
      index: delta.index,
      id: delta.id ?? "",
      name: delta.name ?? "",
      arguments: delta.arguments ?? ""
    });
    return next;
  }
  if (delta.id) existing.id = delta.id;
  if (delta.name) existing.name += delta.name;
  if (delta.arguments) existing.arguments += delta.arguments;
  return next;
}

export function toolTimeoutMs(name: string): number {
  return name.startsWith("screenshot") ? 15_000 : 8_000;
}

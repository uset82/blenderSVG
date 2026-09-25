export type ToolCallStatus = "proposed" | "running" | "applied" | "rejected" | "error";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  status: ToolCallStatus;
  durationMs: number | null;
  startedAt?: number;
  result: string | null;
}

export function withToolTiming<T extends ToolCallRecord>(call: T, status: ToolCallStatus, now = Date.now()): T {
  if (status === "running") return { ...call, status, startedAt: call.startedAt ?? now };
  if (call.startedAt !== undefined && (status === "applied" || status === "error" || status === "rejected")) {
    return { ...call, status, durationMs: Math.max(0, now - call.startedAt) };
  }
  return { ...call, status };
}

export function argumentSummary(args: string): string {
  const trimmed = args.trim().replace(/\s+/g, " ");
  if (!trimmed) return "No arguments.";
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

export function durationLabel(durationMs: number | null): string {
  return durationMs === null ? "Duration not recorded." : `${durationMs} ms`;
}

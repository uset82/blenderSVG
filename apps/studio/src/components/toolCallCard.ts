export type ToolCallStatus = "proposed" | "running" | "applied" | "rejected" | "error";

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  status: ToolCallStatus;
  durationMs: number | null;
  result: string | null;
}

export function argumentSummary(args: string): string {
  const trimmed = args.trim().replace(/\s+/g, " ");
  if (!trimmed) return "No arguments.";
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

export function durationLabel(durationMs: number | null): string {
  return durationMs === null ? "Duration not recorded." : `${durationMs} ms`;
}

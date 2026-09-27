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

/** Long markup fields are summarized by size, so a page of HTML never floods the card. */
const MARKUP_FIELDS = new Set(["html", "svg"]);

export function argumentSummary(args: string): string {
  const trimmed = args.trim().replace(/\s+/g, " ");
  if (!trimmed) return "No arguments.";
  try {
    const value = JSON.parse(args) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.some(([key, item]) => MARKUP_FIELDS.has(key) && typeof item === "string")) {
        const parts = entries.map(([key, item]) =>
          MARKUP_FIELDS.has(key) && typeof item === "string"
            ? `${key}: ${item.length.toLocaleString("en-US")} characters`
            : `${key}: ${JSON.stringify(item)}`
        );
        const summary = parts.join(", ");
        return summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;
      }
    }
  } catch {
    // Not JSON; summarize the raw text below.
  }
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

/** "Writing the design… 12.4k characters" while the model streams a long tool call. */
export function writingLabel(writing: { name?: string; chars: number }): string {
  const size =
    writing.chars >= 1_000 ? `${(writing.chars / 1_000).toFixed(1)}k characters` : `${writing.chars} characters`;
  const what =
    writing.name === "insert_svg"
      ? "the drawing"
      : writing.name?.includes("design_frame")
        ? "the design"
        : (writing.name?.replaceAll("_", " ") ?? "a canvas change");
  return `Writing ${what}… ${size}`;
}

export function durationLabel(durationMs: number | null): string {
  return durationMs === null ? "Duration not recorded." : `${durationMs} ms`;
}

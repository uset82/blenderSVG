import type { CanvasTool } from "./canvasTools.js";

export type ComposerMode = "ask" | "plan" | "build" | "auto";

/** Design (auto) and Review (build) turns make real designs, so they get the larger budget. */
export function isDesignMode(mode: ComposerMode): boolean {
  return mode === "auto" || mode === "build";
}

export interface TurnLimits {
  /** Model rounds that may call tools. One more round without tools may follow for a summary. */
  maxToolRounds: number;
  /** Calls run per round. Extra calls are answered with an error so the model can repeat them. */
  maxCallsPerRound: number;
  /** Rounds in a row in which every call failed before the turn stops calling tools. */
  maxFailedRounds: number;
  /** Visible reply characters across the whole turn. */
  maxReplyChars: number;
}

export function turnLimits(mode: ComposerMode): TurnLimits {
  if (isDesignMode(mode)) return { maxToolRounds: 8, maxCallsPerRound: 8, maxFailedRounds: 3, maxReplyChars: 200_000 };
  return { maxToolRounds: 4, maxCallsPerRound: 6, maxFailedRounds: 3, maxReplyChars: 64_000 };
}

/** Tool calls the stream may carry in one round; calls beyond the per-round limit get an error result. */
export const MAX_STREAMED_TOOL_CALLS = 16;

/**
 * Whether a call waits for the user. Design (auto) applies everything except screenshots, which send
 * a picture of the canvas; Plan only has read tools; Review (build) asks before each change.
 */
export function toolNeedsApproval(mode: ComposerMode, tool: Pick<CanvasTool, "name" | "readOnly">): boolean {
  if (tool.name === "screenshot_frame") return true;
  if (mode === "auto" || mode === "plan") return false;
  if (mode === "build") return !tool.readOnly;
  return true;
}

const DESIGN_TOOLS = new Set([
  "create_design_frame",
  "get_design_frame",
  "update_design_frame",
  "patch_design_frame",
  "insert_svg"
]);

/** How long the canvas may take to apply one call. Design tools sanitize and measure whole pages. */
export function toolTimeoutMs(name: string): number {
  if (name.startsWith("screenshot")) return 15_000;
  if (DESIGN_TOOLS.has(name)) return 20_000;
  return 8_000;
}

export const DEFAULT_COMPLETION_TOKENS = 16_000;
export const MIN_COMPLETION_TOKENS = 4_096;
export const MAX_COMPLETION_TOKENS = 32_000;

/**
 * Output tokens to ask for: the model's own completion limit when the catalog gives one, clamped to
 * 4k–32k (a full page of HTML needs well over 2k), and never more than half the context window.
 */
export function completionTokenBudget(model: {
  maxCompletionTokens?: number | null | undefined;
  contextLength: number;
}): number {
  const advertised =
    typeof model.maxCompletionTokens === "number" && model.maxCompletionTokens > 0
      ? model.maxCompletionTokens
      : DEFAULT_COMPLETION_TOKENS;
  let budget = Math.min(MAX_COMPLETION_TOKENS, Math.max(MIN_COMPLETION_TOKENS, Math.floor(advertised)));
  if (model.contextLength > 0) budget = Math.min(budget, Math.floor(model.contextLength / 2));
  return Math.max(1_024, budget);
}

/**
 * OpenRouter answers 402 with "…can only afford N…" when the account's credit covers fewer output
 * tokens than requested. Returns a smaller budget to retry with, or null when a retry cannot help.
 */
export function affordableCompletionTokens(errorText: string, requested: number): number | null {
  const match = /can only afford (\d+)/i.exec(errorText);
  if (!match?.[1]) return null;
  const affordable = Number.parseInt(match[1], 10) - 256;
  if (!Number.isFinite(affordable) || affordable < 1_024 || affordable >= requested) return null;
  return affordable;
}

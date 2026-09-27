/** Menu order: Design first, since making things is what the panel is for. */
export const COMPOSER_MODES = ["auto", "build", "plan", "ask"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

export const DEFAULT_COMPOSER_MODE: ComposerMode = "auto";
const MODE_STORAGE_KEY = "kurva-composer-mode";

/** The names people see. The ids stay the protocol's ask/plan/build/auto. */
export function modeLabel(mode: ComposerMode): string {
  if (mode === "auto") return "Design";
  if (mode === "build") return "Review";
  if (mode === "plan") return "Plan";
  return "Chat";
}

export function readStoredComposerMode(): ComposerMode {
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return (COMPOSER_MODES as readonly string[]).includes(stored ?? "")
      ? (stored as ComposerMode)
      : DEFAULT_COMPOSER_MODE;
  } catch {
    return DEFAULT_COMPOSER_MODE;
  }
}

export function storeComposerMode(mode: ComposerMode): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // The mode is still used for this session when browser storage is unavailable.
  }
}

const READ_TOOLS = new Set(["get_canvas_summary", "get_selection", "get_frame_tree", "screenshot_frame", "get_styles"]);

export function nextComposerMode(mode: ComposerMode): ComposerMode {
  const index = COMPOSER_MODES.indexOf(mode);
  return COMPOSER_MODES[(index + 1) % COMPOSER_MODES.length] ?? DEFAULT_COMPOSER_MODE;
}

export function modeDescription(mode: ComposerMode): string {
  if (mode === "ask") return "Chat: talk about design. The canvas is not changed.";
  if (mode === "plan") return "Plan: reads the canvas and proposes a plan without changing it.";
  if (mode === "build") return "Review: reads freely and asks before each canvas change.";
  return "Design: makes and edits designs on the canvas. One Undo reverts the whole reply.";
}

/** A short status for the panel header. */
export function modeToolsLabel(mode: ComposerMode, supportsTools: boolean): string {
  if (mode === "ask") return "Chat only";
  if (!supportsTools) return mode === "plan" ? "Plan (no canvas tools)" : "Designs as code";
  if (mode === "plan") return "Reads the canvas";
  if (mode === "build") return "Asks before changes";
  return "Edits the canvas";
}

export function toolsForMode(mode: ComposerMode): "none" | "read" | "all" {
  if (mode === "ask") return "none";
  if (mode === "plan") return "read";
  return "all";
}

export function toolNeedsApproval(mode: ComposerMode, tool: { name: string; readOnly: boolean }): boolean {
  const external = tool.name.startsWith("file_") || tool.name.startsWith("blender_");
  if (external) return true;
  if (mode === "ask") return true;
  if (mode === "plan") return !READ_TOOLS.has(tool.name);
  if (mode === "build") return !tool.readOnly;
  return false;
}

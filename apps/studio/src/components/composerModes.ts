export const COMPOSER_MODES = ["ask", "plan", "build", "auto"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

const READ_TOOLS = new Set(["get_canvas_summary", "get_selection", "get_frame_tree", "screenshot_frame", "get_styles"]);

export function nextComposerMode(mode: ComposerMode): ComposerMode {
  const index = COMPOSER_MODES.indexOf(mode);
  return COMPOSER_MODES[(index + 1) % COMPOSER_MODES.length] ?? "ask";
}

export function modeDescription(mode: ComposerMode): string {
  if (mode === "ask") return "Ask: chat only. No canvas tools are offered.";
  if (mode === "plan") return "Plan: read tools only. The reply lists steps and does not change the canvas.";
  if (mode === "build") return "Build: write tools are previewed and wait for approval.";
  return "Auto: canvas changes apply as one undo step. File and Blender tools still wait for approval.";
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

import type { ComposerMode } from "./composerModes.js";

/**
 * A model without tool support keeps the chosen mode. In Design and Review it returns pages and
 * drawings as code blocks, which Studio places on the canvas; Plan and Chat need no tools.
 */
export function effectiveComposerMode(
  mode: ComposerMode,
  supportsTools: boolean
): { mode: ComposerMode; reason: string | null } {
  if (supportsTools || mode === "ask" || mode === "plan") return { mode, reason: null };
  return {
    mode,
    reason: "This model cannot use canvas tools, so its designs come back as code that Studio places on the canvas."
  };
}

import type { ComposerMode } from "./composerModes.js";

export function effectiveComposerMode(
  mode: ComposerMode,
  supportsTools: boolean
): { mode: ComposerMode; reason: string | null } {
  if (supportsTools || mode === "ask") return { mode, reason: null };
  return {
    mode: "ask",
    reason: "This model does not list tool support, so Studio uses Ask mode."
  };
}

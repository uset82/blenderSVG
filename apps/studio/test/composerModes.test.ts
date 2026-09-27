import { describe, expect, it } from "vitest";
import {
  COMPOSER_MODES,
  DEFAULT_COMPOSER_MODE,
  modeLabel,
  modeToolsLabel,
  nextComposerMode,
  toolNeedsApproval,
  toolsForMode
} from "../src/components/composerModes.js";

describe("composer modes", () => {
  it("cycles Design, Review, Plan and Chat, starting from Design", () => {
    expect(DEFAULT_COMPOSER_MODE).toBe("auto");
    expect(COMPOSER_MODES.map(modeLabel)).toEqual(["Design", "Review", "Plan", "Chat"]);
    expect(nextComposerMode("auto")).toBe("build");
    expect(nextComposerMode("build")).toBe("plan");
    expect(nextComposerMode("plan")).toBe("ask");
    expect(nextComposerMode("ask")).toBe("auto");
    expect(modeToolsLabel("auto", true)).toBe("Edits the canvas");
    expect(modeToolsLabel("auto", false)).toBe("Designs as code");
    expect(toolsForMode("ask")).toBe("none");
    expect(toolsForMode("plan")).toBe("read");
    expect(toolsForMode("build")).toBe("all");
  });

  it("asks before writes in build, and always asks for file or Blender tools", () => {
    expect(toolNeedsApproval("build", { name: "create_frame", readOnly: false })).toBe(true);
    expect(toolNeedsApproval("build", { name: "get_selection", readOnly: true })).toBe(false);
    expect(toolNeedsApproval("auto", { name: "delete_shapes", readOnly: false })).toBe(false);
    expect(toolNeedsApproval("auto", { name: "blender_export", readOnly: false })).toBe(true);
    expect(toolNeedsApproval("plan", { name: "create_frame", readOnly: false })).toBe(true);
  });
});

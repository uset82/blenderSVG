import { describe, expect, it } from "vitest";
import { nextComposerMode, toolNeedsApproval, toolsForMode } from "../src/components/composerModes.js";

describe("composer modes", () => {
  it("cycles ask, plan, build, and auto", () => {
    expect(nextComposerMode("ask")).toBe("plan");
    expect(nextComposerMode("plan")).toBe("build");
    expect(nextComposerMode("build")).toBe("auto");
    expect(nextComposerMode("auto")).toBe("ask");
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

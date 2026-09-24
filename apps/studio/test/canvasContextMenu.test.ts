import { describe, expect, it } from "vitest";
import { canvasMenuItems, describeSelection } from "../src/components/canvasContextMenu.js";

describe("canvas context menu", () => {
  it("disables selection actions until something is selected and paste until a copy exists", () => {
    const items = canvasMenuItems({ selectedCount: 0, canPaste: false, snapEnabled: false });
    expect(items.find((item) => item.id === "copy")?.enabled).toBe(false);
    expect(items.find((item) => item.id === "paste")?.reason).toBe("Copy a selection in this canvas first.");
    expect(items.find((item) => item.id === "group")?.enabled).toBe(false);
  });

  it("enables group only for two or more shapes", () => {
    const two = canvasMenuItems({ selectedCount: 2, canPaste: true, snapEnabled: true });
    expect(two.find((item) => item.id === "group")?.enabled).toBe(true);
    expect(two.find((item) => item.id === "align-left")?.enabled).toBe(true);
    expect(two.find((item) => item.id === "distribute-horizontal")?.enabled).toBe(false);
    expect(two.find((item) => item.id === "snap")?.label).toBe("Turn snapping off");
    expect(two.find((item) => item.id === "undo")?.shortcut).toBe("Ctrl+Z");
  });

  it("describes the real selection for the agent composer", () => {
    expect(describeSelection([{ type: "frame", label: "Frame", w: 1080, h: 720 }])).toBe(
      "About this selection: frame “Frame” (1080×720)."
    );
    expect(describeSelection([])).toBe("");
  });
});

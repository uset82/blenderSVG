import type { Editor } from "tldraw";
import { describe, expect, it } from "vitest";
import { buildDesignContext } from "../src/components/designContext.js";

function stubEditor(selected: string[] = []) {
  const shapes = [
    { id: "shape:empty", type: "frame", parentId: "page:1", x: 0, y: 0, props: { w: 1440, h: 1024, name: "Frame" } },
    { id: "shape:full", type: "frame", parentId: "page:1", x: 0, y: 1200, props: { w: 800, h: 600, name: "Board" } },
    { id: "shape:note", type: "note", parentId: "shape:full", x: 10, y: 10, props: {} },
    {
      id: "shape:page",
      type: "design-frame",
      parentId: "page:1",
      x: 1600,
      y: 0,
      props: { w: 1440, h: 3180, name: "Clay & Kiln", html: "<main>Clay</main>" }
    },
    { id: "shape:cat", type: "vector-studio", parentId: "page:1", x: 3200, y: 0, props: { w: 320, h: 256 } }
  ];
  return {
    getCurrentPageId: () => "page:1",
    getCurrentPage: () => ({ name: "Scratchpad" }),
    getCurrentPageShapes: () => shapes,
    getShapePageBounds: (id: string) => {
      const shape = shapes.find((item) => item.id === id);
      return shape ? { x: shape.x, y: shape.y, w: (shape.props as { w?: number }).w ?? 0, h: 0 } : undefined;
    },
    getSelectedShapeIds: () => selected,
    getSelectedShapes: () => shapes.filter((shape) => selected.includes(shape.id))
  } as unknown as Editor;
}

describe("design context", () => {
  it("lists frames, design frames and drawings, marks empty frames, and keeps the selection", () => {
    const context = buildDesignContext(stubEditor(["shape:page"]));
    expect(context.pageName).toBe("Scratchpad");
    expect(context.frames.map((frame) => [frame.id, frame.kind, frame.empty ?? false])).toEqual([
      ["shape:empty", "frame", true],
      ["shape:full", "frame", false],
      ["shape:page", "design-frame", false],
      ["shape:cat", "svg", false]
    ]);
    expect(context.frames[2]).toMatchObject({ name: "Clay & Kiln", width: 1440, height: 3180 });
    expect(context.selectedIds).toEqual(["shape:page"]);
    expect(context.target).toBeUndefined();
  });

  it("gives a model without tools the HTML of the selected, or only, design frame", () => {
    expect(buildDesignContext(stubEditor(), { includeTarget: true }).target).toEqual({
      id: "shape:page",
      name: "Clay & Kiln",
      html: "<main>Clay</main>"
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildLayerForest,
  flattenLayerForest,
  type LayerShape,
  layerWindow,
  reorderSiblingIndexes
} from "../src/components/layerTree.js";

const page = "page:page";

function shape(partial: Partial<LayerShape> & Pick<LayerShape, "id" | "parentId" | "index">): LayerShape {
  return {
    type: "geo",
    label: partial.id,
    opacity: 1,
    locked: false,
    hidden: false,
    ...partial
  };
}

describe("layer tree", () => {
  it("nests frame children and paints the top index first", () => {
    const forest = buildLayerForest(
      [
        shape({ id: "frame", parentId: page, index: "a1", type: "frame", label: "Frame" }),
        shape({ id: "back", parentId: "frame", index: "a1", label: "Back" }),
        shape({ id: "front", parentId: "frame", index: "a2", label: "Front" })
      ],
      page
    );
    expect(flattenLayerForest(forest).map((row) => row.label)).toEqual(["Frame", "Front", "Back"]);
    expect(flattenLayerForest(forest)[1]?.depth).toBe(1);
  });

  it("orders tldraw index keys by their stable character order", () => {
    const forest = buildLayerForest(
      [shape({ id: "lower", parentId: page, index: "a1" }), shape({ id: "upper", parentId: page, index: "A1" })],
      page
    );
    expect(flattenLayerForest(forest).map((row) => row.id)).toEqual(["lower", "upper"]);
  });

  it("windows a thousand rows instead of rendering all of them", () => {
    const window = layerWindow(1000, 3600, 400, 36, 0);
    expect(window.end - window.start).toBeLessThan(20);
    expect(window.start).toBe(100);
  });

  it("swaps indexes only for siblings", () => {
    const shapes = [
      shape({ id: "a", parentId: "frame", index: "a1" }),
      shape({ id: "b", parentId: "frame", index: "a2" }),
      shape({ id: "c", parentId: page, index: "a3" })
    ];
    expect(reorderSiblingIndexes(shapes, "a", "b")).toEqual([
      { id: "a", index: "a2" },
      { id: "b", index: "a1" }
    ]);
    expect(reorderSiblingIndexes(shapes, "a", "c")).toBeNull();
  });
});

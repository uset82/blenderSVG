import { describe, expect, it } from "vitest";
import { summarizeShapeSelection, type ShapeSelectionEntry } from "../src/components/inspectorSelection.js";

describe("canvas inspector selection summary", () => {
  it("returns no summary for an empty selection", () => {
    expect(summarizeShapeSelection([])).toBeNull();
  });

  it("exposes identity and geometry for one shape", () => {
    expect(summarizeShapeSelection([shape({})])).toEqual({
      id: "shape:one",
      type: "geo",
      count: 1,
      x: 12,
      y: 24,
      width: 80,
      height: 40
    });
  });

  it("shows mixed geometry and omits a single-shape ID for multiple selections", () => {
    expect(summarizeShapeSelection([shape({}), shape({ id: "shape:two", x: 18, props: { w: 96, h: 40 } })])).toEqual({
      type: "geo",
      count: 2,
      x: null,
      y: 24,
      width: null,
      height: 40
    });
  });

  it("reports differing types and missing dimensions as mixed", () => {
    expect(summarizeShapeSelection([shape({}), shape({ id: "shape:two", type: "text", props: {} })])).toEqual({
      type: "Mixed selection",
      count: 2,
      x: 12,
      y: 24,
      width: null,
      height: null
    });
  });
});

function shape(overrides: Partial<ShapeSelectionEntry>): ShapeSelectionEntry {
  return {
    id: "shape:one",
    type: "geo",
    x: 12,
    y: 24,
    props: { w: 80, h: 40 },
    ...overrides
  };
}

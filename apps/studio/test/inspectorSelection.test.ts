import { describe, expect, it } from "vitest";
import { type ShapeSelectionEntry, summarizeShapeSelection } from "../src/components/inspectorSelection.js";

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
      height: 40,
      rotation: 0,
      opacity: 1
    });
  });

  it("shows mixed geometry and omits a single-shape ID for multiple selections", () => {
    expect(summarizeShapeSelection([shape({}), shape({ id: "shape:two", x: 18, props: { w: 96, h: 40 } })])).toEqual({
      type: "geo",
      count: 2,
      x: null,
      y: 24,
      width: null,
      height: 40,
      rotation: 0,
      opacity: 1
    });
  });

  it("reports differing types and missing dimensions as mixed", () => {
    expect(summarizeShapeSelection([shape({}), shape({ id: "shape:two", type: "text", props: {} })])).toEqual({
      type: "Mixed selection",
      count: 2,
      x: 12,
      y: 24,
      width: null,
      height: null,
      rotation: 0,
      opacity: 1
    });
  });

  it("summarizes rectangle radii and exposes radius for rectangles", () => {
    expect(
      summarizeShapeSelection([
        shape({ props: { geo: "studio-rounded-rectangle", w: 80, h: 40 }, meta: { studioRadius: 12 } }),
        shape({ id: "shape:two", props: { geo: "rectangle", w: 80, h: 40 } })
      ])
    ).toMatchObject({ supportsRadius: true, radius: null });
  });

  it("exposes a common frame fill value", () => {
    expect(
      summarizeShapeSelection([
        shape({ type: "frame", props: { color: "blue" } }),
        shape({ id: "shape:two", type: "frame", props: { color: "blue" } })
      ])
    ).toMatchObject({ frameColor: "blue" });
  });

  it("reports mixed style values instead of selecting an arbitrary value", () => {
    expect(
      summarizeShapeSelection([
        shape({ props: { fill: "solid" } }),
        shape({ id: "shape:two", props: { fill: "pattern" } })
      ])
    ).toMatchObject({ fill: null });
  });

  it("summarizes text weights including formatted and mixed rich text", () => {
    const regular = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Regular" }] }] };
    const bold = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Bold", marks: [{ type: "bold" }] }] }]
    };
    const mixed = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Regular" },
            { type: "text", text: " bold", marks: [{ type: "bold" }] }
          ]
        }
      ]
    };

    expect(summarizeShapeSelection([shape({ type: "text", props: { richText: regular } })])).toMatchObject({
      weight: "regular"
    });
    expect(summarizeShapeSelection([shape({ type: "text", props: { richText: bold } })])).toMatchObject({
      weight: "bold"
    });
    expect(summarizeShapeSelection([shape({ type: "text", props: { richText: mixed } })])).toMatchObject({
      weight: null
    });
  });
});

function shape(overrides: Partial<ShapeSelectionEntry>): ShapeSelectionEntry {
  return {
    id: "shape:one",
    type: "geo",
    x: 12,
    y: 24,
    rotation: 0,
    opacity: 1,
    props: { w: 80, h: 40 },
    ...overrides
  };
}

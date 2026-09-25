import { describe, expect, it } from "vitest";
import {
  keepVariantFrame,
  placeVariantFrames,
  variantPrompt,
  type VariantFrameEditor
} from "../src/components/variantSessions.js";

describe("variant sessions", () => {
  it("places side-by-side frames and keeps one", () => {
    const shapes: Array<{ id: string; type: string; x: number; props: { name?: string; w?: number } }> = [];
    const editor: VariantFrameEditor = {
      markHistoryStoppingPoint: () => undefined,
      createShape: (shape) => {
        shapes.push({
          id: `shape:${shapes.length}`,
          type: shape.type,
          x: shape.x,
          props: shape.props as { name?: string; w?: number }
        });
      },
      getCurrentPageShapes: () => shapes,
      deleteShapes: (ids) => {
        for (const id of ids) {
          const index = shapes.findIndex((shape) => shape.id === id);
          if (index >= 0) shapes.splice(index, 1);
        }
      }
    };
    const sessions = placeVariantFrames(editor, 3);
    expect(sessions.map((session) => session.name)).toEqual(["Variant 1", "Variant 2", "Variant 3"]);
    expect(shapes.map((shape) => shape.x)).toEqual([0, 848, 1696]);
    expect(variantPrompt("Design a desk", 1, 3)).toContain("variant 2 of 3");
    keepVariantFrame(editor, sessions, 1);
    expect(shapes.map((shape) => shape.props.name)).toEqual(["Variant 2"]);
  });
});

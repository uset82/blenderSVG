import { describe, expect, it } from "vitest";
import { applyProposal, type ProposalEditor } from "../src/components/canvasProposal.js";

describe("canvas proposal", () => {
  it("applies every shape after one history mark", () => {
    const calls: string[] = [];
    const editor: ProposalEditor = {
      markHistoryStoppingPoint: (name) => calls.push(name),
      createShape: (shape) => calls.push(shape.id)
    };
    applyProposal(editor, {
      id: "proposal-1",
      summary: "Add a frame",
      shapes: [
        { id: "shape:a", type: "geo", x: 0, y: 0, w: 100, h: 40, label: "Title" },
        { id: "shape:b", type: "text", x: 0, y: 50, w: 80, h: 24, label: "Body" }
      ]
    });
    expect(calls).toEqual(["apply proposal-1", "shape:a", "shape:b"]);
  });
});

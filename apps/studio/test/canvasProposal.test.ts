import { describe, expect, it } from "vitest";
import { applyProposal, proposalFromTool, type ProposalEditor } from "../src/components/canvasProposal.js";

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

  it("turns an approved design-frame tool into one dashed preview", () => {
    const proposal = proposalFromTool(
      "create_design_frame",
      JSON.stringify({ name: "Landing", html: "<h1>Hello</h1><script>alert(1)</script>" }),
      { x: 400, y: 300 }
    );
    expect(proposal?.summary).toBe("Add design frame Landing");
    expect(proposal?.shapes).toHaveLength(1);
    expect(proposal?.shapes[0]).toMatchObject({ type: "design-frame", x: 0, y: 0, w: 800, h: 600, label: "Landing" });
    expect(proposal?.shapes[0]?.html ?? "").not.toContain("<script");
    expect(proposal?.shapes[0]?.html).toContain("<h1>Hello</h1>");
    expect(proposalFromTool("get_canvas_summary", "{}", { x: 0, y: 0 })).toBeNull();
  });
});

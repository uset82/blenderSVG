import { describe, expect, it } from "vitest";
import { CANVAS_TOOLS, canvasTool, openAiTools, toolsForComposerMode } from "../src/canvasTools.js";

const READ = ["get_canvas_summary", "get_selection", "get_frame_tree", "screenshot_frame", "get_styles"];
const WRITE = [
  "create_frame",
  "create_shapes",
  "update_shapes",
  "delete_shapes",
  "insert_svg",
  "set_text",
  "apply_style",
  "align",
  "create_design_frame"
];

describe("canvas tool registry", () => {
  it("lists the read and write tools with schemas", () => {
    expect(CANVAS_TOOLS.map((entry) => entry.name)).toEqual([...READ, ...WRITE]);
    for (const name of READ) {
      expect(canvasTool(name)?.readOnly).toBe(true);
      expect(canvasTool(name)?.destructive).toBe(false);
    }
    expect(canvasTool("delete_shapes")?.destructive).toBe(true);
    expect(canvasTool("create_frame")?.parameters.required).toEqual(["name", "width", "height"]);
    expect(canvasTool("missing")).toBeUndefined();
  });

  it("exposes function tools for a chat request", () => {
    const tools = openAiTools();
    expect(tools).toHaveLength(14);
    expect(tools[0]).toMatchObject({ type: "function", function: { name: "get_canvas_summary" } });
    expect(JSON.stringify(tools)).not.toContain("apiKey");
    expect(toolsForComposerMode("ask")).toEqual([]);
    expect(toolsForComposerMode("plan").map((entry) => entry.function.name)).toEqual([
      "get_canvas_summary",
      "get_selection",
      "get_frame_tree",
      "screenshot_frame",
      "get_styles"
    ]);
    expect(toolsForComposerMode("build").map((entry) => entry.function.name)).toContain("delete_shapes");
  });
});

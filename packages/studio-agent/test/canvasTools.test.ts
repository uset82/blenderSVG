import { describe, expect, it } from "vitest";
import { parseCanvasToolArguments } from "../src/agentGuards.js";
import {
  CANVAS_TOOLS,
  canvasTool,
  DESIGN_TOOLSET,
  DESIGN_WRITE_TOOLS,
  openAiTools,
  toolsForComposerMode
} from "../src/canvasTools.js";
import { MAX_DESIGN_HTML_CHARS, MAX_TOOL_ARGUMENT_CHARS } from "../src/limits.js";

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
  "create_design_frame",
  "get_design_frame",
  "update_design_frame",
  "patch_design_frame"
];

describe("canvas tool registry", () => {
  it("lists the read and write tools with schemas", () => {
    expect(CANVAS_TOOLS.map((entry) => entry.name)).toEqual([...READ, ...WRITE]);
    for (const name of [...READ, "get_design_frame"]) {
      expect(canvasTool(name)?.readOnly).toBe(true);
      expect(canvasTool(name)?.destructive).toBe(false);
    }
    expect(canvasTool("delete_shapes")?.destructive).toBe(true);
    expect(canvasTool("create_frame")?.parameters.required).toEqual(["name", "width", "height"]);
    expect(canvasTool("create_design_frame")?.parameters.required).toEqual(["name", "html"]);
    expect(canvasTool("missing")).toBeUndefined();
  });

  it("offers a small design toolset per composer mode", () => {
    expect(openAiTools()).toHaveLength(CANVAS_TOOLS.length);
    expect(JSON.stringify(openAiTools())).not.toContain("apiKey");
    expect(toolsForComposerMode("ask")).toEqual([]);
    expect(toolsForComposerMode("plan").map((entry) => entry.function.name)).toEqual([
      "get_canvas_summary",
      "get_design_frame"
    ]);
    const design = toolsForComposerMode("auto").map((entry) => entry.function.name);
    expect(new Set(design)).toEqual(new Set(DESIGN_TOOLSET));
    expect(toolsForComposerMode("build").map((entry) => entry.function.name)).toContain("delete_shapes");
    expect(design).not.toContain("create_shapes");
    for (const name of DESIGN_WRITE_TOOLS) expect(design).toContain(name);
  });

  it("accepts a real page of HTML and rejects oversized arguments", () => {
    const html = `<!doctype html><html><head><style>${"body{margin:0}".repeat(4000)}</style></head><body><h1>Hi</h1></body></html>`;
    expect(html.length).toBeGreaterThan(50_000);
    expect(
      parseCanvasToolArguments("create_design_frame", JSON.stringify({ name: "Landing", html, width: 1440 }))
    ).toEqual({
      success: true,
      data: { name: "Landing", html, width: 1440 }
    });
    const tooBig = JSON.stringify({ name: "Landing", html: "x".repeat(MAX_TOOL_ARGUMENT_CHARS) });
    expect(parseCanvasToolArguments("create_design_frame", tooBig).success).toBe(false);
    expect(MAX_DESIGN_HTML_CHARS).toBeLessThan(MAX_TOOL_ARGUMENT_CHARS);
  });

  it("validates placement, intoFrameId and patch edits", () => {
    const placed = parseCanvasToolArguments(
      "create_design_frame",
      JSON.stringify({
        name: "Mobile",
        html: "<p>x</p>",
        width: 390,
        placement: { relativeTo: "shape:a", side: "right" }
      })
    );
    expect(placed.success).toBe(true);
    const badSide = parseCanvasToolArguments(
      "create_design_frame",
      JSON.stringify({ name: "Mobile", html: "<p>x</p>", placement: { relativeTo: "shape:a", side: "left" } })
    );
    expect(badSide.success).toBe(false);
    const patch = parseCanvasToolArguments(
      "patch_design_frame",
      JSON.stringify({ frameId: "shape:a", edits: [{ find: "<h1>Old</h1>", replace: "" }] })
    );
    expect(patch.success).toBe(true);
    const emptyFind = parseCanvasToolArguments(
      "patch_design_frame",
      JSON.stringify({ frameId: "shape:a", edits: [{ find: "", replace: "x" }] })
    );
    expect(emptyFind.success).toBe(false);
    expect(
      parseCanvasToolArguments("update_design_frame", JSON.stringify({ frameId: "shape:a", width: 20 })).success
    ).toBe(false);
  });
});

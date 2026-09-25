import { describe, expect, it } from "vitest";
import { MCP_SERVER_INSTRUCTIONS } from "../src/instructions.js";
import { REMOVED_MCP_STUBS, STUDIO_MCP_TOOLS } from "../src/studioTools.js";

describe("mcp server instructions", () => {
  it("covers frames, styles, and the screenshot check", () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain("frames");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("get_styles");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("screenshot_frame");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("undo");
    const names = STUDIO_MCP_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_projects",
        "open_project",
        "get_canvas_state",
        "get_selection",
        "screenshot_frame",
        "get_styles",
        "create_design_frame",
        "create_shapes",
        "update_shapes",
        "delete_shapes",
        "insert_svg",
        "vectorize_image",
        "export_frame",
        "get_frame_code"
      ])
    );
    for (const stub of REMOVED_MCP_STUBS) expect(names).not.toContain(stub);
  });

  it("publishes required arguments for project reads and frame writes", () => {
    const canvas = STUDIO_MCP_TOOLS.find((tool) => tool.name === "get_canvas_state");
    const designFrame = STUDIO_MCP_TOOLS.find((tool) => tool.name === "create_design_frame");

    expect(canvas?.inputSchema.required).toContain("id");
    expect(designFrame?.inputSchema.required).toEqual(["id", "name", "html"]);
  });
});

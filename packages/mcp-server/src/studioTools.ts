export interface StudioMcpTool {
  name: string;
  description: string;
  readOnly: boolean;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

const text = { type: "string" } as const;
const input = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const,
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false as const
});
const projectId = input({ id: text }, ["id"]);

export const STUDIO_MCP_TOOLS: readonly StudioMcpTool[] = [
  {
    name: "list_projects",
    description: "List Studio projects on this computer.",
    readOnly: true,
    inputSchema: input({})
  },
  { name: "open_project", description: "Open one Studio project.", readOnly: true, inputSchema: projectId },
  {
    name: "get_canvas_state",
    description: "Read the current page and frames.",
    readOnly: true,
    inputSchema: projectId
  },
  { name: "get_selection", description: "Read the selected shapes.", readOnly: true, inputSchema: projectId },
  {
    name: "screenshot_frame",
    description: "Read a PNG of one frame.",
    readOnly: true,
    inputSchema: input({ frameId: text }, ["frameId"])
  },
  { name: "get_styles", description: "Read the project style tokens.", readOnly: true, inputSchema: projectId },
  {
    name: "create_design_frame",
    description: "Add a sandboxed design frame.",
    readOnly: false,
    inputSchema: input({ id: text, name: text, html: text }, ["id", "name", "html"])
  },
  {
    name: "create_shapes",
    description: "Add shapes inside a frame.",
    readOnly: false,
    inputSchema: input(
      {
        id: text,
        shapes: {
          type: "array",
          items: {
            type: "object",
            properties: { id: text, name: text, w: { type: "number" }, h: { type: "number" } },
            required: ["id", "name"],
            additionalProperties: false
          }
        }
      },
      ["id", "shapes"]
    )
  },
  {
    name: "update_shapes",
    description: "Update shapes on the current page.",
    readOnly: false,
    inputSchema: input(
      {
        id: text,
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: { id: text, name: text },
            required: ["id"],
            additionalProperties: false
          }
        }
      },
      ["id", "updates"]
    )
  },
  {
    name: "delete_shapes",
    description: "Delete shapes on the current page.",
    readOnly: false,
    inputSchema: input({ id: text, shapeIds: { type: "array", items: text } }, ["id", "shapeIds"])
  },
  {
    name: "insert_svg",
    description: "Insert sanitized SVG.",
    readOnly: false,
    inputSchema: input({ id: text, svg: text }, ["id", "svg"])
  },
  {
    name: "vectorize_image",
    description: "Trace a local image to SVG.",
    readOnly: false,
    inputSchema: input({ imagePath: text, engine: { type: "string", enum: ["vtracer", "imagetracer"] } }, ["imagePath"])
  },
  {
    name: "export_frame",
    description: "Export a frame as PNG, SVG, or HTML.",
    readOnly: true,
    inputSchema: input({ id: text, frameId: text, format: { type: "string", enum: ["png", "svg", "html"] } }, [
      "id",
      "frameId",
      "format"
    ])
  },
  {
    name: "get_frame_code",
    description: "Read the design-frame HTML.",
    readOnly: true,
    inputSchema: input({ id: text, frameId: text }, ["id", "frameId"])
  }
];

export const REMOVED_MCP_STUBS = ["avatar_set_state", "blender_export_lineart"] as const;

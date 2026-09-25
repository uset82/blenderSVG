const TOOLS = [
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
];

type InputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

const stringSchema = { type: "string" } as const;
const objectSchema = (properties: Record<string, unknown>, required: string[] = []): InputSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false
});
const projectIdSchema = objectSchema({ id: stringSchema }, ["id"]);

const INPUT_SCHEMAS: Record<string, InputSchema> = {
  list_projects: objectSchema({}),
  open_project: projectIdSchema,
  get_canvas_state: projectIdSchema,
  get_selection: projectIdSchema,
  screenshot_frame: objectSchema({ frameId: stringSchema }, ["frameId"]),
  get_styles: projectIdSchema,
  create_design_frame: objectSchema({ id: stringSchema, name: stringSchema, html: stringSchema }, [
    "id",
    "name",
    "html"
  ]),
  create_shapes: objectSchema(
    {
      id: stringSchema,
      shapes: {
        type: "array",
        items: {
          type: "object",
          properties: { id: stringSchema, name: stringSchema, w: { type: "number" }, h: { type: "number" } },
          required: ["id", "name"],
          additionalProperties: false
        }
      }
    },
    ["id", "shapes"]
  ),
  update_shapes: objectSchema(
    {
      id: stringSchema,
      updates: {
        type: "array",
        items: {
          type: "object",
          properties: { id: stringSchema, name: stringSchema },
          required: ["id"],
          additionalProperties: false
        }
      }
    },
    ["id", "updates"]
  ),
  delete_shapes: objectSchema({ id: stringSchema, shapeIds: { type: "array", items: stringSchema } }, [
    "id",
    "shapeIds"
  ]),
  insert_svg: objectSchema({ id: stringSchema, svg: stringSchema }, ["id", "svg"]),
  vectorize_image: objectSchema(
    { imagePath: stringSchema, engine: { type: "string", enum: ["vtracer", "imagetracer"] } },
    ["imagePath"]
  ),
  export_frame: objectSchema(
    { id: stringSchema, frameId: stringSchema, format: { type: "string", enum: ["png", "svg", "html"] } },
    ["id", "frameId", "format"]
  ),
  get_frame_code: objectSchema({ id: stringSchema, frameId: stringSchema }, ["id", "frameId"])
};

export function mcpJsonRpcResult(message: unknown): Record<string, unknown> | null {
  if (!message || typeof message !== "object") return null;
  const record = message as { jsonrpc?: unknown; id?: unknown; method?: unknown };
  if (record.jsonrpc !== "2.0" || typeof record.method !== "string") return null;
  if (record.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: record.id ?? null,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "blendersvg", version: "0.1.0" },
        instructions: "Read the current frame, use get_styles, then screenshot_frame after each edit."
      }
    };
  }
  if (record.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: record.id ?? null,
      result: {
        tools: TOOLS.map((name) => ({
          name,
          description: name,
          inputSchema: INPUT_SCHEMAS[name] ?? objectSchema({})
        }))
      }
    };
  }
  if (record.method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: record.id ?? null, result: {} };
  }
  return {
    jsonrpc: "2.0",
    id: record.id ?? null,
    error: { code: -32601, message: `Method not found: ${record.method}` }
  };
}

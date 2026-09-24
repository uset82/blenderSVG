export interface CanvasTool {
  name: string;
  description: string;
  readOnly: boolean;
  destructive: boolean;
  parameters: {
    type: "object";
    properties: Record<string, CanvasToolParameter>;
    required: string[];
    additionalProperties: false;
  };
}

export interface CanvasToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: CanvasToolParameter;
  properties?: Record<string, CanvasToolParameter>;
  required?: string[];
  additionalProperties?: boolean;
}

function tool(
  name: string,
  description: string,
  readOnly: boolean,
  destructive: boolean,
  properties: Record<string, CanvasToolParameter>,
  required: string[]
): CanvasTool {
  return {
    name,
    description,
    readOnly,
    destructive,
    parameters: { type: "object", properties, required, additionalProperties: false }
  };
}

const stringProp = (description: string, maxLength = 500) => ({ type: "string", description, minLength: 1, maxLength });
const numberProp = (description: string, minimum: number, maximum: number) => ({
  type: "number",
  description,
  minimum,
  maximum
});
const colorProp: CanvasToolParameter = {
  type: "string",
  enum: [
    "black",
    "grey",
    "white",
    "blue",
    "light-blue",
    "yellow",
    "orange",
    "green",
    "light-green",
    "red",
    "light-red",
    "violet",
    "light-violet",
    "accent"
  ],
  description: "tldraw color name."
};
const fillProp: CanvasToolParameter = {
  type: "string",
  enum: ["none", "semi", "solid", "pattern"],
  description: "Shape fill style."
};
const shapeProperties: Record<string, CanvasToolParameter> = {
  type: { type: "string", enum: ["rectangle", "ellipse", "text", "note"], description: "Shape kind." },
  x: numberProp("Horizontal position in pixels.", -100_000, 100_000),
  y: numberProp("Vertical position in pixels.", -100_000, 100_000),
  width: numberProp("Width in pixels.", 8, 8_000),
  height: numberProp("Height in pixels.", 8, 8_000),
  text: stringProp("Visible text for a text or note shape.", 4_000),
  color: colorProp,
  fill: fillProp
};
const updateProperties: Record<string, CanvasToolParameter> = {
  id: stringProp("Existing shape id.", 100),
  x: numberProp("Horizontal position in pixels.", -100_000, 100_000),
  y: numberProp("Vertical position in pixels.", -100_000, 100_000),
  w: numberProp("Width in pixels.", 8, 8_000),
  h: numberProp("Height in pixels.", 8, 8_000),
  text: stringProp("Replacement visible text.", 4_000),
  color: colorProp,
  fill: fillProp
};

export const CANVAS_TOOLS: readonly CanvasTool[] = [
  tool("get_canvas_summary", "Read a short summary of the current page.", true, false, {}, []),
  tool("get_selection", "Read the shapes that are selected.", true, false, {}, []),
  tool("get_frame_tree", "Read the frames on the current page.", true, false, {}, []),
  tool(
    "screenshot_frame",
    "Read a PNG of one frame. The screenshot is returned to the selected model after approval.",
    true,
    false,
    { frameId: stringProp("Frame id to capture.", 100) },
    ["frameId"]
  ),
  tool("get_styles", "Read the project style tokens.", true, false, {}, []),
  tool(
    "create_frame",
    "Add a frame.",
    false,
    false,
    {
      name: stringProp("Frame name.", 120),
      width: numberProp("Width in pixels.", 64, 8_000),
      height: numberProp("Height in pixels.", 64, 8_000)
    },
    ["name", "width", "height"]
  ),
  tool(
    "create_shapes",
    "Add bounded rectangles, ellipses, text, or notes inside a frame.",
    false,
    false,
    {
      frameId: stringProp("Parent frame id.", 100),
      shapes: {
        type: "array",
        description: "Shape records to create.",
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object",
          properties: shapeProperties,
          required: ["type", "x", "y", "width", "height"],
          additionalProperties: false
        }
      }
    },
    ["frameId", "shapes"]
  ),
  tool(
    "update_shapes",
    "Change a small set of existing shapes.",
    false,
    false,
    {
      updates: {
        type: "array",
        description: "Shape id and bounded props to change.",
        minItems: 1,
        maxItems: 30,
        items: { type: "object", properties: updateProperties, required: ["id"], additionalProperties: false }
      }
    },
    ["updates"]
  ),
  tool(
    "delete_shapes",
    "Delete shapes after user approval.",
    false,
    true,
    {
      shapeIds: {
        type: "array",
        description: "Shape ids to delete.",
        minItems: 1,
        maxItems: 30,
        items: stringProp("Existing shape id.", 100)
      }
    },
    ["shapeIds"]
  ),
  tool(
    "insert_svg",
    "Sanitize and insert SVG as a vector shape.",
    false,
    false,
    { svg: stringProp("SVG markup. Scripts, external references, and unsafe content are removed.", 50_000) },
    ["svg"]
  ),
  tool(
    "set_text",
    "Set the text of one shape.",
    false,
    false,
    { shapeId: stringProp("Shape id.", 100), text: stringProp("Replacement text.", 4_000) },
    ["shapeId", "text"]
  ),
  tool("apply_style", "Apply the named project style.", false, false, { name: stringProp("Style name.") }, ["name"]),
  tool(
    "align",
    "Align the selected shapes.",
    false,
    false,
    {
      edge: {
        type: "string",
        enum: ["left", "center", "right", "top", "middle", "bottom"],
        description: "Alignment edge."
      }
    },
    ["edge"]
  ),
  tool(
    "create_design_frame",
    "Add a design frame. HTML is sandboxed by Studio before display.",
    false,
    false,
    { name: stringProp("Frame name.", 120), html: stringProp("HTML content.", 50_000) },
    ["name", "html"]
  )
];

const byName = new Map(CANVAS_TOOLS.map((entry) => [entry.name, entry]));

export function canvasTool(name: string): CanvasTool | undefined {
  return byName.get(name);
}

export function toolsForComposerMode(mode: "ask" | "plan" | "build" | "auto") {
  if (mode === "ask") return [];
  const tools = openAiTools();
  if (mode === "plan") return tools.filter((entry) => canvasTool(entry.function.name)?.readOnly);
  return tools;
}

export function openAiTools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: CanvasTool["parameters"] };
}> {
  return CANVAS_TOOLS.map((entry) => ({
    type: "function",
    function: { name: entry.name, description: entry.description, parameters: entry.parameters }
  }));
}

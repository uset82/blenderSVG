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

import { DEFAULT_DESIGN_WIDTH, MAX_DESIGN_HTML_CHARS } from "./limits.js";

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
  tool(
    "get_canvas_summary",
    "Read the current page: every design frame (id, name, position, size, HTML length), empty frames you can fill with intoFrameId, and a count of other shapes. Call this first when the user refers to something already on the canvas.",
    true,
    false,
    {},
    []
  ),
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
    "Place an SVG illustration, icon, logo or drawing on the canvas as a vector shape. Use this when the user asks to draw or illustrate something. Write a complete, detailed <svg> with a viewBox, clean shapes and a considered palette. Scripts and external references are removed.",
    false,
    false,
    {
      svg: stringProp(
        "Complete SVG markup with a viewBox. Scripts, external references and unsafe content are removed.",
        120_000
      ),
      width: numberProp(
        "Display width in pixels. Height follows the viewBox aspect ratio. Defaults to 480.",
        16,
        4_000
      ),
      placement: {
        type: "object",
        description: "Place next to an existing frame instead of the viewport centre.",
        properties: {
          relativeTo: stringProp("Id of the frame or design frame to place next to.", 100),
          side: { type: "string", enum: ["right", "below"], description: "Which side of that frame." }
        },
        required: ["relativeTo"],
        additionalProperties: false
      }
    },
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
    `Create a real, finished design as a new frame on the canvas: a complete, self-contained HTML document with one <style> block (layout, typography, colours, spacing) and realistic content. It renders live on the canvas like a web page. Use width ${DEFAULT_DESIGN_WIDTH} for desktop, 768 for tablet, 390 for mobile. Height is measured from the content unless given. To fill an empty frame the user already has, pass intoFrameId. To put it next to another design (for example a mobile version), pass placement. No scripts, external fonts or remote images: use system font stacks, CSS, gradients, inline SVG and data: images.`,
    false,
    false,
    {
      name: stringProp("Frame name, for example “Clay & Kiln — Desktop”.", 120),
      html: stringProp("Complete HTML document with a <style> block.", MAX_DESIGN_HTML_CHARS),
      width: numberProp(`Frame width in pixels. Defaults to ${DEFAULT_DESIGN_WIDTH}.`, 240, 2_560),
      height: numberProp("Frame height in pixels. Omit to fit the content.", 200, 20_000),
      intoFrameId: stringProp("Id of an empty frame to replace with this design, keeping its position.", 100),
      placement: {
        type: "object",
        description: "Place next to an existing frame instead of the default position.",
        properties: {
          relativeTo: stringProp("Id of the frame or design frame to place next to.", 100),
          side: { type: "string", enum: ["right", "below"], description: "Which side of that frame." }
        },
        required: ["relativeTo"],
        additionalProperties: false
      }
    },
    ["name", "html"]
  ),
  tool(
    "get_design_frame",
    "Read one design frame's current HTML, name and size. Always call this before patch_design_frame so your find strings match the stored document exactly.",
    true,
    false,
    { frameId: stringProp("Design frame id.", 100) },
    ["frameId"]
  ),
  tool(
    "update_design_frame",
    "Replace a design frame's whole HTML, or rename or resize it. Prefer patch_design_frame for small changes to a large page.",
    false,
    false,
    {
      frameId: stringProp("Design frame id.", 100),
      html: stringProp("Complete replacement HTML document.", MAX_DESIGN_HTML_CHARS),
      name: stringProp("New frame name.", 120),
      width: numberProp("New width in pixels.", 240, 2_560),
      height: numberProp("New height in pixels. Omit to refit the content.", 200, 20_000)
    },
    ["frameId"]
  ),
  tool(
    "patch_design_frame",
    "Change part of a design frame's HTML with exact find/replace edits, applied in order. Each find must match exactly once in the current HTML (copy it from get_design_frame). If any edit fails, none are applied.",
    false,
    false,
    {
      frameId: stringProp("Design frame id.", 100),
      edits: {
        type: "array",
        description: "Exact find/replace pairs.",
        minItems: 1,
        maxItems: 20,
        items: {
          type: "object",
          properties: {
            find: stringProp("Exact text to find; must occur exactly once.", 8_000),
            replace: { type: "string", description: "Replacement text (may be empty).", maxLength: 60_000 }
          },
          required: ["find", "replace"],
          additionalProperties: false
        }
      }
    },
    ["frameId", "edits"]
  )
];

/** Tools offered in design turns. A small set keeps models reliable; the shape tools stay for MCP. */
export const DESIGN_TOOLSET: readonly string[] = [
  "get_canvas_summary",
  "get_design_frame",
  "create_design_frame",
  "update_design_frame",
  "patch_design_frame",
  "insert_svg",
  "delete_shapes"
];

/** Tools that write design frame HTML and may take longer to apply. */
export const DESIGN_WRITE_TOOLS: readonly string[] = [
  "create_design_frame",
  "update_design_frame",
  "patch_design_frame"
];

const byName = new Map(CANVAS_TOOLS.map((entry) => [entry.name, entry]));

export function canvasTool(name: string): CanvasTool | undefined {
  return byName.get(name);
}

export function toolsForComposerMode(mode: "ask" | "plan" | "build" | "auto") {
  if (mode === "ask") return [];
  const tools = openAiTools().filter((entry) => DESIGN_TOOLSET.includes(entry.function.name));
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

import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { parseCanvasToolArguments } from "@codex-avatar-studio/studio-agent/agentGuards";
import type { Editor } from "tldraw";
import { placeFileOnCanvas, svgTextToFile } from "../projects/localAssets.js";
import { sanitizeDesignHtml } from "../shapes/designFrameHtml.js";
import { STYLE_PRESETS, withProjectStyle } from "./projectStyle.js";
import { assertSvgPathCount } from "./vtracerPresets.js";

const MAX_RESULT_CHARS = 16_000;
const MAX_SCREENSHOT_BYTES = 1_500_000;
const SAFE_COLORS = new Set([
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
]);
const SAFE_FILLS = new Set(["none", "semi", "solid", "pattern"]);

export interface CanvasToolExecutionResult {
  content: string;
  imageDataUrl?: string;
}

/** Executes only a validated, explicitly approved canvas tool request. */
export async function executeCanvasTool(
  editor: Editor,
  name: string,
  argumentsJson: string
): Promise<CanvasToolExecutionResult> {
  const parsed = parseCanvasToolArguments(name, argumentsJson);
  if (!parsed.success) throw new Error(parsed.error);
  const args = parsed.data;
  const shapes = editor.getCurrentPageShapes();

  if (name === "get_canvas_summary") {
    const frames = shapes.filter((shape) => shape.type === "frame");
    return result({
      page: editor.getCurrentPageId(),
      shapeCount: shapes.length,
      frames: frames.slice(0, 30).map((shape) => ({
        id: shape.id,
        name: readString(shape.props.name),
        width: readNumber(shape.props.w),
        height: readNumber(shape.props.h)
      }))
    });
  }

  if (name === "get_selection") {
    const selected = editor.getSelectedShapes();
    return result(
      selected.slice(0, 30).map((shape) => {
        const props = shape.props as Record<string, unknown>;
        return {
          id: shape.id,
          type: shape.type,
          x: round(shape.x),
          y: round(shape.y),
          width: readNumber(props.w),
          height: readNumber(props.h),
          text: extractRichText(props.richText).slice(0, 1_000)
        };
      })
    );
  }

  if (name === "get_frame_tree") {
    return result(
      shapes
        .filter((shape) => shape.type === "frame")
        .slice(0, 30)
        .map((frame) => ({
          id: frame.id,
          name: readString(frame.props.name),
          x: round(frame.x),
          y: round(frame.y),
          width: readNumber(frame.props.w),
          height: readNumber(frame.props.h),
          children: shapes
            .filter((shape) => shape.parentId === frame.id)
            .slice(0, 40)
            .map((shape) => ({
              id: shape.id,
              type: shape.type,
              text: extractRichText((shape.props as Record<string, unknown>).richText).slice(0, 240)
            }))
        }))
    );
  }

  if (name === "get_styles") {
    return result({
      style: editor.getDocumentSettings()?.meta ?? {},
      available: STYLE_PRESETS.map((preset) => preset.name)
    });
  }

  if (name === "screenshot_frame") {
    const frame = editor.getShape(args.frameId as Parameters<Editor["getShape"]>[0]);
    if (frame?.type !== "frame") throw new Error("Choose a frame on the current page.");
    const image = await editor.toImage([frame.id], { format: "png", pixelRatio: 1, background: true, padding: 0 });
    if (image.blob.size > MAX_SCREENSHOT_BYTES)
      throw new Error("This frame image is over 1.5 MB. Zoom out or simplify the frame and try again.");
    return {
      content: `PNG screenshot of frame ${readString(frame.props.name) || frame.id}; sent to the selected model after approval.`,
      imageDataUrl: await blobToPngDataUrl(image.blob)
    };
  }

  if (name === "create_frame") {
    const center = editor.getViewportPageBounds().center;
    editor.markHistoryStoppingPoint("Agent: create frame");
    editor.createShape({
      type: "frame",
      x: center.x - number(args.width) / 2,
      y: center.y - number(args.height) / 2,
      props: { w: number(args.width), h: number(args.height), name: string(args.name) }
    });
    const created = editor
      .getCurrentPageShapes()
      .find((shape) => shape.type === "frame" && shape.props.name === args.name);
    return result({ created: "frame", id: created?.id ?? "unknown", name: args.name });
  }

  if (name === "create_shapes") {
    const frame = editor.getShape(args.frameId as Parameters<Editor["getShape"]>[0]);
    if (frame?.type !== "frame" || frame.parentId !== editor.getCurrentPageId())
      throw new Error("Choose a frame on the current page.");
    const requested = args.shapes as Array<Record<string, unknown>>;
    editor.markHistoryStoppingPoint("Agent: create shapes");
    for (const item of requested) {
      const x = number(item.x);
      const y = number(item.y);
      const w = number(item.width);
      const h = number(item.height);
      const color = safeColor(item.color);
      const fill = safeFill(item.fill);
      if (item.type === "rectangle" || item.type === "ellipse") {
        editor.createShape({
          type: "geo",
          parentId: frame.id,
          x,
          y,
          props: { geo: item.type === "ellipse" ? "ellipse" : "rectangle", w, h, color, fill }
        } as Parameters<Editor["createShape"]>[0]);
      } else {
        editor.createShape({
          type: item.type === "note" ? "note" : "text",
          parentId: frame.id,
          x,
          y,
          props: { w, h, richText: plainRichText(string(item.text ?? "")), color }
        } as Parameters<Editor["createShape"]>[0]);
      }
    }
    return result({ created: requested.length, inFrame: frame.id });
  }

  if (name === "update_shapes") {
    const updates = args.updates as Array<Record<string, unknown>>;
    const currentIds = new Set(shapes.map((shape) => String(shape.id)));
    for (const update of updates)
      if (!currentIds.has(string(update.id)))
        throw new Error("One or more selected shape ids are no longer on this page.");
    editor.markHistoryStoppingPoint("Agent: update shapes");
    for (const update of updates) {
      const shape = editor.getShape(string(update.id) as Parameters<Editor["getShape"]>[0]);
      if (!shape) continue;
      const props: Record<string, unknown> = {};
      if (typeof update.w === "number") props.w = update.w;
      if (typeof update.h === "number") props.h = update.h;
      if (typeof update.text === "string") {
        if (shape.type !== "text" && shape.type !== "note")
          throw new Error("Text can only be changed on text or note shapes.");
        props.richText = plainRichText(update.text);
      }
      if (typeof update.color === "string") props.color = safeColor(update.color);
      if (typeof update.fill === "string") props.fill = safeFill(update.fill);
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        ...(typeof update.x === "number" ? { x: update.x } : {}),
        ...(typeof update.y === "number" ? { y: update.y } : {}),
        props
      } as Parameters<Editor["updateShape"]>[0]);
    }
    return result({ updated: updates.length });
  }

  if (name === "delete_shapes") {
    const ids = args.shapeIds as string[];
    const currentIds = new Map(shapes.map((shape) => [String(shape.id), shape.id]));
    if (ids.some((id) => !currentIds.has(id))) throw new Error("One or more shape ids are no longer on this page.");
    editor.markHistoryStoppingPoint("Agent: delete shapes");
    const shapeIds = ids.flatMap((id) => {
      const shapeId = currentIds.get(id);
      return shapeId ? [shapeId] : [];
    });
    editor.deleteShapes(shapeIds);
    return result({ deleted: ids.length });
  }

  if (name === "insert_svg") {
    const sanitized = prepareSvgPreview(string(args.svg)).svg;
    assertSvgPathCount(sanitized);
    editor.markHistoryStoppingPoint("Agent: insert SVG");
    await placeFileOnCanvas(editor, svgTextToFile(sanitized, "agent-vector.svg"));
    return result({ inserted: "sanitized SVG", bytes: new TextEncoder().encode(sanitized).byteLength });
  }

  if (name === "set_text") {
    const shape = editor.getShape(args.shapeId as Parameters<Editor["getShape"]>[0]);
    if (!shape || (shape.type !== "text" && shape.type !== "note"))
      throw new Error("Choose a text or note shape on the current page.");
    editor.markHistoryStoppingPoint("Agent: set text");
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: { richText: plainRichText(string(args.text)) }
    } as Parameters<Editor["updateShape"]>[0]);
    return result({ updated: shape.id, text: string(args.text).slice(0, 500) });
  }

  if (name === "apply_style") {
    const preset = STYLE_PRESETS.find((entry) => entry.name.toLowerCase() === string(args.name).toLowerCase());
    if (!preset)
      throw new Error(`Choose one of these local styles: ${STYLE_PRESETS.map((item) => item.name).join(", ")}.`);
    const current = editor.getDocumentSettings();
    const meta = withProjectStyle(current.meta, preset);
    if (!meta) throw new Error("This style could not be applied to the document.");
    editor.markHistoryStoppingPoint("Agent: apply style");
    editor.updateDocumentSettings({ meta: meta as typeof current.meta });
    return result({ applied: preset.name });
  }

  if (name === "align") {
    const ids = [...editor.getSelectedShapeIds()];
    if (ids.length < 2) throw new Error("Select at least two shapes before approving alignment.");
    const alignment = {
      left: "left",
      center: "center-horizontal",
      right: "right",
      top: "top",
      middle: "center-vertical",
      bottom: "bottom"
    } as const;
    editor.markHistoryStoppingPoint("Agent: align shapes");
    editor.alignShapes(ids, alignment[string(args.edge) as keyof typeof alignment]);
    return result({ aligned: ids.length, edge: args.edge });
  }

  if (name === "create_design_frame") {
    const center = editor.getViewportPageBounds().center;
    const safeHtml = sanitizeDesignHtml(string(args.html));
    editor.markHistoryStoppingPoint("Agent: create design frame");
    editor.createShape({
      type: "design-frame",
      x: center.x - 400,
      y: center.y - 300,
      props: { w: 800, h: 600, name: string(args.name), html: safeHtml }
    } as Parameters<Editor["createShape"]>[0]);
    return result({ created: "design frame", name: string(args.name), htmlLength: safeHtml.length });
  }

  throw new Error("This canvas tool is not supported by this Studio build.");
}

function result(value: unknown): CanvasToolExecutionResult {
  return { content: truncate(JSON.stringify(value)) };
}

function truncate(value: string): string {
  return value.length <= MAX_RESULT_CHARS ? value : `${value.slice(0, MAX_RESULT_CHARS - 24)}… [result truncated]`;
}

function plainRichText(text: string): {
  type: "doc";
  content: Array<{ type: "paragraph"; content: Array<{ type: "text"; text: string }> }>;
} {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function extractRichText(value: unknown): string {
  if (Array.isArray(value)) return value.map(extractRichText).join("");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  return Array.isArray(record.content) ? record.content.map(extractRichText).join("") : "";
}

function safeColor(value: unknown): string {
  if (value === "accent") return "blue";
  return typeof value === "string" && SAFE_COLORS.has(value) ? value : "blue";
}

function safeFill(value: unknown): string {
  return typeof value === "string" && SAFE_FILLS.has(value) ? value : "solid";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? round(value) : undefined;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function blobToPngDataUrl(blob: Blob): Promise<string> {
  if (blob.size <= 0 || blob.size > MAX_SCREENSHOT_BYTES || (blob.type && blob.type !== "image/png")) {
    throw new Error("Studio could not create a bounded PNG for this frame.");
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

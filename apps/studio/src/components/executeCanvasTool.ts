import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { parseCanvasToolArguments } from "@codex-avatar-studio/studio-agent/agentGuards";
import { applyHtmlEdits, type FrameBox, placeDesignFrame } from "@codex-avatar-studio/studio-agent/designFrames";
import {
  DEFAULT_DESIGN_WIDTH,
  MAX_DESIGN_HTML_CHARS,
  MAX_DESIGN_RESULT_CHARS,
  MAX_TOOL_RESULT_CHARS
} from "@codex-avatar-studio/studio-agent/limits";
import type { Editor, TLShape, TLShapeId } from "tldraw";
import { fittedMediaSize, svgViewBoxSize } from "../projects/fittedMediaSize.js";
import { measureDesignHtml } from "../shapes/designFrameRenderer.js";
import { sanitizeDesignDocument } from "../shapes/designHtml.js";
import { STYLE_PRESETS, withProjectStyle } from "./projectStyle.js";
import { assertSvgPathCount } from "./vtracerPresets.js";

const MAX_RESULT_CHARS = MAX_TOOL_RESULT_CHARS;
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

export interface CanvasToolExecutionOptions {
  /**
   * The call belongs to an agent turn whose history is recorded as one undo step by the caller, so
   * the tool adds no history marks of its own.
   */
  turn?: boolean;
}

/** Executes only a validated canvas tool request. */
export async function executeCanvasTool(
  editor: Editor,
  name: string,
  argumentsJson: string,
  options: CanvasToolExecutionOptions = {}
): Promise<CanvasToolExecutionResult> {
  const parsed = parseCanvasToolArguments(name, argumentsJson);
  if (!parsed.success) throw new Error(parsed.error);
  const args = parsed.data;
  const shapes = editor.getCurrentPageShapes();
  const mark = (label: string) => {
    if (!options.turn) editor.markHistoryStoppingPoint(label);
  };

  if (name === "get_canvas_summary") {
    const frames = shapes.filter(
      (shape): shape is Extract<TLShape, { type: "frame" }> =>
        shape.type === "frame" && shape.parentId === editor.getCurrentPageId()
    );
    const designFrames = shapes.filter((shape): shape is DesignFrame => shape.type === "design-frame");
    const childCount = (id: TLShapeId) => shapes.filter((shape) => shape.parentId === id).length;
    return result({
      page: editor.getCurrentPage().name,
      shapeCount: shapes.length,
      designFrames: designFrames.slice(0, 40).map((shape) => ({
        id: shape.id,
        name: readString(shape.props.name),
        x: round(shape.x),
        y: round(shape.y),
        width: readNumber(shape.props.w),
        height: readNumber(shape.props.h),
        htmlChars: shape.props.html.length
      })),
      emptyFrames: frames
        .filter((frame) => childCount(frame.id) === 0)
        .slice(0, 20)
        .map((frame) => ({
          id: frame.id,
          name: readString(frame.props.name),
          x: round(frame.x),
          y: round(frame.y),
          width: readNumber(frame.props.w),
          height: readNumber(frame.props.h)
        })),
      frames: frames
        .filter((frame) => childCount(frame.id) > 0)
        .slice(0, 20)
        .map((frame) => ({
          id: frame.id,
          name: readString(frame.props.name),
          width: readNumber(frame.props.w),
          height: readNumber(frame.props.h),
          children: childCount(frame.id)
        })),
      otherShapes: shapes.filter((shape) => shape.type !== "frame" && shape.type !== "design-frame").length
    });
  }

  if (name === "get_design_frame") {
    const frame = designFrame(editor, args.frameId);
    return result(
      {
        id: frame.id,
        name: frame.props.name,
        x: round(frame.x),
        y: round(frame.y),
        width: round(frame.props.w),
        height: round(frame.props.h),
        html: frame.props.html
      },
      MAX_DESIGN_RESULT_CHARS
    );
  }

  if (name === "create_design_frame") {
    const cleaned = sanitizeDesignDocument(string(args.html));
    if (cleaned.html.length > MAX_DESIGN_HTML_CHARS)
      throw new Error("The design HTML is too large. Split the page or simplify it.");
    let width = typeof args.width === "number" ? args.width : DEFAULT_DESIGN_WIDTH;
    let target: TLShape | undefined;
    if (typeof args.intoFrameId === "string") {
      target = editor.getShape(args.intoFrameId as TLShapeId);
      if (target?.type !== "frame")
        throw new Error("intoFrameId must be an empty frame on the current page. Call get_canvas_summary to find one.");
      const frameId = target.id;
      if (shapes.some((shape) => shape.parentId === frameId))
        throw new Error("That frame is not empty. Omit intoFrameId to place the design next to it.");
      if (typeof args.width !== "number") width = readNumber((target.props as { w?: unknown }).w) ?? width;
    }
    const height = typeof args.height === "number" ? args.height : measureDesignHtml(cleaned.html, width);
    let x: number;
    let y: number;
    if (target) {
      const bounds = editor.getShapePageBounds(target);
      x = bounds?.x ?? target.x;
      y = bounds?.y ?? target.y;
    } else {
      const placement = args.placement as { relativeTo?: string; side?: "right" | "below" } | undefined;
      const anchor = placement?.relativeTo ? frameBox(editor, placement.relativeTo) : undefined;
      if (placement?.relativeTo && !anchor)
        throw new Error("placement.relativeTo must be a frame or design frame on the current page.");
      ({ x, y } = placeDesignFrame({
        width,
        height,
        existing: pageFrameBoxes(editor),
        relativeTo: anchor,
        side: placement?.side,
        viewportCenter: editor.getViewportPageBounds().center
      }));
    }
    const replacedFrameId = target?.id ?? null;
    const id = newShapeId();
    mark("Agent: create design frame");
    if (replacedFrameId) editor.deleteShapes([replacedFrameId]);
    editor.createShape({
      id,
      type: "design-frame",
      // An explicit page parent: tldraw would otherwise nest a shape created over a frame inside it.
      parentId: editor.getCurrentPageId(),
      x,
      y,
      props: { w: width, h: height, name: string(args.name), html: cleaned.html },
      meta: { kurva: { agent: true, autoHeight: typeof args.height !== "number" } }
    } as Parameters<Editor["createShape"]>[0]);
    revealShape(editor, id);
    return result({
      created: "design frame",
      id,
      name: string(args.name),
      x: round(x),
      y: round(y),
      width,
      height,
      htmlChars: cleaned.html.length,
      ...(replacedFrameId ? { replacedEmptyFrame: replacedFrameId } : {}),
      ...(cleaned.removed.length ? { removed: cleaned.removed, note: removedNote } : {})
    });
  }

  if (name === "update_design_frame") {
    const frame = designFrame(editor, args.frameId);
    if (args.html === undefined && args.name === undefined && args.width === undefined && args.height === undefined)
      throw new Error("Give at least one of html, name, width or height.");
    const cleaned = typeof args.html === "string" ? sanitizeDesignDocument(args.html) : null;
    const html = cleaned?.html ?? frame.props.html;
    if (html.length > MAX_DESIGN_HTML_CHARS)
      throw new Error("The design HTML is too large. Split the page or simplify it.");
    const width = typeof args.width === "number" ? args.width : frame.props.w;
    const autoHeight = typeof args.height === "number" ? false : isAutoHeight(frame);
    const height =
      typeof args.height === "number"
        ? args.height
        : autoHeight && (cleaned || typeof args.width === "number")
          ? measureDesignHtml(html, width)
          : frame.props.h;
    mark("Agent: update design frame");
    editor.updateShape({
      id: frame.id,
      type: "design-frame",
      props: { html, w: width, h: height, name: typeof args.name === "string" ? args.name : frame.props.name },
      meta: { ...frame.meta, kurva: { ...kurvaMeta(frame), agent: true, autoHeight } }
    } as Parameters<Editor["updateShape"]>[0]);
    return result({
      updated: frame.id,
      width,
      height,
      htmlChars: html.length,
      ...(cleaned?.removed.length ? { removed: cleaned.removed, note: removedNote } : {})
    });
  }

  if (name === "patch_design_frame") {
    const frame = designFrame(editor, args.frameId);
    const edits = args.edits as Array<{ find: string; replace: string }>;
    const patched = applyHtmlEdits(frame.props.html, edits);
    if (!patched.ok) throw new Error(patched.error);
    const cleaned = sanitizeDesignDocument(patched.html);
    if (cleaned.html.length > MAX_DESIGN_HTML_CHARS) throw new Error("The design HTML is too large after these edits.");
    const height = isAutoHeight(frame) ? measureDesignHtml(cleaned.html, frame.props.w) : frame.props.h;
    mark("Agent: edit design frame");
    editor.updateShape({
      id: frame.id,
      type: "design-frame",
      props: { html: cleaned.html, h: height },
      meta: { ...frame.meta, kurva: { ...kurvaMeta(frame), agent: true } }
    } as Parameters<Editor["updateShape"]>[0]);
    return result({
      patched: frame.id,
      edits: patched.applied,
      height,
      htmlChars: cleaned.html.length,
      ...(cleaned.removed.length ? { removed: cleaned.removed, note: removedNote } : {})
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
    const id = newShapeId();
    mark("Agent: create frame");
    editor.createShape({
      id,
      type: "frame",
      x: center.x - number(args.width) / 2,
      y: center.y - number(args.height) / 2,
      props: { w: number(args.width), h: number(args.height), name: string(args.name) }
    });
    return result({ created: "frame", id, name: args.name });
  }

  if (name === "create_shapes") {
    const frame = editor.getShape(args.frameId as Parameters<Editor["getShape"]>[0]);
    if (frame?.type !== "frame" || frame.parentId !== editor.getCurrentPageId())
      throw new Error("Choose a frame on the current page.");
    const requested = args.shapes as Array<Record<string, unknown>>;
    mark("Agent: create shapes");
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
      } else if (item.type === "note") {
        editor.createShape({
          type: "note",
          parentId: frame.id,
          x,
          y,
          props: { richText: plainRichText(string(item.text ?? "")), color }
        } as Parameters<Editor["createShape"]>[0]);
      } else {
        editor.createShape({
          type: "text",
          parentId: frame.id,
          x,
          y,
          props: { w, autoSize: false, richText: plainRichText(string(item.text ?? "")), color }
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
    mark("Agent: update shapes");
    for (const update of updates) {
      const shape = editor.getShape(string(update.id) as Parameters<Editor["getShape"]>[0]);
      if (!shape) continue;
      const props: Record<string, unknown> = {};
      const sized = SIZED_SHAPES[shape.type];
      if (typeof update.w === "number" && sized?.w) props.w = update.w;
      if (typeof update.h === "number" && sized?.h) props.h = update.h;
      if (typeof update.w === "number" && shape.type === "text") props.autoSize = false;
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
    mark("Agent: delete shapes");
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
    const viewBox = svgViewBoxSize(sanitized) ?? { width: 400, height: 400 };
    const size =
      typeof args.width === "number"
        ? { w: args.width, h: Math.max(16, Math.round((args.width * viewBox.height) / viewBox.width)) }
        : fittedMediaSize({ width: viewBox.width, height: viewBox.height, maxSide: 480 });
    const placement = args.placement as { relativeTo?: string; side?: "right" | "below" } | undefined;
    const anchor = placement?.relativeTo ? frameBox(editor, placement.relativeTo) : undefined;
    const { x, y } = placeDesignFrame({
      width: size.w,
      height: size.h,
      existing: pageFrameBoxes(editor).concat(vectorBoxes(editor)),
      relativeTo: anchor,
      side: placement?.side,
      viewportCenter: editor.getViewportPageBounds().center
    });
    const id = newShapeId();
    mark("Agent: insert SVG");
    editor.createShape({
      id,
      type: "vector-studio",
      parentId: editor.getCurrentPageId(),
      x,
      y,
      props: {
        w: size.w,
        h: size.h,
        engine: "local-svg",
        openRouterModel: "",
        detail: "balanced",
        lastSvg: sanitized,
        isProcessing: false
      },
      meta: { kurva: { agent: true } }
    } as Parameters<Editor["createShape"]>[0]);
    revealShape(editor, id);
    return result({
      inserted: "sanitized SVG",
      id,
      x,
      y,
      width: size.w,
      height: size.h,
      bytes: new TextEncoder().encode(sanitized).byteLength
    });
  }

  if (name === "set_text") {
    const shape = editor.getShape(args.shapeId as Parameters<Editor["getShape"]>[0]);
    if (!shape || (shape.type !== "text" && shape.type !== "note"))
      throw new Error("Choose a text or note shape on the current page.");
    mark("Agent: set text");
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
    mark("Agent: apply style");
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
    mark("Agent: align shapes");
    editor.alignShapes(ids, alignment[string(args.edge) as keyof typeof alignment]);
    return result({ aligned: ids.length, edge: args.edge });
  }

  throw new Error("This canvas tool is not supported by this Studio build.");
}

/** Same format as tldraw's createShapeId, without importing tldraw into the Home bundle. */
function newShapeId(): TLShapeId {
  return `shape:${crypto.randomUUID()}` as TLShapeId;
}

const removedNote =
  "Kurva removed content that could reach the network or run code. Use system fonts, CSS, gradients, inline SVG and data: images instead.";

/** Which tldraw shape types accept `w` and `h` props (text only has `w`, notes have neither). */
const SIZED_SHAPES: Record<string, { w: boolean; h: boolean }> = {
  geo: { w: true, h: true },
  frame: { w: true, h: true },
  "design-frame": { w: true, h: true },
  "vector-studio": { w: true, h: true },
  image: { w: true, h: true },
  text: { w: true, h: false }
};

type DesignFrame = Extract<TLShape, { type: "design-frame" }>;

function designFrame(editor: Editor, id: unknown): DesignFrame {
  const shape = typeof id === "string" ? editor.getShape(id as TLShapeId) : undefined;
  if (shape?.type !== "design-frame" || !editor.getCurrentPageShapeIds().has(shape.id))
    throw new Error("frameId must be a design frame on the current page. Call get_canvas_summary to list them.");
  return shape as DesignFrame;
}

function kurvaMeta(shape: TLShape): Record<string, unknown> {
  const value = (shape.meta as Record<string, unknown> | undefined)?.kurva;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isAutoHeight(shape: TLShape): boolean {
  return kurvaMeta(shape).autoHeight === true;
}

function frameBox(editor: Editor, id: string): FrameBox | undefined {
  const shape = editor.getShape(id as TLShapeId);
  if (!shape || (shape.type !== "frame" && shape.type !== "design-frame")) return undefined;
  const bounds = editor.getShapePageBounds(shape);
  return bounds ? { id: shape.id, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h } : undefined;
}

function pageFrameBoxes(editor: Editor): FrameBox[] {
  return editor
    .getCurrentPageShapes()
    .filter(
      (shape) =>
        (shape.type === "frame" || shape.type === "design-frame") && shape.parentId === editor.getCurrentPageId()
    )
    .flatMap((shape) => {
      const bounds = editor.getShapePageBounds(shape);
      return bounds ? [{ id: shape.id, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }] : [];
    });
}

function vectorBoxes(editor: Editor): FrameBox[] {
  return editor
    .getCurrentPageShapes()
    .filter((shape) => shape.type === "vector-studio" && shape.parentId === editor.getCurrentPageId())
    .flatMap((shape) => {
      const bounds = editor.getShapePageBounds(shape);
      return bounds ? [{ id: shape.id, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }] : [];
    });
}

/** Brings a new agent shape into view; camera moves are not part of undo history. */
function revealShape(editor: Editor, id: TLShapeId): void {
  const bounds = editor.getShapePageBounds(id);
  if (!bounds) return;
  try {
    editor.zoomToBounds(bounds, { inset: 64, animation: { duration: 240 } });
  } catch {
    // Camera moves are a convenience; a locked camera must not fail the tool.
  }
}

function result(value: unknown, limit = MAX_RESULT_CHARS): CanvasToolExecutionResult {
  return { content: truncate(JSON.stringify(value), limit) };
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 24)}… [result truncated]`;
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

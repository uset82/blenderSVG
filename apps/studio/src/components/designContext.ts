import type { StudioDesignContext } from "@codex-avatar-studio/avatar-core";
import type { Editor, TLShape } from "tldraw";

const MAX_FRAMES = 40;
const MAX_TARGET_HTML = 60_000;

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function size(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100_000, Math.round(value))) : 0;
}

/**
 * A compact snapshot of the current page for the agent: top-level frames, design frames and SVG
 * drawings with ids and sizes, which frames are empty, and the selection. With `includeTarget`, a
 * model without tools also gets the HTML of the design frame it may update.
 */
export function buildDesignContext(editor: Editor, options: { includeTarget?: boolean } = {}): StudioDesignContext {
  const pageId = editor.getCurrentPageId();
  const shapes = editor.getCurrentPageShapes();
  const hasChildren = new Set(shapes.map((shape) => String(shape.parentId)));
  const frames: StudioDesignContext["frames"] = [];
  for (const shape of shapes) {
    if (frames.length >= MAX_FRAMES) break;
    const kind =
      shape.type === "design-frame"
        ? "design-frame"
        : shape.type === "frame"
          ? "frame"
          : shape.type === "vector-studio"
            ? "svg"
            : null;
    if (!kind || (kind !== "frame" && shape.parentId !== pageId)) continue;
    const props = shape.props as { w?: unknown; h?: unknown; name?: unknown };
    const bounds = editor.getShapePageBounds(shape.id);
    frames.push({
      id: String(shape.id),
      name: text(props.name, kind === "svg" ? "Drawing" : kind === "design-frame" ? "Design" : "Frame"),
      kind,
      x: Math.round(bounds?.x ?? shape.x),
      y: Math.round(bounds?.y ?? shape.y),
      width: size(props.w ?? bounds?.w),
      height: size(props.h ?? bounds?.h),
      ...(kind === "frame" && !hasChildren.has(String(shape.id)) ? { empty: true } : {})
    });
  }
  const selectedIds = editor
    .getSelectedShapeIds()
    .slice(0, 20)
    .map((id) => String(id));
  const context: StudioDesignContext = { pageName: text(editor.getCurrentPage().name, "Page"), frames, selectedIds };
  if (options.includeTarget) {
    const target = targetDesignFrame(editor, shapes);
    if (target) context.target = target;
  }
  return context;
}

function targetDesignFrame(editor: Editor, shapes: TLShape[]): StudioDesignContext["target"] | undefined {
  const designFrames = shapes.filter((shape) => shape.type === "design-frame");
  const selected = editor.getSelectedShapes().find((shape) => shape.type === "design-frame");
  const shape = selected ?? (designFrames.length === 1 ? designFrames[0] : undefined);
  if (!shape) return undefined;
  const props = shape.props as { name?: unknown; html?: unknown };
  const html = typeof props.html === "string" ? props.html : "";
  if (!html || html.length > MAX_TARGET_HTML) return undefined;
  return { id: String(shape.id), name: text(props.name, "Design"), html };
}

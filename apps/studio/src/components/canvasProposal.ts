import { parseCanvasToolArguments } from "@codex-avatar-studio/studio-agent/agentGuards";
import { sanitizeDesignHtml } from "../shapes/designFrameHtml.js";

export interface ProposalShape {
  id: string;
  type: "geo" | "text" | "frame" | "design-frame";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  html?: string;
}

export interface CanvasProposal {
  id: string;
  summary: string;
  shapes: ProposalShape[];
}

export interface ProposalEditor {
  markHistoryStoppingPoint: (name: string) => void;
  createShape: (shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> }) => void;
}

/** Props that tldraw accepts for each previewed shape type; tldraw rejects unknown props. */
function proposalProps(shape: ProposalShape): Record<string, unknown> {
  if (shape.type === "design-frame") return { w: shape.w, h: shape.h, name: shape.label, html: shape.html ?? "" };
  if (shape.type === "frame") return { w: shape.w, h: shape.h, name: shape.label };
  if (shape.type === "text")
    return {
      w: Math.max(1, shape.w),
      autoSize: false,
      richText: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: shape.label }] }] }
    };
  return { geo: "rectangle", w: shape.w, h: shape.h };
}

export function applyProposal(editor: ProposalEditor, proposal: CanvasProposal): void {
  editor.markHistoryStoppingPoint(`apply ${proposal.id}`);
  for (const shape of proposal.shapes) {
    editor.createShape({ id: shape.id, type: shape.type, x: shape.x, y: shape.y, props: proposalProps(shape) });
  }
}

export function proposalFromTool(
  name: string,
  argumentsJson: string,
  origin: { x: number; y: number }
): CanvasProposal | null {
  const parsed = parseCanvasToolArguments(name, argumentsJson);
  if (!parsed.success) return null;
  const args = parsed.data;
  const id = `proposal:${crypto.randomUUID()}`;
  if (name === "create_frame") {
    const w = Number(args.width);
    const h = Number(args.height);
    return {
      id,
      summary: `Add frame ${String(args.name)}`,
      shapes: [
        {
          id: `shape:${crypto.randomUUID()}`,
          type: "frame",
          x: origin.x - w / 2,
          y: origin.y - h / 2,
          w,
          h,
          label: String(args.name)
        }
      ]
    };
  }
  if (name === "create_design_frame") {
    const w = typeof args.width === "number" ? args.width : 1440;
    const h = typeof args.height === "number" ? args.height : 900;
    return {
      id,
      summary: `Add design frame ${String(args.name)}`,
      shapes: [
        {
          id: `shape:${crypto.randomUUID()}`,
          type: "design-frame",
          x: origin.x - w / 2,
          y: origin.y - h / 2,
          w,
          h,
          label: String(args.name),
          html: sanitizeDesignHtml(String(args.html))
        }
      ]
    };
  }
  if (name === "create_shapes" && Array.isArray(args.shapes)) {
    const shapes = args.shapes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const kind = record.type === "text" || record.type === "note" ? "text" : "geo";
      return [
        {
          id: `shape:${crypto.randomUUID()}`,
          type: kind as ProposalShape["type"],
          x: origin.x + Number(record.x),
          y: origin.y + Number(record.y),
          w: Number(record.width),
          h: Number(record.height),
          label: String(record.text ?? record.type ?? "Shape")
        }
      ];
    });
    if (!shapes.length) return null;
    return { id, summary: `Add ${shapes.length} shapes`, shapes };
  }
  return null;
}

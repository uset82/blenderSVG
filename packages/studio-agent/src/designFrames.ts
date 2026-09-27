import { DESIGN_FRAME_GAP } from "./limits.js";

/** A frame's page-space bounds. */
export interface FrameBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacementInput {
  width: number;
  height: number;
  /** Frames already on the page (design frames and plain frames). */
  existing: FrameBox[];
  relativeTo?: FrameBox | undefined;
  side?: "right" | "below" | undefined;
  viewportCenter: { x: number; y: number };
}

function overlaps(a: FrameBox, b: FrameBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Where a new design frame goes: next to `relativeTo` when given, otherwise to the right of the
 * rightmost frame, otherwise centred in the viewport. It then shifts right until it overlaps nothing.
 */
export function placeDesignFrame(input: PlacementInput): { x: number; y: number } {
  const { width, height, existing } = input;
  let x: number;
  let y: number;
  if (input.relativeTo) {
    const anchor = input.relativeTo;
    if (input.side === "below") {
      x = anchor.x;
      y = anchor.y + anchor.h + DESIGN_FRAME_GAP;
    } else {
      x = anchor.x + anchor.w + DESIGN_FRAME_GAP;
      y = anchor.y;
    }
  } else if (existing.length) {
    const rightmost = existing.reduce((best, frame) => (frame.x + frame.w > best.x + best.w ? frame : best));
    x = rightmost.x + rightmost.w + DESIGN_FRAME_GAP;
    y = Math.min(...existing.map((frame) => frame.y));
  } else {
    x = Math.round(input.viewportCenter.x - width / 2);
    y = Math.round(input.viewportCenter.y - height / 2);
  }
  const candidate: FrameBox = { id: "", x, y, w: width, h: height };
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const hit = existing.find((frame) => overlaps(candidate, frame));
    if (!hit) break;
    candidate.x = hit.x + hit.w + DESIGN_FRAME_GAP;
  }
  return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
}

export interface HtmlEdit {
  find: string;
  replace: string;
}

export type HtmlEditResult = { ok: true; html: string; applied: number } | { ok: false; error: string };

/**
 * Applies exact find/replace edits in order, all or nothing. Each `find` must match exactly once in
 * the document as it stands when that edit runs, so an edit can never land in the wrong place.
 */
export function applyHtmlEdits(html: string, edits: HtmlEdit[]): HtmlEditResult {
  let working = html;
  for (const [index, edit] of edits.entries()) {
    const label = `Edit ${index + 1}`;
    if (!edit.find) return { ok: false, error: `${label} has an empty find string.` };
    const first = working.indexOf(edit.find);
    if (first < 0) {
      return {
        ok: false,
        error: `${label}: the find text was not found. Call get_design_frame and copy the exact text, including spaces and quotes. No edits were applied.`
      };
    }
    const second = working.indexOf(edit.find, first + 1);
    if (second >= 0) {
      let count = 2;
      let next = working.indexOf(edit.find, second + 1);
      while (next >= 0 && count < 50) {
        count += 1;
        next = working.indexOf(edit.find, next + 1);
      }
      return {
        ok: false,
        error: `${label}: the find text matched ${count} places. Include more surrounding text so it matches exactly once. No edits were applied.`
      };
    }
    working = working.slice(0, first) + edit.replace + working.slice(first + edit.find.length);
  }
  return { ok: true, html: working, applied: edits.length };
}

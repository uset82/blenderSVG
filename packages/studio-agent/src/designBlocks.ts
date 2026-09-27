import { DEFAULT_DESIGN_WIDTH, MAX_DESIGN_HTML_CHARS } from "./limits.js";

/**
 * Designs returned as text. Models without tool support (and tool models that answer in prose) send
 * pages as fenced ```html blocks and drawings as ```svg blocks or raw <svg> markup; Kurva places them.
 */
export interface DesignBlock {
  kind: "html" | "svg";
  name: string;
  /** Frame width for HTML, drawing width for SVG. */
  width: number;
  /** The frame to update, from `target="…"` in the kurva-frame comment. */
  target?: string;
  content: string;
  /** False when the reply stopped before the block ended. */
  complete: boolean;
  /** Where the block sits in the reply, for redaction. */
  start: number;
  end: number;
}

const MAX_BLOCKS = 6;
const FENCE = /```([A-Za-z0-9_-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
const RAW_SVG = /<svg\b[\s\S]*?<\/svg>/gi;

function attribute(comment: string, name: string): string | undefined {
  return new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(comment)?.[1]?.trim() || undefined;
}

function titleOf(markup: string): string | undefined {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(markup)?.[1];
  return title
    ? title
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || undefined
    : undefined;
}

function clampWidth(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(2560, Math.max(240, Math.round(value)));
}

function classify(language: string, body: string): "html" | "svg" | null {
  const head = body.trimStart().slice(0, 200).toLowerCase();
  if (language === "svg" || (language !== "html" && head.startsWith("<svg"))) return "svg";
  if (language === "xml" && head.includes("<svg")) return "svg";
  if (
    language === "html" ||
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<!-- kurva-frame")
  ) {
    return "html";
  }
  return null;
}

function toBlock(
  kind: "html" | "svg",
  body: string,
  complete: boolean,
  start: number,
  end: number
): DesignBlock | null {
  const content = body.trim();
  if (!content || content.length > MAX_DESIGN_HTML_CHARS) return null;
  if (kind === "svg") {
    if (!complete || !/<\/svg>\s*$/i.test(content)) return null;
    const viewBox = /viewBox\s*=\s*"[\d.\s-]+\s([\d.]+)\s[\d.]+"/i.exec(content)?.[1];
    return {
      kind,
      name: titleOf(content) ?? "Illustration",
      width: clampWidth(viewBox ? Number(viewBox) : undefined, 512),
      content,
      complete,
      start,
      end
    };
  }
  if (!/<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]/i.test(content)) return null;
  const comment = /<!--\s*kurva-frame([\s\S]*?)-->/i.exec(content)?.[1] ?? "";
  const width = attribute(comment, "width");
  const target = attribute(comment, "target");
  return {
    kind,
    name: (attribute(comment, "name") ?? titleOf(content) ?? "Design").slice(0, 120),
    width: clampWidth(width ? Number(width) : undefined, DEFAULT_DESIGN_WIDTH),
    ...(target && /^shape:[A-Za-z0-9_-]{1,80}$/.test(target) ? { target } : {}),
    content,
    complete,
    start,
    end
  };
}

export function extractDesignBlocks(text: string): DesignBlock[] {
  const blocks: DesignBlock[] = [];
  for (const match of text.matchAll(FENCE)) {
    const [whole, language = "", body = ""] = match;
    const start = match.index ?? 0;
    const kind = classify(language.toLowerCase(), body);
    if (!kind) continue;
    const complete = whole.trimEnd().endsWith("```") && whole.length > 6;
    const block = toBlock(kind, body, complete, start, start + whole.length);
    if (block) blocks.push(block);
    if (blocks.length >= MAX_BLOCKS) return blocks;
  }
  if (blocks.length > 0) return blocks;
  // No fenced blocks: accept raw <svg> markup written straight into the reply.
  for (const match of text.matchAll(RAW_SVG)) {
    const start = match.index ?? 0;
    const block = toBlock("svg", match[0], true, start, start + match[0].length);
    if (block) blocks.push(block);
    if (blocks.length >= MAX_BLOCKS) break;
  }
  return blocks;
}

/**
 * Replaces placed blocks in the reply with a short note, so the saved conversation stays small and the
 * next request does not resend whole pages. `notes[i]` describes where block i went.
 */
export function redactDesignBlocks(text: string, blocks: DesignBlock[], notes: string[]): string {
  let result = text;
  const ordered = blocks
    .map((block, index) => ({ block, note: notes[index] }))
    .sort((a, b) => b.block.start - a.block.start);
  for (const { block, note } of ordered) {
    const label = note ?? `${block.kind === "svg" ? "Illustration" : "Design"} “${block.name}”`;
    result = `${result.slice(0, block.start)}[${label}]${result.slice(block.end)}`;
  }
  return result.trim();
}

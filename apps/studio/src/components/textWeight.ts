import type { TLRichText } from "tldraw";

export type TextWeight = "regular" | "bold";
type TextNode = Record<string, unknown>;

/** Returns undefined when no text shapes are supplied, and null for mixed weights. */
export function summarizeTextWeight(documents: unknown[]): TextWeight | null | undefined {
  if (documents.length === 0) return undefined;
  const weights = documents.map(readDocumentWeight);
  const first = weights[0];
  if (first === null || !weights.every((weight) => weight === first)) return null;
  return first;
}

export function setRichTextWeight(document: TLRichText, weight: TextWeight): TLRichText {
  if (!isRecord(document)) return document;
  return mapTextNodes(document, (node) => {
    const marks = Array.isArray(node.marks) ? node.marks.filter(isRecord) : [];
    const nextMarks = marks.filter((mark) => mark.type !== "bold");
    if (weight === "bold") nextMarks.push({ type: "bold" });
    const { marks: _marks, ...rest } = node;
    return nextMarks.length > 0 ? { ...rest, marks: nextMarks } : rest;
  }) as TLRichText;
}

function readDocumentWeight(document: unknown): TextWeight | null {
  const states: boolean[] = [];
  visitTextNodes(document, (node) => {
    const marks = Array.isArray(node.marks) ? node.marks : [];
    states.push(marks.some((mark) => isRecord(mark) && mark.type === "bold"));
  });
  if (states.length === 0) return "regular";
  if (states.every((bold) => bold === states[0])) return states[0] ? "bold" : "regular";
  return null;
}

function mapTextNodes(value: unknown, update: (node: TextNode) => TextNode): unknown {
  if (Array.isArray(value)) return value.map((child) => mapTextNodes(child, update));
  if (!isRecord(value)) return value;
  const node = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapTextNodes(child, update)]));
  return node.type === "text" ? update(node) : node;
}

function visitTextNodes(value: unknown, visit: (node: TextNode) => void): void {
  if (Array.isArray(value)) {
    value.forEach((child) => {
      visitTextNodes(child, visit);
    });
    return;
  }
  if (!isRecord(value)) return;
  if (value.type === "text") visit(value);
  if (Array.isArray(value.content)) {
    value.content.forEach((child) => {
      visitTextNodes(child, visit);
    });
  }
}

function isRecord(value: unknown): value is TextNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

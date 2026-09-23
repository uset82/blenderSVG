import { XMLParser, XMLValidator } from "fast-xml-parser";

/** Remove executable or externally loaded content before an SVG enters the Webview. */
export function sanitizeSvg(svg: string): string {
  const unsafeElement =
    "(?:[a-zA-Z_][\\w.-]*:)?(?:script|foreignObject|style|iframe|object|embed|link|meta|image|audio|video)";
  const pairedUnsafeElement = new RegExp(`<${unsafeElement}\\b[^>]*>[\\s\\S]*?<\\/${unsafeElement}\\s*>`, "gi");
  const standaloneUnsafeElement = new RegExp(`<\\/?${unsafeElement}\\b[^>]*\\/?>`, "gi");

  return svg
    .replace(/<!DOCTYPE[\s\S]*?\]>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(pairedUnsafeElement, "")
    .replace(standaloneUnsafeElement, "")
    .replace(/\s([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, sanitizeAttribute)
    .replace(/\s(?:on[a-z]+|style|href|xlink:href|src)\s*=\s*(?!["'])[^\s>]+/gi, "");
}

/**
 * Prepare untrusted SVG for an inert <img> preview. The existing sanitizer strips
 * executable content; this second, structural pass rejects malformed XML,
 * unsupported SVG elements, and any reference that could load another resource.
 */
export function prepareSvgPreview(input: string): { svg: string; src: string } {
  if (typeof input !== "string" || input.length === 0 || input.length > 1_000_000) {
    throw new Error("SVG preview is empty or exceeds the 1 MB limit.");
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b|<\?|&#(?:x[0-9a-f]+|\d+);|&(?!(?:amp|lt|gt|quot|apos);)/i.test(input)) {
    throw new Error("SVG preview contains an XML declaration or encoded entity.");
  }

  const svg = sanitizeSvg(input).trim();
  if (XMLValidator.validate(svg) !== true) {
    throw new Error("SVG preview contains malformed XML.");
  }

  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    processEntities: true
  }).parse(svg) as Record<string, unknown>;

  if (Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, "svg")) {
    throw new Error("SVG preview must have one SVG root.");
  }
  const root = parsed.svg;
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error("SVG preview has an invalid root.");
  }
  if ((root as Record<string, unknown>)["@_xmlns"] !== "http://www.w3.org/2000/svg") {
    throw new Error("SVG preview has an invalid namespace.");
  }
  validatePreviewNode("svg", root);

  return { svg, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

const previewElements = new Set([
  "svg",
  "g",
  "defs",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "text",
  "tspan",
  "title",
  "desc",
  "filter",
  "feGaussianBlur",
  "feOffset",
  "feBlend",
  "feComposite",
  "feColorMatrix",
  "feMerge",
  "feMergeNode",
  "feFlood",
  "feDropShadow",
  "feMorphology",
  "feComponentTransfer",
  "feFuncR",
  "feFuncG",
  "feFuncB",
  "feFuncA"
]);

function validatePreviewNode(name: string, value: unknown): void {
  if (!previewElements.has(name)) {
    throw new Error(`SVG preview contains unsupported element: ${name}.`);
  }
  if (Array.isArray(value)) {
    for (const child of value) validatePreviewNode(name, child);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "#text") continue;
    if (key.startsWith("@_")) {
      validatePreviewAttribute(key.slice(2), String(child));
      continue;
    }
    validatePreviewNode(key, child);
  }
}

function validatePreviewAttribute(name: string, value: string): void {
  const lowerName = name.toLowerCase();
  if (lowerName === "xmlns") {
    if (value !== "http://www.w3.org/2000/svg") throw new Error("SVG preview has an invalid namespace.");
    return;
  }
  if (lowerName === "xmlns:xlink") {
    if (value !== "http://www.w3.org/1999/xlink") throw new Error("SVG preview has an invalid namespace.");
    return;
  }
  if (
    lowerName.startsWith("on") ||
    lowerName === "style" ||
    lowerName === "src" ||
    (name.includes(":") && lowerName !== "xlink:href" && lowerName !== "xml:space")
  ) {
    throw new Error("SVG preview contains an unsafe attribute.");
  }
  if (lowerName === "href" || lowerName === "xlink:href") {
    if (!/^#[A-Za-z_][\w:.-]*$/.test(value)) throw new Error("SVG preview contains an external reference.");
    return;
  }
  if (/\b(?:javascript|data|https?|file|blob|ftp):/i.test(value) || /^\s*\/\//.test(value)) {
    throw new Error("SVG preview contains an external reference.");
  }
  for (const match of value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (!/^#[A-Za-z_][\w:.-]*$/.test(match[2] ?? "")) {
      throw new Error("SVG preview contains an external reference.");
    }
  }
}

function sanitizeAttribute(
  match: string,
  rawName: string,
  _quoted: string,
  doubleValue?: string,
  singleValue?: string
) {
  const name = rawName.toLowerCase();
  const value = doubleValue ?? singleValue ?? "";

  if (name.startsWith("on") || name === "style" || name === "src") return "";
  if (name === "href" || name === "xlink:href") {
    return /^#[A-Za-z_][\w:.-]*$/.test(value) ? match : "";
  }
  if (name === "xmlns" || name.startsWith("xmlns:")) return match;
  if (/\b(?:javascript|data|https?|file|blob|ftp):/i.test(value) || /^\s*\/\//.test(value)) return "";

  const urlReferences = [...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)];
  if (urlReferences.some((reference) => !/^#[A-Za-z_][\w:.-]*$/.test(reference[2] ?? ""))) return "";
  return match;
}

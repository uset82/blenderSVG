/**
 * Sanitizes agent-authored HTML+CSS for a design frame.
 *
 * The frame renders inside a sandboxed iframe with no scripts, and the page CSP blocks every network
 * request the design could make, but the stored HTML is still cleaned so exports and imports never
 * carry active content. Only `data:image/*` URLs survive; every other URL (remote or same-origin) is
 * dropped so a design cannot make requests, including to the standalone host's `/api`.
 *
 * Parsing happens without inline styles: Kurva hosts serve `style-src 'self'`, and a DOMParser
 * document inherits the page CSP, so parsing a `<style>` element or a `style=""` attribute would log
 * CSP violations. `<style>` blocks are lifted out as text and `style` attributes are renamed to
 * `data-kurva-style` before parsing, then restored only when the document is serialized.
 */

export interface SanitizedDesign {
  /** A complete `<!doctype html>` document. */
  html: string;
  /** Human-readable notes about what was removed, e.g. "2 remote images". */
  removed: string[];
}

/** A parsed design whose CSS is kept outside the DOM so nothing is applied as an inline style. */
export interface ParsedDesign {
  doc: Document;
  /** `<style>` contents in document order. */
  css: string[];
}

export const DESIGN_STYLE_ATTRIBUTE = "data-kurva-style";

const BLOCKED_ELEMENTS = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "link",
  "meta",
  "base",
  "portal",
  "template",
  "noscript",
  "foreignobject",
  "audio",
  "video",
  "source",
  "track"
]);

const URL_ATTRIBUTES = new Set([
  "src",
  "srcset",
  "href",
  "xlink:href",
  "action",
  "formaction",
  "poster",
  "background",
  "cite",
  "data",
  "manifest",
  "longdesc",
  "ping",
  "codebase",
  "archive",
  "lowsrc",
  "dynsrc",
  "profile",
  "usemap"
]);

const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*?))\s*\)/gi;
const CSS_IMPORT = /@import\b[^;]*;?/gi;
const CSS_DANGEROUS = /(?:expression\s*\(|-moz-binding\s*:|behavior\s*:)/gi;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;
const TAG_ATTRIBUTE = /(\s+)([^\s"'>/=]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

const LABELS: Record<string, [string, string]> = {
  script: ["script", "scripts"],
  stylesheet: ["external stylesheet", "external stylesheets"],
  element: ["embedded element", "embedded elements"],
  handler: ["event handler", "event handlers"],
  image: ["remote image", "remote images"],
  link: ["external link", "external links"],
  cssUrl: ["remote CSS url()", "remote CSS url() values"],
  cssImport: ["CSS @import", "CSS @import rules"],
  attribute: ["unsafe attribute", "unsafe attributes"]
};

/** Keeps only CSS that cannot reach the network or run code. */
export function sanitizeDesignCss(css: string, removed?: Map<string, number>): string {
  return css
    .replace(CSS_IMPORT, () => {
      bump(removed, "cssImport");
      return "";
    })
    .replace(CSS_DANGEROUS, () => {
      bump(removed, "attribute");
      return "invalid:";
    })
    .replace(
      CSS_URL,
      (match, doubleQuoted: string | undefined, singleQuoted: string | undefined, bare: string | undefined) => {
        const value = (doubleQuoted ?? singleQuoted ?? bare ?? "").trim();
        if (DATA_IMAGE.test(value) || value.startsWith("#")) return match;
        bump(removed, "cssUrl");
        return "none";
      }
    );
}

/** Parses design HTML with its CSS held aside (see the module note). */
export function parseDesign(html: string): ParsedDesign {
  const css: string[] = [];
  const withoutStyles = html.replace(STYLE_BLOCK, (_block, content: string) => {
    css.push(content);
    return "";
  });
  const doc = new DOMParser().parseFromString(renameStyleAttributes(withoutStyles), "text/html");
  return { doc, css };
}

/** Removes active content in place and reports what was removed. */
export function sanitizeParsedDesign(design: ParsedDesign): string[] {
  const removed = new Map<string, number>();
  design.css = design.css.map((css) => sanitizeDesignCss(css, removed));
  for (const element of [...design.doc.querySelectorAll("*")]) {
    const tag = element.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tag)) {
      bump(removed, blockedLabel(tag));
      element.remove();
      continue;
    }
    if ((tag === "set" || tag === "animate") && /href/i.test(element.getAttribute("attributeName") ?? "")) {
      bump(removed, "attribute");
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        bump(removed, "handler");
        element.removeAttribute(attribute.name);
      } else if (name === DESIGN_STYLE_ATTRIBUTE) {
        element.setAttribute(attribute.name, sanitizeDesignCss(attribute.value, removed));
      } else if (name === "target" || name === "download") {
        element.removeAttribute(attribute.name);
      } else if (URL_ATTRIBUTES.has(name)) {
        if (!keepUrl(tag, name, value)) {
          bump(removed, urlLabel(name));
          element.removeAttribute(attribute.name);
        }
      } else if (/^\s*javascript:/i.test(value)) {
        bump(removed, "attribute");
        element.removeAttribute(attribute.name);
      }
    }
  }
  return describe(removed);
}

/** Serializes a parsed design back to a normal HTML document with `<style>` and `style=""`. */
export function serializeDesign(design: ParsedDesign, headExtras = ""): string {
  const css = design.css.map((block) => block.replace(/<\/style/gi, "<\\/style")).join("\n");
  const markup = design.doc.documentElement.outerHTML.replaceAll(` ${DESIGN_STYLE_ATTRIBUTE}="`, ' style="');
  const styleTag = css.trim() ? `<style>\n${css}\n</style>` : "";
  const withHead = markup.replace(/<head\b[^>]*>/i, (head) => `${head}${headExtras}${styleTag}`);
  return `<!doctype html>\n${withHead}`;
}

export function sanitizeDesignDocument(html: string): SanitizedDesign {
  const design = parseDesign(html);
  const removed = sanitizeParsedDesign(design);
  return { html: serializeDesign(design), removed };
}

/** Back-compatible string form used by proposals and imports. */
export function sanitizeDesignHtml(html: string): string {
  return sanitizeDesignDocument(html).html;
}

/** A standalone HTML file for Export HTML: the sanitized document plus a charset, viewport and title. */
export function designFrameExportDocument(html: string, title: string): string {
  const design = parseDesign(html);
  sanitizeParsedDesign(design);
  const hasTitle = Boolean(design.doc.head.querySelector("title"));
  const extras = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${
    hasTitle ? "" : `<title>${escapeText(title)}</title>`
  }`;
  return `${serializeDesign(design, extras)}\n`;
}

/** Renames `style` attributes inside start tags. Text outside tags is never changed. */
function renameStyleAttributes(html: string): string {
  let output = "";
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open < 0) {
      output += html.slice(index);
      break;
    }
    output += html.slice(index, open);
    if (html.startsWith("<!--", open)) {
      const close = html.indexOf("-->", open + 4);
      const stop = close < 0 ? html.length : close + 3;
      output += html.slice(open, stop);
      index = stop;
      continue;
    }
    if (!/[a-zA-Z]/.test(html[open + 1] ?? "")) {
      output += "<";
      index = open + 1;
      continue;
    }
    let end = open + 1;
    let quote: string | null = null;
    while (end < html.length) {
      const char = html[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
      end += 1;
    }
    const tag = html.slice(open, end + 1);
    const nameEnd = /^<[^\s/>]+/.exec(tag)?.[0].length ?? 1;
    output +=
      tag.slice(0, nameEnd) +
      tag
        .slice(nameEnd)
        .replace(TAG_ATTRIBUTE, (match, space: string, name: string, value = "") =>
          name.toLowerCase() === "style" ? `${space}${DESIGN_STYLE_ATTRIBUTE}${value}` : match
        );
    index = end + 1;
  }
  return output;
}

function keepUrl(tag: string, name: string, value: string): boolean {
  if (name === "src" || name === "poster" || name === "background") return DATA_IMAGE.test(value);
  if (name === "href" || name === "xlink:href") {
    if (value.startsWith("#")) return true;
    return (tag === "image" || tag === "feimage" || tag === "use" || tag === "pattern") && DATA_IMAGE.test(value);
  }
  return false;
}

function blockedLabel(tag: string): string {
  if (tag === "script") return "script";
  if (tag === "link") return "stylesheet";
  if (tag === "meta" || tag === "base" || tag === "style") return "";
  return "element";
}

function urlLabel(name: string): string {
  if (name === "src" || name === "srcset" || name === "poster") return "image";
  if (name === "href" || name === "xlink:href") return "link";
  return "attribute";
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bump(counts: Map<string, number> | undefined, key: string): void {
  if (!counts || !key) return;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function describe(counts: Map<string, number>): string[] {
  return [...counts.entries()].map(([key, count]) => {
    const [one, many] = LABELS[key] ?? [key, key];
    return `${count} ${count === 1 ? one : many}`;
  });
}

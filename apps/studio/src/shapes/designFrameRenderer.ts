import { DESIGN_STYLE_ATTRIBUTE, parseDesign, sanitizeParsedDesign } from "./designHtml.js";

/**
 * Renders design-frame HTML into a sandboxed iframe without inline styles.
 *
 * Every Kurva host serves `style-src 'self'`, and an about:blank/srcdoc iframe inherits the page CSP,
 * so a `<style>` block or `style=""` attribute in agent HTML would be refused. CSS applied through the
 * CSSOM is not governed by `style-src`, so the renderer parses the sanitized HTML inertly, imports the
 * body without style attributes, adopts the `<style>` text as a constructed stylesheet, and reapplies
 * each `style=""` through `element.style.cssText`. The iframe has no `allow-scripts`, so nothing in the
 * design can run; `allow-same-origin` only lets this page fill the document.
 */

const BASE_CSS = "html,body{margin:0;padding:0}body{overflow:hidden}";
const STYLE_INDEX = "data-kurva-style-index";

interface PreparedDesign {
  css: string;
  inlineStyles: string[];
  htmlAttributes: Array<[string, string]>;
  bodyAttributes: Array<[string, string]>;
  title: string;
  body: Document;
}

const cache = new Map<string, PreparedDesign>();

function prepare(html: string): PreparedDesign {
  const cached = cache.get(html);
  if (cached) return cached;
  const design = parseDesign(html);
  sanitizeParsedDesign(design);
  const doc = design.doc;
  const css = design.css.join("\n");
  const inlineStyles: string[] = [];
  for (const element of [...doc.querySelectorAll(`[${DESIGN_STYLE_ATTRIBUTE}]`)]) {
    element.setAttribute(STYLE_INDEX, String(inlineStyles.length));
    inlineStyles.push(element.getAttribute(DESIGN_STYLE_ATTRIBUTE) ?? "");
    element.removeAttribute(DESIGN_STYLE_ATTRIBUTE);
  }
  const attributes = (element: Element) =>
    [...element.attributes]
      .filter((attribute) => ["class", "id", "lang", "dir"].includes(attribute.name))
      .map((attribute) => [attribute.name, attribute.value] as [string, string]);
  const prepared: PreparedDesign = {
    css,
    inlineStyles,
    htmlAttributes: attributes(doc.documentElement),
    bodyAttributes: attributes(doc.body),
    title: doc.title,
    body: doc
  };
  cache.set(html, prepared);
  if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  return prepared;
}

function replaceAttributes(element: Element, attributes: Array<[string, string]>): void {
  for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  for (const [name, value] of attributes) element.setAttribute(name, value);
}

/** Fills the iframe's document. Returns false when the document is not reachable yet. */
export function mountDesignDocument(iframe: HTMLIFrameElement, html: string): boolean {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow as (Window & typeof globalThis) | null;
  if (!doc || !win || !doc.documentElement) return false;
  const prepared = prepare(html);
  if (!doc.head) doc.documentElement.prepend(doc.createElement("head"));
  if (!doc.body) doc.documentElement.append(doc.createElement("body"));
  replaceAttributes(doc.documentElement, prepared.htmlAttributes);
  replaceAttributes(doc.body, prepared.bodyAttributes);
  doc.head.replaceChildren();
  if (prepared.title) {
    const title = doc.createElement("title");
    title.textContent = prepared.title;
    doc.head.append(title);
  }
  doc.body.replaceChildren(...[...prepared.body.body.childNodes].map((node) => doc.importNode(node, true)));
  for (const element of [...doc.querySelectorAll(`[${STYLE_INDEX}]`)]) {
    const css = prepared.inlineStyles[Number(element.getAttribute(STYLE_INDEX))] ?? "";
    element.removeAttribute(STYLE_INDEX);
    (element as HTMLElement | SVGElement).style.cssText = css;
  }
  try {
    const sheet = new win.CSSStyleSheet();
    sheet.replaceSync(`${BASE_CSS}\n${prepared.css}`);
    doc.adoptedStyleSheets = [sheet];
  } catch {
    // A browser without constructable stylesheets still shows the content, just unstyled.
  }
  return true;
}

/** Measures the rendered height of `html` at `width` in a hidden iframe. */
export function measureDesignHtml(html: string, width: number, fallback = 900): number {
  if (typeof document === "undefined" || !document.body) return fallback;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:200px;border:0;visibility:hidden;pointer-events:none`;
  document.body.append(iframe);
  try {
    // Lay the iframe out first so every engine has built the frame's layout before we read its height.
    iframe.getBoundingClientRect();
    if (!mountDesignDocument(iframe, html)) return fallback;
    const doc = iframe.contentDocument;
    const height = Math.max(doc?.documentElement.scrollHeight ?? 0, doc?.body.scrollHeight ?? 0);
    return height > 0 ? Math.min(20_000, Math.max(200, Math.ceil(height))) : fallback;
  } catch {
    return fallback;
  } finally {
    iframe.remove();
  }
}

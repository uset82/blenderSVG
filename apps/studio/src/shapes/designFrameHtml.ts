const BLOCKED_TAGS = /<\/?(?:script|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const URL_ATTR =
  /\s(?:src|href|action|srcset|poster|background|formaction|cite|data|manifest|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const CSS_URL = /url\s*\([^)]*\)/gi;
const CSS_IMPORT = /@import\b[^;]*;?/gi;

export function sanitizeDesignHtml(html: string): string {
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_ATTR, "")
    .replace(URL_ATTR, "")
    .replace(CSS_IMPORT, "")
    .replace(CSS_URL, "none");
}

export function designFrameSrcDoc(html: string): string {
  const body = sanitizeDesignHtml(html);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; base-uri 'none'; form-action 'none'"></head><body>${body}</body></html>`;
}

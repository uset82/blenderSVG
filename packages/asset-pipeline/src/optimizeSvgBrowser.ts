import { optimize as optimizeWithSvgo } from "svgo/browser";
import { sanitizeSvg } from "./svgSafety.js";

/** Browser-safe SVGO pass used by the standalone canvas. */
export function optimizeSvgForBrowser(svg: string): string {
  const sanitized = sanitizeSvg(svg);
  const optimized = optimizeWithSvgo(sanitized, {
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { cleanupIds: false, collapseGroups: false } }
      }
    ]
  }).data;
  const compacted = optimized.replace(/>\s+</g, "><").trim();

  return ensureResponsiveViewBox(sanitizeSvg(compacted));
}

function ensureResponsiveViewBox(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (match, attrs: string) => {
    if (/\sviewBox=/i.test(attrs)) {
      return `<svg${attrs.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")}>`;
    }
    const widthMatch = attrs.match(/\swidth=["']?([\d.]+)["']?/i);
    const heightMatch = attrs.match(/\sheight=["']?([\d.]+)["']?/i);
    if (widthMatch && heightMatch) {
      const cleanAttrs = attrs.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<svg${cleanAttrs} viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}">`;
    }
    return match;
  });
}

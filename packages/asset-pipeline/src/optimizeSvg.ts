import { optimize as optimizeWithSvgo } from "svgo";

export function optimizeSvg(svg: string): string {
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

  return removeRootDimensionsWhenViewBoxExists(sanitizeSvg(compacted));
}

/** Remove executable or externally loaded content before an SVG enters the Webview. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\s(?:on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"(?!#[^"]*")[^"]*"|'(?!#[^']*')[^']*'|[^\s>"']+)/gi, "")
    .replace(/url\s*\(\s*(?:https?:|data:)/gi, "url(");
}

function removeRootDimensionsWhenViewBoxExists(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (svgTag) => {
    if (!/\sviewBox=(?:"[^"]*"|'[^']*')/i.test(svgTag)) {
      return svgTag;
    }

    return svgTag.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  });
}

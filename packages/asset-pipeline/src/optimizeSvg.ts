export function optimizeSvg(svg: string): string {
  const withoutDeclarations = sanitizeSvg(svg)
    .replace(/<\?xml[\s\S]*?\?>\s*/gi, "")
    .replace(/<!doctype[\s\S]*?>\s*/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const compacted = withoutDeclarations
    .replace(/<[^>]+>/g, normalizeTagWhitespace)
    .replace(/>\s+</g, "><")
    .trim();

  return removeRootDimensionsWhenViewBoxExists(compacted);
}

/** Remove executable or externally loaded content before an SVG enters the Webview. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\s(?:on[a-z]+|href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/url\s*\(\s*(?:https?:|data:)/gi, "url(");
}

function normalizeTagWhitespace(tag: string): string {
  let normalized = "";
  let quote: '"' | "'" | undefined;
  let pendingSpace = false;

  for (const character of tag) {
    if (quote) {
      normalized += character;
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      if (pendingSpace) {
        normalized += " ";
        pendingSpace = false;
      }
      normalized += character;
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && character !== ">" && character !== "/") {
      normalized += " ";
    }
    pendingSpace = false;
    normalized += character;
  }

  return normalized;
}

function removeRootDimensionsWhenViewBoxExists(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/i, (svgTag) => {
    if (!/\sviewBox=(?:"[^"]*"|'[^']*')/i.test(svgTag)) {
      return svgTag;
    }

    return svgTag.replace(/\s(?:width|height)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  });
}

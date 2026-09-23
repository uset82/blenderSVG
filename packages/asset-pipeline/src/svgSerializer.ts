import type {
  LinearGradientPaint,
  RadialGradientPaint,
  StrokeStyle,
  VectorDocument,
  VectorGroup,
  VectorNode,
  VectorPaint,
  VectorPath
} from "./svgIr.js";

export function serializeDocumentToSvg(doc: VectorDocument): string {
  const { viewBox, defs, root } = doc;
  const vbStr = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  const defsKeys = Object.keys(defs);
  let defsMarkup = "";
  if (defsKeys.length > 0) {
    const gradientEntries = defsKeys
      .map((key) => {
        const item = defs[key];
        if (!item) return "";
        return item.type === "linearGradient"
          ? serializeLinearGradient(item)
          : serializeRadialGradient(item);
      })
      .filter(Boolean)
      .join("\n    ");

    defsMarkup = `\n  <defs>\n    ${gradientEntries}\n  </defs>`;
  }

  const rootContent = serializeChildren(root.children, "  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbStr}">${defsMarkup}\n${rootContent}\n</svg>`;
}

function serializeChildren(children: VectorNode[], indent: string): string {
  return children
    .map((child) => {
      if (child.kind === "group") {
        return serializeGroup(child, indent);
      }
      return serializePath(child, indent);
    })
    .join("\n");
}

function serializeGroup(group: VectorGroup, indent: string): string {
  const attrs: string[] = [];
  if (group.id) attrs.push(`id="${escapeXml(group.id)}"`);
  if (group.transform) attrs.push(`transform="${escapeXml(group.transform)}"`);
  if (group.opacity !== undefined) attrs.push(`opacity="${group.opacity}"`);

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
  const childrenStr = serializeChildren(group.children, indent + "  ");

  return `${indent}<g${attrStr}>\n${childrenStr}\n${indent}</g>`;
}

function serializePath(pathNode: VectorPath, indent: string): string {
  const attrs: string[] = [];
  if (pathNode.id) attrs.push(`id="${escapeXml(pathNode.id)}"`);
  attrs.push(`d="${escapeXml(pathNode.d)}"`);

  // Fill
  if (pathNode.fill) {
    attrs.push(serializePaintAttr("fill", pathNode.fill));
  } else {
    attrs.push('fill="none"');
  }

  // Stroke
  if (pathNode.stroke) {
    attrs.push(...serializeStrokeAttrs(pathNode.stroke));
  }

  if (pathNode.transform) attrs.push(`transform="${escapeXml(pathNode.transform)}"`);
  if (pathNode.opacity !== undefined) attrs.push(`opacity="${pathNode.opacity}"`);

  return `${indent}<path ${attrs.join(" ")}/>`;
}

function serializePaintAttr(attrName: string, paint: VectorPaint): string {
  if (paint.type === "solid") {
    let out = `${attrName}="${escapeXml(paint.color)}"`;
    if (paint.opacity !== undefined) out += ` ${attrName}-opacity="${paint.opacity}"`;
    return out;
  }
  return `${attrName}="url(#${escapeXml(paint.id)})"`;
}

function serializeStrokeAttrs(stroke: StrokeStyle): string[] {
  const attrs: string[] = [];
  if (stroke.color) attrs.push(`stroke="${escapeXml(stroke.color)}"`);
  if (stroke.width !== undefined) attrs.push(`stroke-width="${stroke.width}"`);
  if (stroke.linecap) attrs.push(`stroke-linecap="${stroke.linecap}"`);
  if (stroke.linejoin) attrs.push(`stroke-linejoin="${stroke.linejoin}"`);
  if (stroke.opacity !== undefined) attrs.push(`stroke-opacity="${stroke.opacity}"`);
  return attrs;
}

function serializeLinearGradient(grad: LinearGradientPaint): string {
  const stops = grad.stops
    .map((s) => {
      let stopAttr = `offset="${s.offset}" stop-color="${escapeXml(s.color)}"`;
      if (s.opacity !== undefined) stopAttr += ` stop-opacity="${s.opacity}"`;
      return `<stop ${stopAttr}/>`;
    })
    .join("");

  return `<linearGradient id="${escapeXml(grad.id)}" x1="${grad.x1}" y1="${grad.y1}" x2="${grad.x2}" y2="${grad.y2}">${stops}</linearGradient>`;
}

function serializeRadialGradient(grad: RadialGradientPaint): string {
  const stops = grad.stops
    .map((s) => {
      let stopAttr = `offset="${s.offset}" stop-color="${escapeXml(s.color)}"`;
      if (s.opacity !== undefined) stopAttr += ` stop-opacity="${s.opacity}"`;
      return `<stop ${stopAttr}/>`;
    })
    .join("");

  return `<radialGradient id="${escapeXml(grad.id)}" cx="${grad.cx}" cy="${grad.cy}" r="${grad.r}">${stops}</radialGradient>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

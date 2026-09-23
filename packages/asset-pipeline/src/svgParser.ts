import { XMLParser } from "fast-xml-parser";
import type {
  ColorStop,
  LinearGradientPaint,
  RadialGradientPaint,
  StrokeStyle,
  VectorDocument,
  VectorGroup,
  VectorNode,
  VectorPaint,
  VectorPath,
  ViewBox
} from "./svgIr.js";

export function parseSvgToDocument(svgText: string): VectorDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true
  });

  const parsed = parser.parse(svgText);
  const svgNode = parsed.svg ?? parsed["svg:svg"];
  if (!svgNode) {
    throw new Error("Invalid SVG: Root <svg> element not found.");
  }

  // 1. ViewBox
  const viewBoxAttr = svgNode["@_viewBox"] ?? svgNode["@_viewbox"];
  let viewBox: ViewBox = { minX: 0, minY: 0, width: 100, height: 100 };

  if (viewBoxAttr) {
    const parts = String(viewBoxAttr)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      viewBox = {
        minX: parts[0] ?? 0,
        minY: parts[1] ?? 0,
        width: parts[2] ?? 100,
        height: parts[3] ?? 100
      };
    }
  } else {
    const width = parseFloat(svgNode["@_width"] ?? "100") || 100;
    const height = parseFloat(svgNode["@_height"] ?? "100") || 100;
    viewBox = { minX: 0, minY: 0, width, height };
  }

  // 2. Defs / Gradients
  const defs: Record<string, LinearGradientPaint | RadialGradientPaint> = {};
  const defsNode = svgNode.defs;
  if (defsNode) {
    parseDefs(defsNode, defs);
  }

  // 3. Children -> Root Group
  const rootChildren: VectorNode[] = [];
  parseContainerChildren(svgNode, rootChildren, defs);

  const root: VectorGroup = {
    kind: "group",
    id: svgNode["@_id"] ?? "root",
    children: rootChildren
  };

  return {
    viewBox,
    defs,
    root
  };
}

function parseDefs(defsNode: any, defs: Record<string, LinearGradientPaint | RadialGradientPaint>): void {
  // Linear gradients
  const linearGradients = wrapArray(defsNode.linearGradient);
  for (const lg of linearGradients) {
    const id = lg["@_id"];
    if (!id) continue;
    const stops: ColorStop[] = wrapArray(lg.stop).map((s) => ({
      offset: parseFloat(s["@_offset"] ?? "0") || 0,
      color: s["@_stop-color"] ?? "#000000",
      ...(s["@_stop-opacity"] ? { opacity: parseFloat(s["@_stop-opacity"]) } : {})
    }));
    defs[id] = {
      type: "linearGradient",
      id,
      x1: parseFloat(lg["@_x1"] ?? "0") || 0,
      y1: parseFloat(lg["@_y1"] ?? "0") || 0,
      x2: parseFloat(lg["@_x2"] ?? "1") || 1,
      y2: parseFloat(lg["@_y2"] ?? "0") || 0,
      stops
    };
  }

  // Radial gradients
  const radialGradients = wrapArray(defsNode.radialGradient);
  for (const rg of radialGradients) {
    const id = rg["@_id"];
    if (!id) continue;
    const stops: ColorStop[] = wrapArray(rg.stop).map((s) => ({
      offset: parseFloat(s["@_offset"] ?? "0") || 0,
      color: s["@_stop-color"] ?? "#000000",
      ...(s["@_stop-opacity"] ? { opacity: parseFloat(s["@_stop-opacity"]) } : {})
    }));
    defs[id] = {
      type: "radialGradient",
      id,
      cx: parseFloat(rg["@_cx"] ?? "0.5") || 0.5,
      cy: parseFloat(rg["@_cy"] ?? "0.5") || 0.5,
      r: parseFloat(rg["@_r"] ?? "0.5") || 0.5,
      stops
    };
  }
}

function parseContainerChildren(
  containerNode: any,
  outChildren: VectorNode[],
  defs: Record<string, LinearGradientPaint | RadialGradientPaint>
): void {
  // Process Groups <g>
  const groups = wrapArray(containerNode.g);
  for (const g of groups) {
    const groupChildren: VectorNode[] = [];
    parseContainerChildren(g, groupChildren, defs);
    const vectorGroup: VectorGroup = {
      kind: "group",
      id: g["@_id"] ?? `g-${outChildren.length + 1}`,
      ...(g["@_transform"] ? { transform: g["@_transform"] } : {}),
      ...(g["@_opacity"] ? { opacity: parseFloat(g["@_opacity"]) } : {}),
      children: groupChildren
    };
    outChildren.push(vectorGroup);
  }

  // Process Paths <path>
  const paths = wrapArray(containerNode.path);
  for (const p of paths) {
    const d = p["@_d"] ?? "";
    if (!d) continue;

    const fill = parsePaint(p["@_fill"], p["@_fill-opacity"], defs);
    const stroke = parseStroke(p);

    const vectorPath: VectorPath = {
      kind: "path",
      id: p["@_id"] ?? `path-${outChildren.length + 1}`,
      d,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
      ...(p["@_transform"] ? { transform: p["@_transform"] } : {}),
      ...(p["@_opacity"] ? { opacity: parseFloat(p["@_opacity"]) } : {})
    };
    outChildren.push(vectorPath);
  }

  // Process Primitives: <circle>
  const circles = wrapArray(containerNode.circle);
  for (const c of circles) {
    const cx = parseFloat(c["@_cx"] ?? "0") || 0;
    const cy = parseFloat(c["@_cy"] ?? "0") || 0;
    const r = parseFloat(c["@_r"] ?? "0") || 0;
    // Approximated path for circle
    const d = `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0 Z`;
    const fill = parsePaint(c["@_fill"], c["@_fill-opacity"], defs);
    const stroke = parseStroke(c);

    outChildren.push({
      kind: "path",
      id: c["@_id"] ?? `circle-${outChildren.length + 1}`,
      d,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {})
    });
  }

  // Process Primitives: <rect>
  const rects = wrapArray(containerNode.rect);
  for (const r of rects) {
    const x = parseFloat(r["@_x"] ?? "0") || 0;
    const y = parseFloat(r["@_y"] ?? "0") || 0;
    const w = parseFloat(r["@_width"] ?? "0") || 0;
    const h = parseFloat(r["@_height"] ?? "0") || 0;
    const d = `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    const fill = parsePaint(r["@_fill"], r["@_fill-opacity"], defs);
    const stroke = parseStroke(r);

    outChildren.push({
      kind: "path",
      id: r["@_id"] ?? `rect-${outChildren.length + 1}`,
      d,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {})
    });
  }
}

function parsePaint(
  fillAttr: string | undefined,
  opacityAttr: string | undefined,
  defs: Record<string, LinearGradientPaint | RadialGradientPaint>
): VectorPaint | undefined {
  if (!fillAttr || fillAttr === "none") return undefined;

  // Check for url(#id)
  const urlMatch = fillAttr.match(/url\(#([^)]+)\)/);
  if (urlMatch && urlMatch[1]) {
    const def = defs[urlMatch[1]];
    if (def) return def;
  }

  return {
    type: "solid",
    color: fillAttr,
    ...(opacityAttr ? { opacity: parseFloat(opacityAttr) } : {})
  };
}

function parseStroke(node: any): StrokeStyle | undefined {
  const strokeColor = node["@_stroke"];
  if (!strokeColor || strokeColor === "none") return undefined;

  return {
    color: strokeColor,
    ...(node["@_stroke-width"] ? { width: parseFloat(node["@_stroke-width"]) } : {}),
    ...(node["@_stroke-linecap"] ? { linecap: node["@_stroke-linecap"] } : {}),
    ...(node["@_stroke-linejoin"] ? { linejoin: node["@_stroke-linejoin"] } : {}),
    ...(node["@_stroke-opacity"] ? { opacity: parseFloat(node["@_stroke-opacity"]) } : {})
  };
}

function wrapArray<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

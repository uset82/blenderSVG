import { parseSvgToDocument } from "./svgParser.js";
import type { VectorDocument, VectorNode } from "./svgIr.js";

export interface BlenderCapabilityReport {
  totalPaths: number;
  totalGroups: number;
  solidFills: number;
  gradientFills: number;
  strokes: number;
  hasTransforms: boolean;
  recommendedAdapter: "curve" | "grease_pencil" | "dual";
  curveCompatibility: {
    score: number; // 0 to 100
    preservesGeometry: boolean;
    dropsFills: boolean;
    dropsStrokes: boolean;
    summary: string;
  };
  greasePencilCompatibility: {
    score: number; // 0 to 100
    preservesFills: boolean;
    preservesStrokes: boolean;
    approximatesGradients: boolean;
    summary: string;
  };
  warnings: string[];
}

export function analyzeBlenderSvgCompatibility(input: string | VectorDocument): BlenderCapabilityReport {
  const doc = typeof input === "string" ? parseSvgToDocument(input) : input;

  let totalPaths = 0;
  let totalGroups = 0;
  let solidFills = 0;
  let gradientFills = 0;
  let strokes = 0;
  let hasTransforms = false;
  const warnings: string[] = [];

  function inspectNode(node: VectorNode) {
    if (node.transform) hasTransforms = true;

    if (node.kind === "group") {
      totalGroups++;
      for (const child of node.children) {
        inspectNode(child);
      }
    } else if (node.kind === "path") {
      totalPaths++;
      if (node.fill) {
        if (node.fill.type === "solid") {
          solidFills++;
        } else {
          gradientFills++;
        }
      }
      if (node.stroke) {
        strokes++;
      }
    }
  }

  for (const child of doc.root.children) {
    inspectNode(child);
  }

  // Evaluate Curve Adapter
  let curveScore = 100;
  if (solidFills > 0 || gradientFills > 0) {
    curveScore -= 40;
    warnings.push("Blender Curve importer ignores fill colors and gradients; geometry only will be extruded.");
  }
  if (strokes > 0) {
    curveScore -= 20;
    warnings.push("Blender Curve importer ignores stroke styling and line widths.");
  }

  // Evaluate Grease Pencil Adapter
  let gpScore = 95;
  if (gradientFills > 0) {
    gpScore -= 15;
    warnings.push("Blender Grease Pencil approximates SVG gradients as vertex color ramps or flat material fills.");
  }

  let recommendedAdapter: "curve" | "grease_pencil" | "dual" = "dual";
  if (solidFills === 0 && gradientFills === 0 && strokes > 0) {
    recommendedAdapter = "curve";
  } else if (solidFills > 0 || gradientFills > 0) {
    recommendedAdapter = "grease_pencil";
  }

  return {
    totalPaths,
    totalGroups,
    solidFills,
    gradientFills,
    strokes,
    hasTransforms,
    recommendedAdapter,
    curveCompatibility: {
      score: Math.max(0, curveScore),
      preservesGeometry: true,
      dropsFills: solidFills > 0 || gradientFills > 0,
      dropsStrokes: strokes > 0,
      summary:
        curveScore >= 80 ? "Excellent for 3D extrusion/modeling" : "Lossy for colored illustration (geometry only)"
    },
    greasePencilCompatibility: {
      score: Math.max(0, gpScore),
      preservesFills: true,
      preservesStrokes: true,
      approximatesGradients: gradientFills > 0,
      summary: "Preserves fills and strokes as native Blender Grease Pencil illustration"
    },
    warnings
  };
}

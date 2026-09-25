import type { Options as VtracerOptions } from "@visioncortex/vtracer";

export type VectorPresetId = "color-illustration" | "clean-icon" | "silhouette" | "pixel-art";
export type VectorPathMode = "spline" | "polygon" | "pixel";
export type VectorLayering = "stacked" | "cutout";

export interface VectorTraceSettings {
  mode: VectorPathMode;
  hierarchical: VectorLayering;
  colorPrecision: number;
  layerDifference: number;
  filterSpeckle: number;
  cornerThreshold: number;
  lengthThreshold: number;
  spliceThreshold: number;
}

export interface VtracerPresetOptions extends VectorTraceSettings {
  label: string;
  preset: "poster" | "bw";
  clustering: "color-cluster" | "bw";
}

export const VECTOR_PRESETS: Record<VectorPresetId, VtracerPresetOptions> = {
  "color-illustration": {
    label: "Color illustration",
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45
  },
  "clean-icon": {
    label: "Clean icon",
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 8,
    colorPrecision: 5,
    layerDifference: 12,
    cornerThreshold: 72,
    lengthThreshold: 5,
    spliceThreshold: 45
  },
  silhouette: {
    label: "Silhouette",
    mode: "spline",
    preset: "bw",
    clustering: "bw",
    hierarchical: "cutout",
    filterSpeckle: 4,
    colorPrecision: 2,
    layerDifference: 8,
    cornerThreshold: 60,
    lengthThreshold: 4,
    spliceThreshold: 45
  },
  "pixel-art": {
    label: "Pixel art",
    mode: "pixel",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 1,
    colorPrecision: 8,
    layerDifference: 16,
    cornerThreshold: 45,
    lengthThreshold: 6,
    spliceThreshold: 45
  }
};

export function vtracerPreset(id: VectorPresetId): VtracerPresetOptions {
  return VECTOR_PRESETS[id];
}

/** Keep the browser worker on the same local VTracer engine and preset contract as the host pipeline. */
export function workerVtracerOptions(
  id: VectorPresetId,
  overrides: VectorTraceSettings = VECTOR_PRESETS[id]
): VtracerOptions {
  const preset = VECTOR_PRESETS[id];
  const mode = overrides.mode;
  return {
    mode,
    preset: preset.preset,
    clustering: preset.clustering,
    hierarchical: overrides.hierarchical,
    filterSpeckle: boundedInteger(overrides.filterSpeckle, 0, 64, preset.filterSpeckle),
    colorPrecision: boundedInteger(overrides.colorPrecision, 1, 10, preset.colorPrecision),
    layerDifference: boundedInteger(overrides.layerDifference, 0, 255, preset.layerDifference),
    cornerThreshold: boundedInteger(overrides.cornerThreshold, 0, 180, preset.cornerThreshold),
    lengthThreshold: boundedNumber(overrides.lengthThreshold, 0, 20, preset.lengthThreshold),
    spliceThreshold: boundedInteger(overrides.spliceThreshold, 0, 180, preset.spliceThreshold),
    pathPrecision: 2,
    maxColors: preset.clustering === "bw" ? 2 : 16,
    ...(mode === "pixel" ? {} : { simplify: 1 })
  };
}

function boundedInteger(value: number, min: number, max: number, fallback: number): number {
  return Math.round(boundedNumber(value, min, max, fallback));
}

function boundedNumber(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function workerRasterPrepOptions(id: VectorPresetId): {
  quantizationLevels: number;
  removeNearWhiteBackground: true;
  noiseReduction: number;
} {
  return {
    quantizationLevels: id === "silhouette" ? 2 : id === "pixel-art" ? 8 : 6,
    removeNearWhiteBackground: true,
    noiseReduction: id === "pixel-art" ? 0 : id === "clean-icon" ? 18 : 10
  };
}

export function svgPathCount(svg: string): number {
  return svg.match(/<path\b/gi)?.length ?? 0;
}

export function assertSvgPathCount(svg: string, maxPaths = 20_000): number {
  const count = svgPathCount(svg);
  if (count > maxPaths) throw new Error(`The trace has ${count} paths, above the ${maxPaths} path limit.`);
  return count;
}

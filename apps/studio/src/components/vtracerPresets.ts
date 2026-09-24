export type VectorPresetId = "color-illustration" | "clean-icon" | "silhouette" | "pixel-art";
export type VectorPathMode = "spline" | "polygon" | "pixel";
export type VectorLayering = "stacked" | "cutout";

export interface VtracerPresetOptions {
  label: string;
  mode: VectorPathMode;
  preset: "poster" | "bw";
  clustering: "color-cluster" | "bw";
  hierarchical: VectorLayering;
  filterSpeckle: number;
  colorPrecision: number;
}

export const VECTOR_PRESETS: Record<VectorPresetId, VtracerPresetOptions> = {
  "color-illustration": {
    label: "Color illustration",
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 4,
    colorPrecision: 6
  },
  "clean-icon": {
    label: "Clean icon",
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 8,
    colorPrecision: 5
  },
  silhouette: {
    label: "Silhouette",
    mode: "spline",
    preset: "bw",
    clustering: "bw",
    hierarchical: "cutout",
    filterSpeckle: 4,
    colorPrecision: 2
  },
  "pixel-art": {
    label: "Pixel art",
    mode: "pixel",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 1,
    colorPrecision: 8
  }
};

export function vtracerPreset(id: VectorPresetId): VtracerPresetOptions {
  return VECTOR_PRESETS[id];
}

/** ImageTracer options used by the browser preview. They follow the same preset fields. */
export function imageTracerOptions(id: VectorPresetId): {
  numberofcolors: number;
  pathomit: number;
  layering: 0 | 1;
  ltres: number;
  qtres: number;
} {
  const preset = VECTOR_PRESETS[id];
  return {
    numberofcolors: preset.clustering === "bw" ? 2 : Math.max(2, preset.colorPrecision * 2),
    pathomit: preset.filterSpeckle,
    layering: preset.hierarchical === "cutout" ? 1 : 0,
    ltres: preset.mode === "pixel" ? 8 : 1,
    qtres: preset.mode === "polygon" ? 8 : 1
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

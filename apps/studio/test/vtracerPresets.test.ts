import { describe, expect, it } from "vitest";
import {
  assertSvgPathCount,
  svgPathCount,
  vtracerPreset,
  workerRasterPrepOptions,
  workerVtracerOptions
} from "../src/components/vtracerPresets.js";

describe("vtracer presets", () => {
  it("maps the four local presets onto tracer fields", () => {
    expect(vtracerPreset("color-illustration")).toMatchObject({ mode: "spline", colorPrecision: 6, filterSpeckle: 4 });
    expect(vtracerPreset("clean-icon").filterSpeckle).toBe(8);
    expect(vtracerPreset("silhouette")).toMatchObject({ preset: "bw", clustering: "bw", hierarchical: "cutout" });
    expect(vtracerPreset("pixel-art").mode).toBe("pixel");
    expect(workerVtracerOptions("silhouette")).toMatchObject({ maxColors: 2, hierarchical: "cutout" });
    expect(workerVtracerOptions("pixel-art")).toMatchObject({ mode: "pixel", filterSpeckle: 1 });
    expect(workerVtracerOptions("pixel-art").lengthThreshold).toBeGreaterThan(
      workerVtracerOptions("color-illustration").lengthThreshold
    );
    expect(workerRasterPrepOptions("pixel-art").noiseReduction).toBe(0);
    expect(workerRasterPrepOptions("clean-icon").removeNearWhiteBackground).toBe(true);
    expect(svgPathCount('<svg><path d="M0 0"/><path d="M1 1"/></svg>')).toBe(2);
    expect(() => assertSvgPathCount("<svg><path d='M0'/><path d='M1'/></svg>", 1)).toThrow(/path limit/);
  });

  it("uses advanced settings and bounds invalid numeric input before it reaches VTracer", () => {
    const color = vtracerPreset("color-illustration");
    expect(
      workerVtracerOptions("color-illustration", {
        ...color,
        colorPrecision: 99,
        layerDifference: -2,
        filterSpeckle: Number.NaN,
        cornerThreshold: 200,
        lengthThreshold: Number.POSITIVE_INFINITY,
        spliceThreshold: 45.4
      })
    ).toMatchObject({
      colorPrecision: 10,
      layerDifference: 0,
      filterSpeckle: color.filterSpeckle,
      cornerThreshold: 180,
      lengthThreshold: color.lengthThreshold,
      spliceThreshold: 45
    });
  });
});

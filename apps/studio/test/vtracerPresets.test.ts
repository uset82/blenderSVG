import { describe, expect, it } from "vitest";
import {
  assertSvgPathCount,
  imageTracerOptions,
  svgPathCount,
  vtracerPreset
} from "../src/components/vtracerPresets.js";

describe("vtracer presets", () => {
  it("maps the four local presets onto tracer fields", () => {
    expect(vtracerPreset("color-illustration")).toMatchObject({ mode: "spline", colorPrecision: 6, filterSpeckle: 4 });
    expect(vtracerPreset("clean-icon").filterSpeckle).toBe(8);
    expect(vtracerPreset("silhouette")).toMatchObject({ preset: "bw", clustering: "bw", hierarchical: "cutout" });
    expect(vtracerPreset("pixel-art").mode).toBe("pixel");
    expect(imageTracerOptions("silhouette")).toMatchObject({ numberofcolors: 2, layering: 1 });
    expect(imageTracerOptions("pixel-art").ltres).toBe(8);
    expect(svgPathCount('<svg><path d="M0 0"/><path d="M1 1"/></svg>')).toBe(2);
    expect(() => assertSvgPathCount("<svg><path d='M0'/><path d='M1'/></svg>", 1)).toThrow(/path limit/);
  });
});

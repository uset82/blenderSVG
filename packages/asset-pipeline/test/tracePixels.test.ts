import { describe, expect, it } from "vitest";
import { traceImageBuffer, traceRgbaPixels } from "../src/tracePixels.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);

describe("local pixel tracing", () => {
  it("rejects images that are too large before tracing", () => {
    expect(() => traceRgbaPixels(new Uint8Array(16), 2001, 2000)).toThrow(/4 megapixels/);
  });

  it("rejects pixel buffers that do not match the image size", () => {
    expect(() => traceRgbaPixels(new Uint8Array(8), 2, 2)).toThrow(/do not match/);
  });

  it("traces encoded PNG bytes with VTracer and returns a sanitized SVG", () => {
    const svg = traceImageBuffer(tinyPng);
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toMatch(/<script|foreignObject|href=/i);
  });

  it("rejects empty or oversized encoded images before VTracer runs", () => {
    expect(() => traceImageBuffer(new Uint8Array())).toThrow(/non-empty image/);
    expect(() => traceImageBuffer(new Uint8Array(8_000_001))).toThrow(/8 MB/);
  });
});

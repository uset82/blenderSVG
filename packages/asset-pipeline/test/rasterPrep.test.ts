import assert from "node:assert/strict";
import { test } from "vitest";
import { fittedTraceSize, MAX_TRACE_PIXELS, prepareRasterPixels, quantizeChannel } from "../src/rasterPrep.js";

test("resize keeps aspect and caps the long edge at 1024", () => {
  assert.deepEqual(fittedTraceSize(2048, 1024), { width: 1024, height: 512 });
  assert.deepEqual(fittedTraceSize(800, 400), { width: 800, height: 400 });
  assert.throws(() => fittedTraceSize(0, 1), /positive integers/);
});

test("palette quantize snaps a channel onto the chosen step", () => {
  assert.equal(quantizeChannel(250, 2), 128);
  assert.equal(quantizeChannel(10, 16), 0);
});

test("near-white background removal clears only connected edge pixels", () => {
  const width = 5;
  const height = 5;
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels.set([255, 255, 255, 255], offset);
  }
  for (const [x, y] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [1, 3],
    [2, 3],
    [3, 3]
  ] as const) {
    pixels.set([32, 48, 64, 255], (y * width + x) * 4);
  }

  prepareRasterPixels(pixels, width, height, { quantizationLevels: 4, removeNearWhiteBackground: true });

  assert.equal(pixels[3], 0, "edge-connected white is transparent");
  assert.equal(pixels[(2 * width + 2) * 4 + 3], 255, "white enclosed by color stays opaque");
  assert.equal(pixels[(2 * width + 2) * 4], 192, "enclosed white still receives palette quantization");
});

test("raster preparation rejects inconsistent and over-limit pixel buffers", () => {
  assert.throws(() => prepareRasterPixels(new Uint8Array(4), 2, 1), /pixel data/);
  assert.throws(() => prepareRasterPixels(new Uint8Array(0), MAX_TRACE_PIXELS + 1, 1), /pixel data/);
});

test("noise reduction softens isolated color noise without changing alpha", () => {
  const pixels = new Uint8Array(3 * 3 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([0, 0, 0, 255], offset);
  pixels.set([255, 0, 0, 255], (1 * 3 + 1) * 4);

  prepareRasterPixels(pixels, 3, 3, {
    quantizationLevels: 32,
    removeNearWhiteBackground: false,
    noiseReduction: 50
  });

  assert.ok((pixels[(1 * 3 + 1) * 4] ?? 0) < 255);
  assert.equal(pixels[(1 * 3 + 1) * 4 + 3], 255);
});

import { convertBuffer, convertPixels } from "@visioncortex/vtracer";
import { prepareSvgPreview } from "./svgSafety.js";

const MAX_PIXELS = 4_000_000;
const MAX_ENCODED_BYTES = 8_000_000;

/** Trace RGBA pixels with the local vtracer engine. Nothing is uploaded. */
export function traceRgbaPixels(pixels: Uint8Array, width: number, height: number): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("The image size is not valid.");
  }
  if (width * height > MAX_PIXELS) {
    throw new Error("This image is too large to trace locally. Use an image up to 4 megapixels.");
  }
  if (pixels.byteLength !== width * height * 4) {
    throw new Error("The image pixels do not match the reported size.");
  }
  const svg = convertPixels(pixels, width, height, {
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 4,
    colorPrecision: 6,
    simplify: 1,
    pathPrecision: 2,
    maxColors: 16
  });
  if (!svg) throw new Error("Local tracing did not produce SVG.");
  return svg;
}

/** Trace an encoded local image with VTracer and sanitize its SVG output. */
export function traceImageBuffer(image: Uint8Array): string {
  if (image.byteLength === 0 || image.byteLength > MAX_ENCODED_BYTES) {
    throw new Error("Choose a non-empty image up to 8 MB to trace locally.");
  }
  const svg = convertBuffer(image, {
    mode: "spline",
    preset: "poster",
    clustering: "color-cluster",
    hierarchical: "stacked",
    filterSpeckle: 4,
    colorPrecision: 6,
    simplify: 1,
    pathPrecision: 2,
    maxColors: 16
  });
  if (!svg) throw new Error("Local tracing did not produce SVG.");
  const withoutPrelude = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  return prepareSvgPreview(withoutPrelude).svg;
}

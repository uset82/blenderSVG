export const MAX_TRACE_EDGE = 1024;
export const MAX_TRACE_PIXELS = 4_000_000;

export interface RasterPreparationOptions {
  quantizationLevels?: number;
  removeNearWhiteBackground?: boolean;
  nearWhiteThreshold?: number;
  noiseReduction?: number;
}

export function fittedTraceSize(
  width: number,
  height: number,
  maxEdge = MAX_TRACE_EDGE
): { width: number; height: number } {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Image dimensions must be positive integers.");
  }
  if (!Number.isInteger(maxEdge) || maxEdge < 1) throw new Error("The trace size limit is not valid.");
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** Apply bounded cleanup in place before either local vectorizer runs. */
export function prepareRasterPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: RasterPreparationOptions = {}
): void {
  const pixelCount = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixelCount > MAX_TRACE_PIXELS ||
    pixels.byteLength !== pixelCount * 4
  ) {
    throw new Error("The image pixel data does not match a supported image size.");
  }

  const levels = options.quantizationLevels ?? 16;
  const threshold = options.nearWhiteThreshold ?? 248;
  const noiseReduction = options.noiseReduction ?? 0;
  if (!Number.isInteger(levels) || levels < 2 || levels > 32) {
    throw new Error("Palette quantization must use 2–32 levels.");
  }
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
    throw new Error("The background threshold must be an integer from 0 to 255.");
  }
  if (!Number.isInteger(noiseReduction) || noiseReduction < 0 || noiseReduction > 100) {
    throw new Error("Noise reduction must be an integer from 0 to 100.");
  }

  if (noiseReduction > 0) softenRasterPixels(pixels, width, height, noiseReduction / 100);
  if (options.removeNearWhiteBackground !== false) removeEdgeBackground(pixels, width, height, threshold);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) === 0) continue;
    pixels[offset] = quantizeChannel(pixels[offset] ?? 0, levels);
    pixels[offset + 1] = quantizeChannel(pixels[offset + 1] ?? 0, levels);
    pixels[offset + 2] = quantizeChannel(pixels[offset + 2] ?? 0, levels);
  }
}

export function quantizeChannel(value: number, levels: number): number {
  const step = 256 / levels;
  return Math.min(255, Math.floor(value / step) * step);
}

function removeEdgeBackground(pixels: Uint8Array, width: number, height: number, threshold: number): void {
  const pixelCount = width * height;
  const queued = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const addIfBackground = (index: number) => {
    if (queued[index] || !isNearWhite(pixels, index * 4, threshold)) return;
    queued[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    addIfBackground(x);
    addIfBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackground(y * width);
    addIfBackground(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    if (index === undefined) continue;
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    if (x > 0) addIfBackground(index - 1);
    if (x + 1 < width) addIfBackground(index + 1);
    if (index >= width) addIfBackground(index - width);
    if (index + width < pixelCount) addIfBackground(index + width);
  }
}

function isNearWhite(pixels: Uint8Array, offset: number, threshold: number): boolean {
  return (
    (pixels[offset + 3] ?? 0) >= 128 &&
    (pixels[offset] ?? 0) >= threshold &&
    (pixels[offset + 1] ?? 0) >= threshold &&
    (pixels[offset + 2] ?? 0) >= threshold
  );
}

function softenRasterPixels(pixels: Uint8Array, width: number, height: number, strength: number): void {
  if (width < 3 || height < 3) return;
  const source = new Uint8Array(pixels);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      if ((source[offset + 3] ?? 0) < 128) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        let total = (source[offset + channel] ?? 0) * 4;
        let weight = 4;
        for (const neighbor of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
          const neighborOffset = neighbor * 4;
          if ((source[neighborOffset + 3] ?? 0) < 128) continue;
          total += source[neighborOffset + channel] ?? 0;
          weight += 1;
        }
        const original = source[offset + channel] ?? 0;
        const softened = total / weight;
        pixels[offset + channel] = Math.round(original + (softened - original) * strength);
      }
    }
  }
}

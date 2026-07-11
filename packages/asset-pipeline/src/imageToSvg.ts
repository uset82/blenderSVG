import { mkdir, writeFile } from "node:fs/promises";
import ImageTracer from "imagetracerjs";
import Jimp from "jimp";
import { assertTraceableImageMetadata, readImageMetadata } from "./imageMetadata.js";
import { createManifestEntry } from "./manifestGenerator.js";
import { optimizeSvg } from "./optimizeSvg.js";
import { assertSupportedImagePath, createOutputPaths, getSvgExportDirectory } from "./paths.js";
import type {
  RasterPreprocessingOptions,
  VectorizeImageOptions,
  VectorizeImageResult,
  VectorizePreview
} from "./types.js";
import { validateSvgLayers } from "./validateSvgLayers.js";

const traceGuidance =
  "Image tracing is best for references, icons, and silhouettes. Redraw animated characters as clean named layers.";

export async function vectorizeImageToSvg(options: VectorizeImageOptions): Promise<VectorizeImageResult> {
  const preview = await previewImageToSvg(options);
  return savePreviewedImageToSvg(options, preview);
}

export async function previewImageToSvg(options: VectorizeImageOptions): Promise<VectorizePreview> {
  throwIfAborted(options.signal);
  assertSupportedImagePath(options.inputPath);
  assertTraceableImageMetadata(await readImageMetadata(options.inputPath));
  throwIfAborted(options.signal);

  const exportDirectory = getSvgExportDirectory(options.workspaceRoot, options.assetWorkspace);
  const { rawSvgPath, optimizedSvgPath, manifestPath } = createOutputPaths(options.inputPath, exportDirectory);

  const preprocessing = normalizePreprocessing(options);
  const rawSvg = await traceImage(options.inputPath, preprocessing, options.signal);
  throwIfAborted(options.signal);
  const optimizedSvg = optimizeSvg(rawSvg);
  const rawValidation = validateSvgLayers(rawSvg);
  const optimizedValidation = validateSvgLayers(optimizedSvg);
  const warnings = uniqueWarnings([
    traceGuidance,
    ...preprocessingWarnings(preprocessing),
    ...rawValidation.warnings,
    ...optimizedValidation.warnings
  ]);
  assertOutputLimits(optimizedSvg, optimizedValidation.pathCount, options);

  return {
    inputPath: options.inputPath,
    exportDirectory,
    rawSvgPath,
    optimizedSvgPath,
    manifestPath,
    rawSvg,
    optimizedSvg,
    warnings
  };
}

export async function savePreviewedImageToSvg(
  options: VectorizeImageOptions,
  preview: VectorizePreview
): Promise<VectorizeImageResult> {
  throwIfAborted(options.signal);
  await mkdir(preview.exportDirectory, { recursive: true });
  const manifest = createManifestEntry({
    inputPath: options.inputPath,
    workspaceRoot: options.workspaceRoot,
    rawSvgPath: preview.rawSvgPath,
    optimizedSvgPath: preview.optimizedSvgPath,
    warnings: preview.warnings
  });

  await Promise.all([
    writeFile(preview.rawSvgPath, preview.rawSvg, "utf8"),
    writeFile(preview.optimizedSvgPath, preview.optimizedSvg, "utf8"),
    writeFile(preview.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  ]);

  return {
    inputPath: preview.inputPath,
    exportDirectory: preview.exportDirectory,
    rawSvgPath: preview.rawSvgPath,
    optimizedSvgPath: preview.optimizedSvgPath,
    manifestPath: preview.manifestPath,
    warnings: preview.warnings
  };
}

function traceImage(
  inputPath: string,
  preprocessing: RasterPreprocessingOptions,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);
  return Jimp.read(inputPath)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to decode image locally for tracing: ${message}`);
    })
    .then((image) => {
      throwIfAborted(signal);
      applyPreprocessing(image, preprocessing);
      throwIfAborted(signal);

      try {
        const svg = ImageTracer.imagedataToSVG(
          {
            width: image.bitmap.width,
            height: image.bitmap.height,
            data: Uint8ClampedArray.from(image.bitmap.data)
          },
          createTraceOptions(preprocessing)
        );
        if (!svg) throw new Error("no SVG data was produced");
        return svg;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to trace image locally: ${message}`);
      }
    });
}

function normalizePreprocessing(options: VectorizeImageOptions): RasterPreprocessingOptions {
  const preprocessing = options.preprocessing ?? {};
  const threshold = preprocessing.threshold ?? options.threshold;
  if (threshold !== undefined && (!Number.isInteger(threshold) || threshold < 0 || threshold > 255)) {
    throw new Error("Preprocessing threshold must be an integer from 0 to 255.");
  }
  if (
    preprocessing.noiseReduction !== undefined &&
    (!Number.isInteger(preprocessing.noiseReduction) ||
      preprocessing.noiseReduction < 0 ||
      preprocessing.noiseReduction > 100)
  ) {
    throw new Error("Noise reduction must be an integer from 0 to 100.");
  }
  return { ...preprocessing, ...(threshold === undefined ? {} : { threshold }) };
}

function createTraceOptions(preprocessing: RasterPreprocessingOptions): ImageTracerOptions {
  const numberOfColors = preprocessing.grayscale === false ? (preprocessing.quantizationLevels ?? 16) : 2;
  return {
    colorsampling: 0,
    numberofcolors: numberOfColors,
    pathomit: Math.max(1, Math.ceil((preprocessing.noiseReduction ?? 0) / 10)),
    layering: 0,
    linefilter: false,
    roundcoords: 2,
    viewbox: true,
    strokewidth: 0
  };
}

function applyPreprocessing(image: JimpImage, preprocessing: RasterPreprocessingOptions): void {
  if (preprocessing.grayscale !== false) image.greyscale();
  if (preprocessing.threshold !== undefined) {
    image.threshold({ max: preprocessing.threshold, replace: 255, autoGreyscale: true });
  }
  if (preprocessing.noiseReduction !== undefined && preprocessing.noiseReduction > 0) {
    image.blur(Math.min(5, Math.max(1, Math.ceil(preprocessing.noiseReduction / 25))));
  }
  if (preprocessing.removeBackground !== false) removeNearWhiteBackground(image);
}

function removeNearWhiteBackground(image: JimpImage): void {
  const pixels = image.bitmap.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    if (red >= 248 && green >= 248 && blue >= 248) pixels[index + 3] = 0;
  }
}

function preprocessingWarnings(preprocessing: RasterPreprocessingOptions): string[] {
  const warnings: string[] = [];
  if (preprocessing.removeBackground === false) {
    warnings.push("Background removal is disabled; the source background and alpha values are retained.");
  }
  if (preprocessing.grayscale === false && preprocessing.quantizationLevels === undefined) {
    warnings.push("Color tracing uses a bounded 16-color palette; clean complex artwork into named layers manually.");
  }
  return warnings;
}

function assertOutputLimits(svg: string, pathCount: number, options: VectorizeImageOptions): void {
  const maxBytes = options.maxSvgBytes ?? 1_000_000;
  const maxPaths = options.maxSvgPaths ?? 20_000;
  if (svg.length > maxBytes) throw new Error(`Generated SVG exceeds the ${maxBytes}-byte safety limit.`);
  if (pathCount > maxPaths) throw new Error(`Generated SVG exceeds the ${maxPaths}-path complexity limit.`);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createAbortError();
}

function createAbortError(): Error {
  const error = new Error("Image vectorization was cancelled.");
  error.name = "AbortError";
  return error;
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

type JimpImage = {
  bitmap: { width: number; height: number; data: Buffer };
  greyscale(): JimpImage;
  threshold(options: { max: number; replace: number; autoGreyscale: boolean }): JimpImage;
  blur(radius: number): JimpImage;
};

type ImageTracerOptions = {
  colorsampling: number;
  numberofcolors: number;
  pathomit: number;
  layering: number;
  linefilter: boolean;
  roundcoords: number;
  viewbox: boolean;
  strokewidth: number;
};

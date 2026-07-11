import { mkdir, writeFile } from "node:fs/promises";
import { trace } from "potrace";
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
  const rawSvg = await traceImage(options.inputPath, createTraceOptions(preprocessing), options.signal);
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
  options: {
    threshold?: number;
    turdSize?: number;
    color: string;
    background: string;
  },
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      settled = true;
      reject(createAbortError());
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    trace(inputPath, options, (error, svg) => {
      signal?.removeEventListener("abort", abort);
      if (settled) return;
      settled = true;
      if (error) {
        reject(new Error(`Unable to trace image locally: ${error.message}`));
        return;
      }

      if (!svg) {
        reject(new Error("Unable to trace image locally: no SVG data was produced."));
        return;
      }

      resolve(svg);
    });
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

function createTraceOptions(preprocessing: RasterPreprocessingOptions): {
  threshold?: number;
  turdSize?: number;
  color: string;
  background: string;
} {
  return {
    ...(preprocessing.threshold === undefined ? {} : { threshold: preprocessing.threshold }),
    ...(preprocessing.noiseReduction === undefined ? {} : { turdSize: preprocessing.noiseReduction }),
    color: "#111827",
    background: preprocessing.removeBackground === false ? "#ffffff" : "transparent"
  };
}

function preprocessingWarnings(preprocessing: RasterPreprocessingOptions): string[] {
  const warnings: string[] = [];
  if (preprocessing.grayscale === false) {
    warnings.push("Potrace produces a monochrome SVG; color information is reduced to foreground/background.");
  }
  if (preprocessing.quantizationLevels && preprocessing.quantizationLevels > 2) {
    warnings.push(
      `Color quantization requested at ${preprocessing.quantizationLevels} levels; the local monochrome trace uses two output tones.`
    );
  }
  if (preprocessing.removeBackground === false) {
    warnings.push("Background removal is disabled; the traced background is retained as white.");
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

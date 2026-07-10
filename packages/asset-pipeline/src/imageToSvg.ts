import { mkdir, writeFile } from "node:fs/promises";
import { trace } from "potrace";
import { assertTraceableImageMetadata, readImageMetadata } from "./imageMetadata.js";
import { createManifestEntry } from "./manifestGenerator.js";
import { optimizeSvg } from "./optimizeSvg.js";
import { assertSupportedImagePath, createOutputPaths, getSvgExportDirectory } from "./paths.js";
import type { VectorizeImageOptions, VectorizeImageResult } from "./types.js";
import { validateSvgLayers } from "./validateSvgLayers.js";

const traceGuidance =
  "Image tracing is best for references, icons, and silhouettes. Redraw animated characters as clean named layers.";

export async function vectorizeImageToSvg(options: VectorizeImageOptions): Promise<VectorizeImageResult> {
  assertSupportedImagePath(options.inputPath);
  assertTraceableImageMetadata(await readImageMetadata(options.inputPath));

  const exportDirectory = getSvgExportDirectory(options.workspaceRoot, options.assetWorkspace);
  const { rawSvgPath, optimizedSvgPath, manifestPath } = createOutputPaths(options.inputPath, exportDirectory);

  await mkdir(exportDirectory, { recursive: true });

  const traceOptions = {
    ...(options.threshold === undefined ? {} : { threshold: options.threshold }),
    color: "#111827",
    background: "transparent"
  };
  const rawSvg = await traceImage(options.inputPath, traceOptions);
  const optimizedSvg = optimizeSvg(rawSvg);
  const rawValidation = validateSvgLayers(rawSvg);
  const optimizedValidation = validateSvgLayers(optimizedSvg);
  const warnings = uniqueWarnings([traceGuidance, ...rawValidation.warnings, ...optimizedValidation.warnings]);
  const manifest = createManifestEntry({
    inputPath: options.inputPath,
    workspaceRoot: options.workspaceRoot,
    rawSvgPath,
    optimizedSvgPath,
    warnings
  });

  await Promise.all([
    writeFile(rawSvgPath, rawSvg, "utf8"),
    writeFile(optimizedSvgPath, optimizedSvg, "utf8"),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  ]);

  return {
    inputPath: options.inputPath,
    exportDirectory,
    rawSvgPath,
    optimizedSvgPath,
    manifestPath,
    warnings
  };
}

function traceImage(
  inputPath: string,
  options: { threshold?: number; color: string; background: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(inputPath, options, (error, svg) => {
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

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

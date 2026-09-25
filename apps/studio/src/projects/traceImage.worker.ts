import { prepareRasterPixels, type RasterPreparationOptions } from "@codex-avatar-studio/asset-pipeline/raster-prep";
import type { Options as VtracerOptions } from "@visioncortex/vtracer";
import { ensureWasm, vectorize_rgba } from "@visioncortex/vtracer/pkg/vtracer_wasm.js";

export interface TraceWorkerRequest {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  options: VtracerOptions;
  preprocessing: RasterPreparationOptions;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TraceWorkerRequest>) => void) | null;
  postMessage: (message: { ok: true; svg: string } | { ok: false; message: string }) => void;
};

scope.onmessage = async (event) => {
  try {
    const { pixels, width, height, options } = event.data;
    const rgba = Uint8Array.from(pixels);
    prepareRasterPixels(rgba, width, height, event.data.preprocessing);
    await ensureWasm();
    const svg = vectorize_rgba(rgba, width, height, options);
    if (!svg) {
      scope.postMessage({ ok: false, message: "Local tracing did not produce SVG." });
      return;
    }
    scope.postMessage({ ok: true, svg });
  } catch (error) {
    scope.postMessage({ ok: false, message: error instanceof Error ? error.message : "Local tracing failed." });
  }
};

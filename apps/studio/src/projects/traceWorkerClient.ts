import type { TraceWorkerRequest } from "./traceImage.worker.js";

export const TRACE_CANCELLED = "Image tracing was cancelled.";

export function tracePixelsInWorker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: TraceWorkerRequest["options"],
  preprocessing: TraceWorkerRequest["preprocessing"],
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) return Promise.reject(new Error(TRACE_CANCELLED));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4_000_000 ||
    pixels.byteLength !== width * height * 4
  ) {
    return Promise.reject(new Error("The image pixel data does not match a supported image size."));
  }
  const worker = new Worker(new URL("./traceImage.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, svg?: string) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      if (error) reject(error);
      else if (svg) resolve(svg);
      else reject(new Error("Local tracing did not produce SVG."));
    };
    const onAbort = () => finish(new Error(TRACE_CANCELLED));
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{ ok?: unknown; svg?: unknown; message?: unknown }>) => {
      if (event.data?.ok === true && typeof event.data.svg === "string" && event.data.svg.length > 0) {
        finish(undefined, event.data.svg);
        return;
      }
      finish(
        new Error(typeof event.data?.message === "string" ? event.data.message : "Local tracing did not produce SVG.")
      );
    };
    worker.onerror = () => finish(new Error("The tracing worker stopped."));
    const copy = new Uint8ClampedArray(pixels);
    worker.postMessage({ pixels: copy, width, height, options, preprocessing } satisfies TraceWorkerRequest, [
      copy.buffer
    ]);
  });
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { TRACE_CANCELLED, tracePixelsInWorker } from "../src/projects/traceWorkerClient.js";

const options = { mode: "spline" as const, preset: "poster" as const, clustering: "color-cluster" as const };
const preprocessing = { quantizationLevels: 6, removeNearWhiteBackground: true as const, noiseReduction: 10 };

afterEach(() => vi.unstubAllGlobals());

describe("trace worker client", () => {
  it("rejects an already cancelled trace before starting the worker", async () => {
    const signal = AbortSignal.abort();
    await expect(tracePixelsInWorker(new Uint8ClampedArray(4), 1, 1, options, preprocessing, signal)).rejects.toThrow(
      TRACE_CANCELLED
    );
  });

  it("copies bounded pixel input and terminates after receiving a VTracer result", async () => {
    const instances: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: (() => void) | null;
      posted: unknown;
      terminated: boolean;
    }> = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      posted: unknown;
      terminated = false;

      constructor() {
        instances.push(this);
      }

      postMessage(message: unknown) {
        this.posted = message;
        queueMicrotask(() => this.onmessage?.({ data: { ok: true, svg: '<svg viewBox="0 0 1 1"/>' } } as MessageEvent));
      }

      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);

    const svg = await tracePixelsInWorker(pixels, 1, 1, options, preprocessing);

    expect(svg).toContain("<svg");
    expect(instances[0]?.terminated).toBe(true);
    const postedPixels = (instances[0]?.posted as { pixels: Uint8ClampedArray } | undefined)?.pixels;
    expect(postedPixels).not.toBe(pixels);
    expect([...pixels]).toEqual([1, 2, 3, 255]);
  });

  it("terminates promptly when cancellation arrives during tracing", async () => {
    let worker: { onmessage: ((event: MessageEvent) => void) | null; onerror: (() => void) | null } | undefined;
    const terminate = vi.fn();
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        worker = this;
      }
      postMessage() {}
      terminate = terminate;
    }
    vi.stubGlobal("Worker", PendingWorker);
    const controller = new AbortController();
    const result = tracePixelsInWorker(new Uint8ClampedArray(4), 1, 1, options, preprocessing, controller.signal);

    controller.abort();

    await expect(result).rejects.toThrow(TRACE_CANCELLED);
    expect(worker).toBeDefined();
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects a dimension and pixel-count mismatch before starting a worker", async () => {
    const workerConstructor = vi.fn();
    vi.stubGlobal("Worker", workerConstructor);

    await expect(tracePixelsInWorker(new Uint8ClampedArray(4), 2, 1, options, preprocessing)).rejects.toThrow(
      /pixel data/
    );
    expect(workerConstructor).not.toHaveBeenCalled();
  });
});

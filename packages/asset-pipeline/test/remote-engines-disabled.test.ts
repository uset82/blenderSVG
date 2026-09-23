import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { generateSvgWithQuiver, previewImageToSvg, type VectorEngine } from "../src/index.js";

const disabledMessage = /Remote SVG generation is disabled/;

test("remote vector engines reject before reading an image or making a request", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  try {
    // "openrouter" and "zenmux" were removed from VectorEngine; older callers may still pass them.
    for (const engine of ["quiverai", "openrouter", "zenmux"] as unknown as VectorEngine[]) {
      await assert.rejects(
        () =>
          previewImageToSvg({
            inputPath: "nonexistent.png",
            workspaceRoot: "nonexistent",
            engine,
            quiverApiKey: "test-key"
          }),
        disabledMessage
      );
    }
    assert.equal(fetchSpy.mock.calls.length, 0);
  } finally {
    vi.unstubAllGlobals();
  }
});

test("the reserved QuiverAI entry point rejects without sending prompts or keys", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  try {
    await assert.rejects(
      () => generateSvgWithQuiver({ apiKey: "test-key", prompt: "private prompt" }),
      disabledMessage
    );
    assert.equal(fetchSpy.mock.calls.length, 0);
  } finally {
    vi.unstubAllGlobals();
  }
});

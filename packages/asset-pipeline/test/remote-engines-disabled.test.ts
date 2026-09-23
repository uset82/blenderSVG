import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  generateSvgWithOpenRouter,
  generateSvgWithQuiver,
  generateSvgWithZenMux,
  previewImageToSvg,
  vectorizeImageWithOpenRouterVision,
  vectorizeImageWithZenMuxVision
} from "../src/index.js";

const disabledMessage = /Remote SVG generation is disabled/;

test("remote vector engines reject before reading an image or making a request", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  try {
    for (const engine of ["openrouter", "quiverai"] as const) {
      await assert.rejects(
        () =>
          previewImageToSvg({
            inputPath: "nonexistent.png",
            workspaceRoot: "nonexistent",
            engine,
            openRouterApiKey: "test-key",
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

test("legacy provider functions reject without sending prompts, images, or keys", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  try {
    const attempts = [
      () => generateSvgWithOpenRouter({ apiKey: "test-key", prompt: "private prompt" }),
      () => vectorizeImageWithOpenRouterVision({ apiKey: "test-key", imageBase64: "private-image" }),
      () => generateSvgWithZenMux({ apiKey: "test-key", prompt: "private prompt" }),
      () => vectorizeImageWithZenMuxVision({ apiKey: "test-key", imageBase64: "private-image" }),
      () => generateSvgWithQuiver({ apiKey: "test-key", prompt: "private prompt" })
    ];
    for (const attempt of attempts) await assert.rejects(attempt, disabledMessage);
    assert.equal(fetchSpy.mock.calls.length, 0);
  } finally {
    vi.unstubAllGlobals();
  }
});

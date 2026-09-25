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

test("QuiverAI generation uses explicit host options, sanitizes SVG, and reports provider usage", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        data: [
          {
            svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="bad()"><script>bad()</script><path d="M0 0h10v10z"/></svg>'
          }
        ],
        usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const result = await generateSvgWithQuiver({
    apiKey: "test-key",
    model: "arrow-1.1",
    prompt: "private prompt",
    referenceImages: ["aGVsbG8="],
    fetcher
  });
  assert.equal(requestUrl, "https://api.quiver.ai/v1/svgs/generations");
  assert.deepEqual(requestBody, {
    model: "arrow-1.1",
    prompt: "private prompt",
    instructions:
      "Create one self-contained SVG. Return a clean, static graphic with no animation, scripts, stylesheets, external links, or embedded images.",
    n: 1,
    stream: false,
    references: [{ base64: "aGVsbG8=" }]
  });
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 34, totalTokens: 46 });
  assert.doesNotMatch(result.svg, /script|onload/i);
  assert.match(result.svg, /<path/);
});

test("QuiverAI prompt and image limits reject locally, and provider failures stay actionable", async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  await assert.rejects(
    () => generateSvgWithQuiver({ apiKey: "test-key", prompt: " ", fetcher: fetchSpy }),
    /prompt up to/
  );
  await assert.rejects(
    () => generateSvgWithQuiver({ apiKey: "test-key", prompt: "image", referenceImages: ["%%%"], fetcher: fetchSpy }),
    /reference image could not be read/
  );
  assert.equal(fetchSpy.mock.calls.length, 0);

  await assert.rejects(
    () =>
      generateSvgWithQuiver({
        apiKey: "test-key",
        prompt: "icon",
        fetcher: async () => new Response("{}", { status: 402 })
      }),
    /needs billing or credits/
  );
  await assert.rejects(
    () =>
      generateSvgWithQuiver({
        apiKey: "test-key",
        prompt: "icon",
        fetcher: async () =>
          new Response(
            JSON.stringify({ data: [{ svg: '<svg xmlns="http://www.w3.org/2000/svg"><animate/></svg>' }] }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
      }),
    /failed local safety checks/
  );
  await assert.rejects(
    () =>
      generateSvgWithQuiver({
        apiKey: "test-key",
        prompt: "icon",
        fetcher: async () =>
          new Response(
            JSON.stringify({
              data: [{ svg: `<svg xmlns="http://www.w3.org/2000/svg">${"x".repeat(1_000_001)}</svg>` }]
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          )
      }),
    /larger than the 1 MB safety limit/
  );
});

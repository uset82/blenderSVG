import assert from "node:assert/strict";
import { access, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { previewImageToSvg, savePreviewedImageToSvg, vectorizeImageToSvg } from "../src/index.js";

const traceablePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);

test("vectorizes an image into local raw SVG, optimized SVG, and manifest files", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-vectorize-"));
  const inputPath = path.join(workspaceRoot, "tiny-avatar.png");
  await writeFile(inputPath, traceablePng);

  const result = await vectorizeImageToSvg({
    inputPath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar"
  });

  const rawSvg = await readFile(result.rawSvgPath, "utf8");
  const optimizedSvg = await readFile(result.optimizedSvgPath, "utf8");
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

  assert.match(rawSvg, /<svg/i);
  assert.match(optimizedSvg, /<svg/i);
  assert.equal(manifest.source.type, "image-trace");
  assert.equal(manifest.outputs.rawSvg, ".codex-avatar/exports/svg/tiny-avatar.raw-trace.svg");
  assert.equal(manifest.outputs.optimizedSvg, ".codex-avatar/exports/svg/tiny-avatar.optimized.svg");
});

test("previews without writing, then saves after confirmation", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-preview-"));
  const inputPath = path.join(workspaceRoot, "preview.png");
  await writeFile(inputPath, traceablePng);
  const sourceBefore = await readFile(inputPath);

  const preview = await previewImageToSvg({
    inputPath,
    workspaceRoot,
    preprocessing: { grayscale: true, threshold: 128, quantizationLevels: 2, removeBackground: true }
  });
  await assert.rejects(() => access(preview.optimizedSvgPath));
  assert.match(preview.optimizedSvg, /<svg/i);

  const result = await savePreviewedImageToSvg({ inputPath, workspaceRoot }, preview);
  assert.equal((await stat(result.optimizedSvgPath)).isFile(), true);
  assert.deepEqual(await readFile(inputPath), sourceBefore);
});

test("cancels before tracing and rejects oversized source dimensions", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-cancel-"));
  const inputPath = path.join(workspaceRoot, "cancel.png");
  const controller = new AbortController();
  controller.abort();
  await writeFile(inputPath, traceablePng);
  await assert.rejects(
    () => previewImageToSvg({ inputPath, workspaceRoot, signal: controller.signal }),
    (error: unknown) => error instanceof Error && error.name === "AbortError"
  );

  const oversized = path.join(workspaceRoot, "oversized.png");
  const header = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(header, 0);
  header.writeUInt32BE(5000, 16);
  header.writeUInt32BE(5000, 20);
  await writeFile(oversized, header);
  await assert.rejects(() => previewImageToSvg({ inputPath: oversized, workspaceRoot }), /too large.*safely/);
});

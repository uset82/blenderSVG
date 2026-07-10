import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { vectorizeImageToSvg } from "../src/index.js";

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

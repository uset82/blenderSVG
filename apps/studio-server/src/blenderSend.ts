import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { writeLibraryAsset } from "@codex-avatar-studio/studio-host-core/assetStore";
import { createBlenderSceneFromSvg } from "@codex-avatar-studio/studio-host-core/blenderHandoff";
import type { BlenderCommandRunner } from "@codex-avatar-studio/studio-host-core/blenderRunner";
import { runBlenderExportJob } from "@codex-avatar-studio/studio-host-core/blenderRunner";
import { containedLibraryPath } from "@codex-avatar-studio/studio-host-core/studioLibrary";

const silentLog = { append() {}, appendLine() {} };

export type BlenderSendResult = {
  sent: true;
  sceneFile: string;
  pngAssetId: string;
  pngSrc: string;
  glbAssetId: string;
  glbSrc: string;
};

export async function sendSvgToBlender(options: {
  libraryRoot: string;
  svg: string;
  sourceName: string;
  blenderPath: string;
  extensionRoot: string;
  processRunner: BlenderCommandRunner;
}): Promise<BlenderSendResult> {
  const sanitized = sanitizeSvg(options.svg);
  if (!/<svg\b/i.test(sanitized)) throw new Error("Select a sanitized SVG before sending it to Blender.");
  const workspaceRoot = path.resolve(options.libraryRoot);
  const pictures = path.join(workspaceRoot, ".codex-avatar", "cache", "pictures");
  await mkdir(pictures, { recursive: true });
  const svgPath = path.join(pictures, `${randomUUID()}.svg`);
  await writeFile(svgPath, sanitized, "utf8");
  const handoff = await createBlenderSceneFromSvg({
    blenderPath: options.blenderPath,
    svgPath,
    sourceName: options.sourceName,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot: options.extensionRoot,
    outputChannel: silentLog,
    timeoutMs: 120_000,
    processRunner: options.processRunner
  });
  const exports = await runBlenderExportJob({
    blenderPath: options.blenderPath,
    blendPath: handoff.scenePath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot: options.extensionRoot,
    modes: ["glb", "png"],
    outputChannel: silentLog,
    timeoutMs: 120_000,
    processRunner: options.processRunner
  });
  const glb = exports.find((item) => item.status === "success" && item.mode === "glb");
  const png = exports.find((item) => item.status === "success" && item.mode === "png");
  if (!glb || glb.status !== "success" || !png || png.status !== "success") {
    throw new Error("Blender did not return both a GLB and a PNG. The source scene was not modified.");
  }
  const pngAssetId = randomUUID();
  const glbAssetId = randomUUID();
  await writeLibraryAsset(workspaceRoot, pngAssetId, "image/png", new Uint8Array(await readFile(png.outputPath)));
  const glbTarget = containedLibraryPath(workspaceRoot, path.join("assets", `${glbAssetId}.glb`));
  if (!glbTarget) throw new Error("The GLB asset path leaves the Studio library.");
  await mkdir(path.dirname(glbTarget), { recursive: true });
  await writeFile(glbTarget, await readFile(glb.outputPath));
  return {
    sent: true,
    sceneFile: path.basename(handoff.scenePath),
    pngAssetId,
    pngSrc: `/assets/${pngAssetId}`,
    glbAssetId,
    glbSrc: `/api/blender-asset/${glbAssetId}`
  };
}

const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readBlenderGlbAsset(libraryRoot: string, id: string): Promise<Uint8Array | null> {
  if (!ASSET_ID.test(id)) return null;
  const target = containedLibraryPath(libraryRoot, path.join("assets", `${id}.glb`));
  if (!target) return null;
  try {
    return new Uint8Array(await readFile(target));
  } catch {
    return null;
  }
}

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import {
  createBlenderExportPlans,
  isInsideDirectory,
  resolveBlenderScriptPath,
  sanitizeBlenderBaseName
} from "../dist/blenderPlan.js";
import { assertBlenderExportArtifacts, assertBlenderVersion, findBlenderExecutable } from "../dist/blenderRunner.js";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
const workspaceRoot = path.resolve(extensionRoot, "..", "..");

test("creates Blender dry-run export plans without starting Blender", () => {
  const blendPath = path.join(workspaceRoot, "fixtures", "Avatar Scene!.blend");
  const plan = createBlenderExportPlans({
    blendPath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["svg", "glb", "png"]
  });

  assert.ok(isInsideDirectory(workspaceRoot, plan.outputDirectory));
  assert.equal(plan.exports.length, 3);
  assert.deepEqual(
    plan.exports.map((item) => item.mode),
    ["svg", "glb", "png"]
  );

  const svgPlan = plan.exports[0];
  assert.equal(svgPlan.outputPath, path.join(plan.outputDirectory, "Avatar-Scene.line-art.svg"));
  assert.equal(svgPlan.manifestPath, path.join(plan.outputDirectory, "Avatar-Scene.svg.manifest.json"));
  assert.equal(svgPlan.scriptPath, path.resolve(workspaceRoot, "scripts", "blender", "export_svg.py"));
  assert.deepEqual(svgPlan.args, [
    "--background",
    "--python",
    svgPlan.scriptPath,
    "--",
    "--input",
    blendPath,
    "--output",
    svgPlan.outputPath,
    "--manifest",
    svgPlan.manifestPath
  ]);
});

test("rejects Blender export paths outside the workspace", () => {
  assert.throws(
    () =>
      createBlenderExportPlans({
        blendPath: path.join(workspaceRoot, "avatar.blend"),
        workspaceRoot,
        assetWorkspace: "..",
        extensionRoot,
        modes: ["svg"]
      }),
    /outside the workspace/
  );
});

test("sanitizes Blender output base names", () => {
  assert.equal(sanitizeBlenderBaseName("  Café Mascot / Final  "), "Cafe-Mascot-Final");
  assert.equal(sanitizeBlenderBaseName("????"), "scene");
});

test("prefers packaged Blender scripts when installed", () => {
  const extensionRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-extension-"));
  const blenderMediaPath = path.join(extensionRoot, "media", "blender");
  mkdirSync(blenderMediaPath, { recursive: true });
  writeFileSync(path.join(blenderMediaPath, "export_svg.py"), "# packaged test script\n", "utf8");

  assert.equal(resolveBlenderScriptPath(extensionRoot, "export_svg.py"), path.join(blenderMediaPath, "export_svg.py"));
});

test("checks Blender executable version through configured path", async () => {
  const outputChannel = createOutputChannelMock();
  const version = await assertBlenderVersion(process.execPath, outputChannel);

  assert.match(version, /^v\d+\./);
  assert.ok(outputChannel.lines.some((line) => line.includes(version)));
});

test("uses configured Blender path before probing system candidates", async () => {
  const outputChannel = createOutputChannelMock();
  const executable = await findBlenderExecutable(
    {
      blenderPath: process.execPath
    },
    outputChannel
  );

  assert.equal(executable, process.execPath);
});

test("requires Blender export output and manifest artifacts", async () => {
  const exportDirectory = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-blender-export-"));
  const outputPath = path.join(exportDirectory, "Avatar.webgl.glb");
  const manifestPath = path.join(exportDirectory, "Avatar.glb.manifest.json");
  writeFileSync(outputPath, "glb", "utf8");
  writeFileSync(manifestPath, "{}\n", "utf8");

  await assertBlenderExportArtifacts({ mode: "glb", outputPath, manifestPath });
  await assert.rejects(
    () =>
      assertBlenderExportArtifacts({
        mode: "svg",
        outputPath,
        manifestPath: path.join(exportDirectory, "missing.manifest.json")
      }),
    /export manifest/
  );
});

function createOutputChannelMock() {
  const lines = [];
  return {
    lines,
    append(value) {
      lines.push(value);
    },
    appendLine(value) {
      lines.push(value);
    }
  };
}

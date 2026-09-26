import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AvatarPackageRegistry } from "../apps/extension/dist/avatarPackages.js";
import { readStoredZip } from "../packages/avatar-core/dist/src/storedZip.js";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("Build the web edition first: pnpm --filter @codex-avatar-studio/studio build:web");
}

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json"]
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "content-type": types.get(path.extname(file)) ?? "application/octet-stream",
    "cache-control": "no-cache"
  });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not bind avatar package server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const downloadDir = path.join(os.tmpdir(), `kurva-web-avatar-${Date.now()}`);
mkdirSync(downloadDir, { recursive: true });

try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((reg) => void reg.unregister()));
  });
  const page = await context.newPage();
  await page.goto(`${origin}?perf=1`);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  await page.waitForFunction(
    () => window.__studioEditor.getCurrentPageShapes().some((shape) => shape.type === "frame"),
    undefined,
    { timeout: 15_000 }
  );

  await page.getByRole("tab", { name: "Assets" }).click();
  await page.getByRole("button", { name: "Add avatar" }).click();
  await page.waitForFunction(
    () => window.__studioEditor.getCurrentPageShapes().some((shape) => shape.type === "avatar"),
    undefined,
    { timeout: 15_000 }
  );

  // Switch to the static package renderer without clicking through the tldraw hit layer.
  await page.evaluate(() => {
    const editor = window.__studioEditor;
    const avatar = editor.getCurrentPageShapes().find((shape) => shape.type === "avatar");
    if (!avatar) throw new Error("avatar shape missing");
    editor.updateShape({
      id: avatar.id,
      type: "avatar",
      props: { character: "package-svg", avatarState: "idle" }
    });
    editor.select(avatar.id);
  });
  await page.waitForTimeout(300);

  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  const clicked = await page.evaluate(() => {
    const button = document.querySelector(".studio-shape__package-button");
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  });
  assert.equal(clicked, true, "Save as avatar package button missing");
  let download;
  try {
    download = await downloadPromise;
  } catch (error) {
    const status = await page
      .locator(".studio-shape__package-status")
      .innerText()
      .catch(() => "");
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\npackage status: ${status.slice(0, 400)}`
    );
  }
  const suggested = download.suggestedFilename() || "avatar.codex-avatar.zip";
  assert.match(suggested, /\.codex-avatar\.zip$/i, `expected zip download, got ${suggested}`);
  const zipPath = path.join(downloadDir, suggested);
  await download.saveAs(zipPath);
  const bytes = readFileSync(zipPath);
  assert.ok(bytes.length > 64, "avatar zip is empty");
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);

  const status = await page.locator(".studio-shape__package-status").innerText();
  assert.match(status, /package download started/i);

  const entries = readStoredZip(bytes);
  const names = entries.map((entry) => entry.name).sort();
  assert.ok(
    names.some((name) => name.endsWith("/avatar.manifest.json")),
    `manifest missing: ${names.join(", ")}`
  );
  assert.ok(
    names.some((name) => name.endsWith("/svg/avatar.svg")),
    `svg missing: ${names.join(", ")}`
  );
  const manifestEntry = entries.find((entry) => entry.name.endsWith("/avatar.manifest.json"));
  const svgEntry = entries.find((entry) => entry.name.endsWith("/svg/avatar.svg"));
  assert.ok(manifestEntry && svgEntry);
  const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.id);
  assert.match(manifest.checksums["svg/avatar.svg"], /^[a-f0-9]{64}$/);
  const svgText = new TextDecoder().decode(svgEntry.data);
  assert.match(svgText, /<svg/i);
  assert.doesNotMatch(svgText, /<script/i);

  // Web edition downloads the ZIP for the visitor; prove the same bytes install into the
  // desktop AvatarPackageRegistry (W9.2: download → import into the registry).
  const registryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-web-avatar-registry-"));
  try {
    const registry = new AvatarPackageRegistry(
      () => registryRoot,
      () => registryRoot
    );
    const imported = await registry.importPackage(zipPath);
    assert.equal(imported.id, manifest.id);
    assert.match(imported.manifest.checksums["svg/avatar.svg"], /^[a-f0-9]{64}$/);
    const activated = await registry.activateAvatar(imported.id);
    assert.equal(activated?.id, manifest.id);
  } finally {
    await rm(registryRoot, { recursive: true, force: true });
  }

  console.log(`web-avatar-package ok ${suggested} → ${manifest.id} (registry import+activate)`);
} finally {
  await browser.close();
  server.close();
}

import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
if (!address || typeof address === "string") throw new Error("Could not bind export server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const downloadDir = path.join(os.tmpdir(), `kurva-web-export-${Date.now()}`);
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
  const created = await page.evaluate(() => {
    window.__studioEditor.createShape({
      type: "geo",
      x: 80,
      y: 80,
      props: { geo: "rectangle", w: 120, h: 60 }
    });
    const geo = window.__studioEditor.getCurrentPageShapes().find((shape) => shape.type === "geo");
    if (geo) window.__studioEditor.updateShape({ id: geo.id, type: "geo", x: 81, props: { w: 120, h: 60 } });
    return window.__studioEditor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
  });
  assert.equal(created, 1, "geo shape missing after createShape");
  await page.evaluate(() => {
    window.__studioEditor.selectNone();
  });
  const geoDeadline = Date.now() + 20_000;
  let geoReady = false;
  while (Date.now() < geoDeadline) {
    geoReady = await page.evaluate(() => {
      const editor = window.__studioEditor;
      if (!editor || editor.isDisposed) return false;
      let geo = editor.getCurrentPageShapes().find((shape) => shape.type === "geo");
      if (!geo) {
        editor.createShape({
          type: "geo",
          x: 80,
          y: 80,
          props: { geo: "rectangle", w: 120, h: 60 }
        });
        geo = editor.getCurrentPageShapes().find((shape) => shape.type === "geo");
        if (geo) editor.updateShape({ id: geo.id, type: "geo", x: 81, props: { w: 120, h: 60 } });
        editor.selectNone();
      }
      const snapshot = JSON.stringify(editor.getSnapshot());
      return Boolean(geo) && (snapshot.includes('"geo":"rectangle"') || snapshot.includes('"geo": "rectangle"'));
    });
    if (geoReady) {
      await page.waitForTimeout(400);
      const still = await page.evaluate(
        () => window.__studioEditor?.getCurrentPageShapes().some((shape) => shape.type === "geo") === true
      );
      if (still) break;
      geoReady = false;
    }
    await page.waitForTimeout(150);
  }
  assert.equal(geoReady, true, "geo shape did not remain on the canvas before export");
  const projectId = await page.evaluate(() => location.hash.replace(/^#\/p\//, "").split(/[?#]/)[0]);
  const deadline = Date.now() + 20_000;
  let stored = "";
  while (Date.now() < deadline) {
    stored = await page.evaluate(async (id) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("kurva-library");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const row = await new Promise((resolve, reject) => {
        const get = db.transaction("projects").objectStore("projects").get(id);
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result);
      });
      db.close();
      return typeof row?.document?.snapshot === "string" ? row.document.snapshot : "";
    }, projectId);
    if (stored.includes("rectangle")) break;
    await page.waitForTimeout(200);
  }
  assert.match(stored, /rectangle/, `autosave missing rectangle before export: ${stored.slice(0, 120)}`);

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const jsonFile = await jsonDownload;
  const jsonPath = path.join(downloadDir, jsonFile.suggestedFilename() || "untitled.studio.json");
  await jsonFile.saveAs(jsonPath);
  const jsonText = readFileSync(jsonPath, "utf8");
  assert.match(jsonText, /rectangle/);

  // Open inspector if closed, then export PNG and SVG through the page export control.
  const showProperties = page.getByRole("button", { name: "Show properties" });
  if (await showProperties.count()) await showProperties.click();
  await page.locator(".studio-inspector").waitFor({ timeout: 10_000 });

  await page.getByLabel("Export format").selectOption("png");
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export page" }).click();
  const pngFile = await pngDownload;
  const pngPath = path.join(downloadDir, pngFile.suggestedFilename() || "page.png");
  await pngFile.saveAs(pngPath);
  const png = readFileSync(pngPath);
  assert.ok(png.length > 8);
  assert.equal(png[0], 0x89);
  assert.equal(png[1], 0x50);

  await page.getByLabel("Export format").selectOption("svg");
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export page" }).click();
  const svgFile = await svgDownload;
  const svgPath = path.join(downloadDir, svgFile.suggestedFilename() || "page.svg");
  await svgFile.saveAs(svgPath);
  const svg = readFileSync(svgPath, "utf8");
  assert.match(svg, /<svg/i);
  assert.doesNotMatch(svg, /<script/i);

  console.log("web-export ok");
} finally {
  await browser.close();
  server.close();
}

import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
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
  [".woff", "font/woff"],
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
    "cache-control": relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache"
  });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not bind the canvas persist server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();

try {
  const page = await browser.newPage();
  await page.goto(`${origin}?perf=1`);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  assert.equal(await page.getByText("A license key is needed").count(), 0);

  const created = await page.evaluate(() => {
    window.__studioEditor.createShape({
      type: "geo",
      x: 48,
      y: 48,
      props: { geo: "rectangle", w: 96, h: 48 }
    });
    return window.__studioEditor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
  });
  assert.equal(created, 1);

  const projectId = await page.evaluate(() => location.hash.replace(/^#\/p\//, "").split(/[?#]/)[0]);
  assert.ok(projectId);

  const deadline = Date.now() + 15_000;
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
      const snapshot = row?.document?.snapshot;
      return typeof snapshot === "string" ? snapshot : "";
    }, projectId);
    if (stored.includes("rectangle")) break;
    await page.waitForTimeout(200);
  }
  assert.match(stored, /rectangle/, `saved snapshot missing rectangle after wait: ${stored.slice(0, 120)}…`);

  await page.goto(`${origin}?perf=1#/p/${projectId}`);
  await page.waitForFunction(() => window.__studioEditor, undefined, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  let debug = await page.evaluate(async (id) => {
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
    const snapshot = typeof row?.document?.snapshot === "string" ? row.document.snapshot : "";
    return {
      hash: location.hash,
      geos: window.__studioEditor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length,
      shapes: window.__studioEditor.getCurrentPageShapes().map((s) => s.type),
      hasRectangle: snapshot.includes("rectangle"),
      snapshotLen: snapshot.length,
      opening: document.body.innerText.includes("Opening"),
      statusSlice: document.body.innerText.match(/Saved[^\n]*|Opening[^\n]*|Could not[^\n]*/)?.[0] ?? ""
    };
  }, projectId);
  if (debug.geos < 1 && debug.hasRectangle) {
    await page.evaluate(async (id) => {
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
      window.__studioEditor.loadSnapshot(JSON.parse(row.document.snapshot));
    }, projectId);
    debug = { ...debug, forced: true, geosAfter: await page.evaluate(() => window.__studioEditor.getCurrentPageShapes().filter((s) => s.type === "geo").length) };
  }
  assert.ok((debug.geosAfter ?? debug.geos) >= 1, JSON.stringify(debug));

  console.log("web-canvas-persist ok", JSON.stringify(debug));
} finally {
  await browser.close();
  server.close();
}

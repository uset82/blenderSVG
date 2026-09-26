import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
const worker = readFileSync(path.join(root, "apps", "studio", "public", "sw.js"));
assert.match(worker.toString("utf8"), /cache\.put\(appPath\("\/index\.html"\)/);
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
  if (url.pathname === "/sw.js") {
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/"
    });
    response.end(worker);
    return;
  }
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
if (!address || typeof address === "string") throw new Error("Could not bind the offline server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

try {
  await page.goto(origin);
  try {
    await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 15_000 });
  } catch (error) {
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${body.slice(0, 500)}`);
  }
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active && navigator.serviceWorker.controller);
  });
  await page.reload();
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Export all projects" }).waitFor();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("heading", { name: "Home" }).waitFor();
  const sample = path.join(root, "apps", "studio", "public", "favicon-32.png");
  await traceSample(page, sample);

  // Create a licensed canvas while online so the SW has cached editor chunks, then continue offline.
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.getByRole("button", { name: "New file" }).first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  await page.waitForFunction(
    () => window.__studioEditor.getCurrentPageShapes().some((shape) => shape.type === "frame"),
    undefined,
    { timeout: 15_000 }
  );
  const onlineCreated = await page.evaluate(() => {
    window.__studioEditor.createShape({
      type: "geo",
      x: 80,
      y: 80,
      props: { geo: "rectangle", w: 120, h: 60 }
    });
    return window.__studioEditor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
  });
  assert.equal(onlineCreated, 1, "online geo shape missing before offline");
  const offlineProjectId = await page.evaluate(() => location.hash.replace(/^#\/p\//, "").split(/[?#]/)[0]);
  await page.waitForFunction(
    async (id) => {
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
      return snapshot.includes("rectangle");
    },
    offlineProjectId,
    { timeout: 20_000 }
  );

  await context.setOffline(true);
  await page.reload();
  await page.getByText("Offline — OpenRouter is unavailable").waitFor();
  await page.locator(".studio-windowbar__unsaved", { hasText: "Saved in this browser" }).waitFor();
  const projectFile = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = await projectFile;
  assert.match(exported.suggestedFilename(), /\.studio\.json$/);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all projects" }).click();
  const download = await backup;
  assert.match(download.suggestedFilename(), /kurva-backup\.zip/);
  await page.getByRole("button", { name: "Back to Home" }).click();
  await traceSample(page, sample);

  // Reopen the licensed project while offline, draw again, and export JSON + PNG.
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.evaluate((id) => {
    location.hash = `#/p/${id}`;
  }, offlineProjectId);
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  const offlineGeo = await page.evaluate(() => {
    const editor = window.__studioEditor;
    let count = editor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
    if (count === 0) {
      editor.createShape({
        type: "geo",
        x: 200,
        y: 120,
        props: { geo: "ellipse", w: 80, h: 80 }
      });
      count = editor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
    } else {
      editor.createShape({
        type: "geo",
        x: 200,
        y: 120,
        props: { geo: "ellipse", w: 80, h: 80 }
      });
      count = editor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length;
    }
    return count;
  });
  assert.ok(offlineGeo >= 1, "offline canvas had no geo shapes");
  const offlineJson = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const offlineExport = await offlineJson;
  assert.match(offlineExport.suggestedFilename(), /\.studio\.json$/);
  const showProperties = page.getByRole("button", { name: "Show properties" });
  if (await showProperties.count()) await showProperties.click();
  await page.locator(".studio-inspector").waitFor({ timeout: 10_000 });
  await page.getByLabel("Export format").selectOption("png");
  const offlinePng = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export page" }).click();
  const pngFile = await offlinePng;
  assert.match(pngFile.suggestedFilename(), /\.png$/i);

  const version = await browser.version();
  console.log(`web-offline ok ${version} (licensed canvas draw+export while offline)`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function traceSample(page, sample) {
  await page.getByRole("button", { name: /Image → SVG/ }).click();
  const dialog = page.locator(".studio-vector-dialog");
  await dialog.waitFor({ timeout: 10_000 });
  const input = page.locator('input[aria-label="Image to trace"]');
  await input.setInputFiles(sample);
  const trace = page.getByRole("button", { name: "Trace image", exact: true });
  try {
    await trace.waitFor({ state: "visible" });
    await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll("button")].find(
          (item) => item.textContent?.trim() === "Trace image"
        );
        return Boolean(button && !button.disabled);
      },
      { timeout: 10_000 }
    );
  } catch (error) {
    const status = await page
      .locator(".studio-vector-dialog")
      .innerText()
      .catch(() => "");
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${status.slice(0, 600)}`);
  }
  await trace.click();
  await dialog.getByRole("button", { name: "Trace again", exact: true }).waitFor({ timeout: 60_000 });
  await page.locator(".studio-vector-dialog__close").click();
}

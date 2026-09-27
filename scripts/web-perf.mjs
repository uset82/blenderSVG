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
if (!address || typeof address === "string") throw new Error("Could not bind the web perf server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();

try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((reg) => void reg.unregister()));
  });
  const page = await context.newPage();
  const homeStarted = Date.now();
  await page.goto(`${origin}?perf=1`);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
  const homeMs = Date.now() - homeStarted;

  const editorStarted = Date.now();
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  await page.waitForFunction(
    () => window.__studioEditor.getCurrentPageShapes().some((shape) => shape.type === "frame"),
    undefined,
    { timeout: 15_000 }
  );
  const editorMs = Date.now() - editorStarted;

  const sample = await page.evaluate(async () => {
    const editor = window.__studioEditor;
    const shapes = [];
    for (let index = 0; index < 1000; index += 1) {
      shapes.push({
        type: "geo",
        x: (index % 40) * 48,
        y: Math.floor(index / 40) * 48,
        props: { geo: "rectangle", w: 36, h: 36 }
      });
    }
    editor.createShapes(shapes);
    const before = editor.getCurrentPageShapes().length;
    const measure = async (mode) => {
      const started = performance.now();
      let frames = 0;
      const originCamera = editor.getCamera();
      await new Promise((resolve) => {
        const step = (now) => {
          const camera = editor.getCamera();
          if (mode === "pan") editor.setCamera({ ...camera, x: camera.x + 12, y: camera.y + 6 });
          else if (mode === "zoom") editor.setCamera({ ...originCamera, z: 0.8 + (frames % 20) / 40 });
          frames += 1;
          if (now - started < 1000) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      editor.setCamera(originCamera);
      const elapsedMs = Math.round(performance.now() - started);
      return { frames, elapsedMs, fps: Math.round((frames * 1000) / Math.max(1, elapsedMs)) };
    };
    await measure("pan");
    await measure("zoom");
    const pan = await measure("pan");
    const zoom = await measure("zoom");
    return { shapes: before, pan, zoom, machine: navigator.userAgent };
  });

  console.log(`web-perf ${JSON.stringify({ homeMs, editorMs, ...sample })}`);
  assert.ok(sample.shapes >= 1000, `expected ≥1000 shapes, got ${sample.shapes}`);
  assert.ok(editorMs <= 8000, `editor interactive too slow: ${editorMs}ms (budget 8s local headroom; plan target 4s)`);
  assert.ok(sample.pan.fps >= 30, `pan fps too low: ${sample.pan.fps}`);
  assert.ok(sample.zoom.fps >= 30, `zoom fps too low: ${sample.zoom.fps}`);
  console.log(
    `web-perf ok home=${homeMs}ms editor=${editorMs}ms pan=${sample.pan.fps}fps zoom=${sample.zoom.fps}fps shapes=${sample.shapes}`
  );
} finally {
  await browser.close();
  server.close();
}

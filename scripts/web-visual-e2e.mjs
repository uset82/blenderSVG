import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
const outDir = path.join(root, ".codex-avatar", "previews", "web-edition");
if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("Build the web edition first: pnpm --filter @codex-avatar-studio/studio build:web");
}
mkdirSync(outDir, { recursive: true });

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
if (!address || typeof address === "string") throw new Error("Could not bind web visual server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const viewports = [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
  [768, 900],
  [390, 844]
];
const themes = ["light", "dark", "contrast"];
const captured = [];

try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((reg) => void reg.unregister()));
  });
  const page = await context.newPage();
  await page.goto(`${origin}?perf=1`);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const theme of themes) {
      await page.evaluate((next) => {
        if (typeof window.__studioSetTheme === "function") window.__studioSetTheme(next);
        else {
          document.querySelector(".studio-app")?.setAttribute("data-theme", next);
          try {
            localStorage.setItem("codex-avatar-studio-theme", next);
          } catch {
            // Theme still applies for this capture when storage is unavailable.
          }
        }
      }, theme);
      await page.waitForTimeout(150);
      const homeFile = path.join(outDir, `home-${theme}-${width}.png`);
      await page.screenshot({ path: homeFile, fullPage: false });
      captured.push(homeFile);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });
  assert.equal(await page.getByText("A license key is needed").count(), 0);

  for (const theme of themes) {
    await page.evaluate((next) => {
      if (typeof window.__studioSetTheme === "function") window.__studioSetTheme(next);
      else document.querySelector(".studio-app")?.setAttribute("data-theme", next);
    }, theme);
    await page.waitForTimeout(150);
    const editorFile = path.join(outDir, `editor-${theme}-1440.png`);
    await page.screenshot({ path: editorFile, fullPage: false });
    captured.push(editorFile);
  }

  const manifest = {
    origin,
    trialLicense: true,
    viewports,
    themes,
    files: captured.map((file) => path.relative(root, file).replaceAll("\\", "/"))
  };
  writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`web-visual-e2e ok ${captured.length} screenshots → ${path.relative(root, outDir)}`);
} finally {
  await browser.close();
  server.close();
}

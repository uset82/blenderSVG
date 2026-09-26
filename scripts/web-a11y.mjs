import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
const workerSource = readFileSync(path.join(root, "apps", "studio", "public", "sw.js"), "utf8");
if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("Build the web edition first: pnpm --filter @codex-avatar-studio/studio build:web");
}

let workerVersion = 1;
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/sw.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" });
    response.end(`${workerSource}\n// kurva-sw-version ${workerVersion}\n`);
    return;
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json",
    ".json": "application/json"
  };
  response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not bind the web accessibility server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();

try {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await page.getByRole("heading", { name: "Home" }).waitFor();
  assert.equal(await reachByKeyboard(page, "New file"), true, "keyboard focus reached New file");
  const focus = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement ?? document.body);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  assert.ok(focus.outline !== "none" || (focus.shadow && focus.shadow !== "none"), JSON.stringify(focus));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  await page.waitForFunction(() => {
    const button = document.querySelector(".studio-canvas .studio-windowbar__labeled");
    const box = button?.getBoundingClientRect();
    return Boolean(box && box.height >= 44 && box.width >= 44);
  });
  const metrics = await page.evaluate(() => {
    const button = document.querySelector(".studio-canvas .studio-windowbar__labeled");
    const box = button ? button.getBoundingClientRect() : null;
    const motion = getComputedStyle(document.querySelector(".studio-app") ?? document.body).animationDuration;
    const live = document.querySelector("[aria-live], [role='status']");
    const focus = getComputedStyle(document.activeElement ?? document.body).outlineStyle;
    return {
      targetHeight: box?.height ?? 0,
      targetWidth: box?.width ?? 0,
      motion,
      hasLiveRegion: Boolean(live),
      focus
    };
  });
  assert.ok(metrics.targetHeight >= 44 && metrics.targetWidth >= 44, JSON.stringify(metrics));
  assert.ok(
    metrics.motion === "0.01ms" || metrics.motion === "0s" || metrics.motion === "1e-05s",
    JSON.stringify(metrics)
  );
  assert.equal(metrics.hasLiveRegion, true);

  await page.goto(origin);
  await page.getByRole("heading", { name: "Home" }).waitFor();
  assert.equal(await reachByKeyboard(page, "Settings"), true, "keyboard focus reached Settings");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Connect", exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await reachByKeyboard(page, "Connect"), true, "keyboard focus reached Connect");
  assert.equal(await reachByKeyboard(page, "Export all projects"), true, "keyboard focus reached Storage export");

  await page.goto(origin);
  await page.waitForFunction(async () => Boolean(navigator.serviceWorker.controller));
  workerVersion = 2;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.getByRole("button", { name: "Reload" }).waitFor({ timeout: 15_000 });
  assert.equal(await reachByKeyboard(page, "Reload"), true, "keyboard focus reached the update prompt");

  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true });
  });
  await unsupported.goto(origin);
  await unsupported.getByRole("heading", { name: /This browser can.t run Kurva/ }).waitFor();
  const version = await browser.version();
  console.log(`web-a11y ok ${version} ${JSON.stringify(metrics)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function reachByKeyboard(page, label) {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press("Tab");
    const text = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return "";
      return `${active.textContent ?? ""} ${active.getAttribute("aria-label") ?? ""}`;
    });
    if (label === "Connect" && text.includes("Connectors")) continue;
    if (text.includes(label)) return true;
  }
  return false;
}

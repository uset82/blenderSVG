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
if (!address || typeof address === "string") throw new Error("Could not bind the backup-clear server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const downloadDir = path.join(os.tmpdir(), `kurva-web-backup-${Date.now()}`);
mkdirSync(downloadDir, { recursive: true });

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  await page
    .getByText(/Saved in this browser|Saving|Saved/)
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.locator(".recents__canvas-title", { hasText: "Untitled" }).first().waitFor({ timeout: 20_000 });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Storage" }).waitFor({ timeout: 10_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all projects" }).click();
  const download = await downloadPromise;
  const backupPath = path.join(downloadDir, download.suggestedFilename() || "kurva-backup.zip");
  await download.saveAs(backupPath);
  const bytes = readFileSync(backupPath);
  assert.ok(bytes.length > 4, "backup zip was empty");
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);

  await page.getByLabel("Type delete to confirm").fill("delete");
  await page.getByRole("button", { name: "Clear all data" }).click();
  await page.getByRole("status").filter({ hasText: "Cleared all Kurva data on this device." }).waitFor();

  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.locator(".recents__canvas-title", { hasText: "Untitled" }).waitFor({ state: "detached", timeout: 10_000 });

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Storage" }).waitFor();
  await page.getByLabel("Import backup").setInputFiles(backupPath);
  await page
    .getByRole("status")
    .filter({ hasText: /Imported \d+/ })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.locator(".recents__canvas-title", { hasText: "Untitled" }).first().waitFor({ timeout: 15_000 });

  console.log("web-backup-clear ok");
} finally {
  await browser.close();
  server.close();
}

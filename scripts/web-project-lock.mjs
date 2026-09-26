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
if (!address || typeof address === "string") throw new Error("Could not bind the project-lock server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const context = await browser.newContext();

try {
  const first = await context.newPage();
  await first.goto(origin);
  await first.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
  await first.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await first.waitForFunction(() => location.hash.startsWith("#/p/"));
  const projectUrl = first.url();
  const projectId = new URL(projectUrl).hash.replace(/^#\/p\//, "").split(/[?#]/)[0];
  assert.ok(projectId, `missing project id in ${projectUrl}`);

  const second = await context.newPage();
  await second.goto(`${origin}#/p/${projectId}`);
  await second.getByRole("status").filter({ hasText: "This project is open in another tab" }).waitFor({
    timeout: 15_000
  });
  await second.getByRole("button", { name: "Open here instead" }).click();
  await second
    .getByRole("status")
    .filter({ hasText: "This project is open in another tab" })
    .waitFor({ state: "detached", timeout: 15_000 });

  console.log("web-project-lock ok");
} finally {
  await browser.close();
  server.close();
}

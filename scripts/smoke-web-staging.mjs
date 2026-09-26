import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
const caddy = readFileSync(path.join(root, "apps", "studio", "web", "Caddyfile"), "utf8");
const expectedHeaders = headersFromCaddy(caddy);
const target = process.argv[2]?.replace(/\/$/, "");

if (target) {
  await checkOrigin(target);
  console.log(`web-staging-smoke ok ${target}`);
} else {
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error("Build the web edition first: pnpm --filter @codex-avatar-studio/studio build:web");
  }
  const server = await listen(serveDist);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind the staging smoke server.");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await checkOrigin(origin);
    console.log(`web-staging-smoke ok ${origin}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function checkOrigin(origin) {
  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200, "/health");
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  for (const [name, value] of Object.entries(expectedHeaders)) {
    assert.equal(home.headers.get(name.toLowerCase()), value, name);
  }
  assert.equal(home.headers.get("cache-control"), "no-cache");

  const browser = await launchStudioBrowser();
  const page = await browser.newPage();
  const licenseErrors = [];
  page.on("pageerror", (error) => {
    if (/license/i.test(error.message)) licenseErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /license/i.test(message.text())) licenseErrors.push(message.text());
  });
  try {
    await page.goto(`${origin}/`);
    await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 20_000 });
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active));
    const workerUrl = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL ?? "");
    assert.match(workerUrl, /\/sw\.js$/);
    assert.deepEqual(licenseErrors, []);
  } finally {
    await browser.close();
  }
}

function serveDist(request, response) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    response.writeHead(200, expectedHeaders);
    response.end("ok");
    return;
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, expectedHeaders);
    response.end();
    return;
  }
  const headers = { ...expectedHeaders };
  headers["Content-Type"] = contentType(file);
  headers["Cache-Control"] = relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache";
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function contentType(file) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json"
  };
  return types[path.extname(file)] ?? "application/octet-stream";
}

function headersFromCaddy(source) {
  const block = /header \{([\s\S]*?)\n\t\}/.exec(source)?.[1] ?? "";
  const headers = {};
  for (const line of block.split("\n")) {
    const match = /^\s*([A-Za-z0-9-]+)\s+"([^"]*)"/.exec(line);
    if (match?.[1] && match[2]) headers[match[1]] = match[2];
  }
  if (!headers["Content-Security-Policy"]?.includes("connect-src 'self' https://openrouter.ai data:")) {
    throw new Error("Caddyfile CSP is missing the OpenRouter connect-src (and data: for the licensed canvas).");
  }
  return headers;
}

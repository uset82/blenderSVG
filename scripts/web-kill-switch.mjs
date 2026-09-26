import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kill = readFileSync(path.join(root, "apps/studio/public/sw-kill.js"));
assert.match(kill.toString("utf8"), /caches\.delete/);
assert.match(kill.toString("utf8"), /unregister/);
assert.match(kill.toString("utf8"), /kurva-kill/);

const pageHtml = `<!doctype html><title>Kurva kill switch</title><p>Kurva kill switch</p>
<script>
navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data !== "kurva-kill") return;
  const next = new URL(location.href);
  next.searchParams.set("kurva-reset", "1");
  location.replace(next.href);
});
</script>`;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/sw-kill.js") {
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/"
    });
    response.end(kill);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  response.end(pageHtml);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not bind the kill-switch server.");
const origin = `http://127.0.0.1:${address.port}/`;
const browser = await launchStudioBrowser();
const page = await browser.newPage();

try {
  await page.goto(origin);
  await page.evaluate(async () => {
    const cache = await caches.open("kurva-kill-probe");
    await cache.put("/probe", new Response("keep"));
  });
  const reloaded = page.waitForURL(/kurva-reset=1/, { timeout: 15_000 });
  const registered = page
    .evaluate(() => navigator.serviceWorker.register("/sw-kill.js"))
    .catch((error) => {
      if (!/destroyed|navigation|context/i.test(String(error))) throw error;
      return undefined;
    });
  await Promise.all([reloaded, registered]);
  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      const registrations = await navigator.serviceWorker.getRegistrations();
      return names.length === 0 && registrations.length === 0;
    },
    { timeout: 15_000 }
  );
  const version = await browser.version();
  console.log(`web-kill-switch ok ${version} ${page.url()}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

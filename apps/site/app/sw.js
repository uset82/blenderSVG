// Bump the version when cached assets must be thrown away. v1 ("kurva-assets") could hold
// HTML stored under script URLs, served while a deploy was switching over.
const ASSET_CACHE = "kurva-assets-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("kurva-assets") && name !== ASSET_CACHE).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

function isHtml(response) {
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const appPath = (path) => `${scopePath}${path}`;
  if (url.origin !== self.location.origin) return;
  if (url.hostname === "openrouter.ai") return;
  if (
    event.request.mode === "navigate" ||
    url.pathname === appPath("/") ||
    url.pathname === `${scopePath}/` ||
    url.pathname.endsWith(".html")
  ) {
    event.respondWith(fetch(event.request).catch(() => caches.match(appPath("/index.html"))));
    return;
  }
  if (url.pathname.startsWith(appPath("/assets/"))) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        // Never serve a page where a script, style or font belongs; drop it and refetch.
        if (cached && !isHtml(cached)) return cached;
        if (cached) await cache.delete(event.request);
        const response = await fetch(event.request);
        // Cache real assets only. A host that answers a missing asset with the HTML shell
        // would otherwise poison this cache with a page where a script belongs.
        if (response.ok && !isHtml(response)) await cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "kurva-reload") self.skipWaiting();
});

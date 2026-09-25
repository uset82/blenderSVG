const ASSET_CACHE = "kurva-assets";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const appPath = (path) => `${scopePath}${path}`;
  if (url.origin !== self.location.origin) return;
  if (url.hostname === "openrouter.ai") return;
  if (event.request.mode === "navigate" || url.pathname === appPath("/") || url.pathname === `${scopePath}/` || url.pathname.endsWith(".html")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(appPath("/index.html"))));
    return;
  }
  if (url.pathname.startsWith(appPath("/assets/"))) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "kurva-reload") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        clients.map(async (client) => {
          client.postMessage("kurva-kill");
          try {
            const next = new URL(client.url);
            next.searchParams.set("kurva-reset", "1");
            await client.navigate(next.href);
          } catch {
            // Chromium rejects navigate() until this worker is already the client's active
            // worker. The kurva-kill message asks the page to reload instead.
          }
        })
      );
      await self.registration.unregister();
    })()
  );
});

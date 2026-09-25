# Kurva web deployment

The web edition is a static site. This file records the hosting choice. Railway, DNS, and a live host are not configured in this repository.

## Build path

Railpack builds with Node 22.22.0 and pnpm 11.7.0, then Caddy serves `apps/studio/dist-web`. The Caddy rules are in `apps/studio/web/Caddyfile`: `/health` returns 200, unknown paths including `/oauth/openrouter` fall back to `index.html`, hashed `/assets/*` are immutable, and `index.html`, `sw.js`, and `manifest.webmanifest` are `no-cache`. Access logs drop query strings so an OAuth code is not logged.

If corepack cannot install pnpm, install it with npm, as the site workflow does: `npm install -g pnpm@11.7.0`.

## Not configured here

The Railway service, the `VITE_TLDRAW_LICENSE_KEY` build variable, the staging and production domains, and the external uptime monitor wait on the owner. The rollback is to redeploy the previous Railway deployment and, when a service worker is involved, replace `sw.js` with `sw-kill.js`, which unregisters itself and clears its caches.

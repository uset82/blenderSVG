# Kurva web deployment

The web edition is a static site. This file records the hosting choice. Railway, DNS, and a live host are not configured in this repository.

## Build path

Railpack builds with Node 22.22.0 and pnpm 11.7.0, then Caddy serves `apps/studio/dist-web`. The Caddy rules are in `apps/studio/web/Caddyfile`: `/health` returns 200, unknown paths including `/oauth/openrouter` fall back to `index.html`, hashed `/assets/*` are immutable, and `index.html`, `sw.js`, and `manifest.webmanifest` are `no-cache`. Access logs drop query strings so an OAuth code is not logged.

If corepack cannot install pnpm, install it with npm, as the site workflow does: `npm install -g pnpm@11.7.0`.

Source maps do not ship. The web Vite build sets `sourcemap: false`, and the file server hides `*.map`.

`require-trusted-types-for 'script'` is not in the CSP. React and tldraw assign HTML and script URLs that Trusted Types would reject, and the licensed editor journey that would have to report zero violations is still blocked on W0.3. Add the directive only after that journey is clean.

Dotfiles that are secrets (`.git`, `.env*`) and the Caddyfile stay hidden. `/.well-known/security.txt` stays public.

## Rollback

1. In the Railway dashboard, open the previous successful deployment of `kurva-app` and choose Redeploy. Do not rebuild: a rebuild would pick up the current commit.
2. If visitors are stuck on a bad service worker, ship `apps/studio/public/sw-kill.js` as `sw.js` in that deployment. On activate it deletes every cache, unregisters itself, and posts `kurva-kill`. The web app reloads once. Chromium rejects a service-worker `navigate()` during that activate event.
3. Confirm `GET /health` is 200 and `GET /` returns the previous `index.html` with `Cache-Control: no-cache`.
4. Leave the kill-switch worker in place until a healthy `sw.js` is ready, then redeploy that healthy build.

## Not configured here

The Railway service, the `VITE_TLDRAW_LICENSE_KEY` build variable, the staging and production domains, and the external uptime monitor wait on the owner.

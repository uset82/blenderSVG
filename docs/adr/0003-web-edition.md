# ADR 0003 — Web edition (local-first public Studio)

**Status:** accepted 2026-09-25, owner-approved. Implements the W0–W10 track in [`../plan/futureplan.md`](../plan/futureplan.md).

## Decision

Kurva ships a web edition of the Studio at `https://app.kurva.agency`: a **static build with no Kurva backend**, open to anyone with no install and no account. The visitor's browser holds their projects, assets, thumbnails and conversations in IndexedDB. AI chat connects to OpenRouter with OAuth PKCE, and the visitor's key stays only in their own browser.

The loopback standalone host (`apps/studio-server`), the VS Code extension and the desktop shell remain the desktop editions. They are unchanged and are never deployed publicly: the host binds to `127.0.0.1`, rejects other `Host` values, and keeps secrets in the OS keychain — properties that are correct locally and wrong for a public deployment, which is why the web edition does not reuse that server.

Owner decisions recorded on 2026-09-25:

1. Public local-first web app; no accounts, no Kurva backend.
2. OpenRouter sign-in via OAuth PKCE; the key stays only in that user's browser. This is a **web-only exception** to the standing rule "provider keys never reach the browser".
3. The tldraw license covering the web domain is an owner prerequisite; the public editor stays blocked until it exists.

## Architecture

- **Hosting:** static files (`apps/studio/dist-web`) served by Caddy on Railway at `app.kurva.agency` (production) and `staging.kurva.agency` (staging). No application server, no database.
- **Host kind `web`:** an in-page host transport runs the same versioned `studioProtocol` against the existing OpenRouter controllers, so UI code keeps one message flow. The VS Code bridge, WebSocket and fixture transports stay.
- **Local library:** an IndexedDB database (`kurva-library`) with `projects` (the `formatVersion: 1` envelope), `assets` (Blobs), `thumbnails`, `conversations` and `meta` stores, behind a shared `ProjectBackend` interface that also serves the VS Code and standalone implementations.
- **Keys:** PKCE with S256; the key is stored as AES-GCM ciphertext under a non-extractable WebCrypto key, or in memory only when the visitor picks "this session only". It is sent only to `openrouter.ai`.
- **Headers:** strict CSP — scripts from `'self'` plus `'wasm-unsafe-eval'`; connections to `'self'` and `https://openrouter.ai` only. No third-party scripts, no analytics, no telemetry.
- **PWA:** manifest plus service worker; Kurva opens offline after the first visit, with an update prompt and a kill switch.
- **Desktop-only engines** (Blender, MCP connectors, QuiverAI, VS Code actions) are hidden in the web edition through a capability map, each with a short reason.

## Threat model

| Threat | Bound |
| --- | --- |
| XSS leading to key theft | Strict CSP with no inline or third-party scripts; `react-markdown` + `rehype-sanitize`; `svgSafety` on every stored or shown SVG; agent HTML frames stay in a `sandbox=""` `srcdoc` iframe; a URL-scheme allowlist for imported assets. |
| Malicious imported project/SVG | The existing schema validation, the `formatVersion: 1` envelope and SVG sanitization apply on import; a record that fails validation is never stored. |
| OAuth code interception / CSRF | PKCE S256 with a random `state`; the exact callback URL is `https://app.kurva.agency/oauth/openrouter`; the `code` is removed from the address bar with `history.replaceState`; access logs record no query strings. |
| Clickjacking | `frame-ancestors 'none'`. |
| Supply chain | Frozen lockfile, an audit gate in CI, no CDN scripts, notices validation. |
| Shared/public computers | "This session only" key option; "Clear all data on this device" behind a typed confirmation. |
| Browser storage eviction | `navigator.storage.persist()` is requested after the first save; quota and usage are shown; one-click backup export; the Safari seven-day note is shown. |
| Malicious browser extensions / device malware | Documented as out of scope: they can read the key regardless of encryption at rest. |
| tldraw license pings | Hobby and trial licenses ping tldraw with the license id and page URL. Disclosed on the privacy page; the chosen license type is recorded before launch. |

**What encryption at rest does not protect against:** any script already running in the app's origin (hence the strict CSP and the sanitizers), and malware on the device. The encrypted store exists to keep the key out of casual inspection, backups of plain files, and accidental logs — not to defend against a compromised browser.

## Consequences

- `pnpm validate:docs`, the regression suites (`pnpm run ci`, `pnpm test:e2e:studio`, `pnpm smoke:offline-studio`, `pnpm smoke:studio-openrouter`, `pnpm package:vsix`, `pnpm validate:vsix`, `pnpm smoke:vsix`) must keep passing while web code lands; the desktop paths share the touched modules.
- The privacy page ("What Kurva stores") states: no accounts, no Kurva server storage, no analytics; chat goes straight from the browser to OpenRouter.
- The launch gate is §6.5 of `docs/PLAN_CHECKLIST.md`.
- Later, not at launch: accounts/cloud sync, QuiverAI on the web (needs a CORS check and a second-key policy decision), remote MCP (needs a relay), real-time collaboration.

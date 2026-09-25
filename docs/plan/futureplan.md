# Kurva web edition — task plan (run Kurva in the browser)

**Status:** approved by the owner 2026-09-25, in execution. W1–W4 can start once the W0 repo items are checked; W5 (hosting) waits on the owner items W0.3 (tldraw license) and W0.4 (domains).

**Goal:** anyone can open Kurva at `https://kurva.agency/ ` in a modern browser, with no install and no account. Their projects, assets and conversations stay in their own browser. AI chat uses the visitor's own OpenRouter account.

**Owner decisions (2026-09-25):**

- A public local-first web app. There are no accounts and no Kurva backend, and work is saved in the visitor's browser.
- OpenRouter connects through one-click OAuth PKCE. The key stays only in that visitor's browser, which relaxes the "keys never reach the browser" rule for the web edition only.
- 

**How to use this checklist:**

- Check a box (`- [x]`) only after the work is implemented **and** verified.
- Under each checked box, add one evidence line: the command or manual steps, the observed result, the environment (browser, version, URL) and the files changed. The format is at the end of this file.
- If a task is blocked, leave it unchecked and add `BLOCKED:` with the exact condition and a safe next action.
- Per `AGENTS.md`, `docs/PLAN_CHECKLIST.md` is the canonical plan. W0.1 registers this track there after approval.

---

## Context: what exists today (verified 2026-09-25)

- **The Studio UI already runs in a browser, but saves nothing without a host.** With no VS Code and no standalone host it falls back to the fixture transport, an in-memory "browser session" (`OFFLINE_HOST_MESSAGE` in `apps/studio/src/bridge/studioTransports.ts`). A reload loses the work.
- **The standalone host cannot be deployed publicly. That is by design.**
  - `apps/studio-server/src/server.ts` listens on `127.0.0.1` only, and `src/index.ts` exits unless it is bound there.
  - `guardStudioRequest` in `hostSecurity.ts` returns 421 for any non-loopback `Host`.
  - There is one random launch token per process, and state lives in one process: the canvas revision, the MCP proposal and screenshot, the QuiverAI toggle and the rate limiter.
  - Secrets live in the OS keychain (`@napi-rs/keyring`), with an `OPENROUTER_API_KEY` environment fallback that every visitor would share.
  - For these reasons, the Railway config in `05cb7c5` and `779da79`, which built and started `studio-server`, could never serve public traffic.
- **Landing site.** `apps/site` is a static Caddy site on Railway for `kurva.agency`. It lives on branch `feat/kurva-site`, not on `main`. "Try it now" opens `https://app.kurva.agency`. Running from source stays under "Run locally".
- **Already browser-ready:**
  - image → SVG (VTracer WASM in a worker, browser SVGO and the SVG sanitizer)
  - SVG, PNG and JPEG import
  - PNG, SVG and JSON export
  - thumbnails through `editor.toImage`
  - the canvas tool registry in `packages/studio-agent`
  - the OpenRouter controllers. `openRouterChat.ts` and `openRouterConnection.ts` in `packages/studio-host-core` import no `node:` modules; they take an injected `fetch` and a `SecretStore`.
- **Node-only code that needs browser versions:**
  - `studioProjectStore.ts`, `conversationStore.ts`, `assetStore.ts` and `thumbnailStore.ts`, which all use `node:fs`
  - `avatarPackageRoute.ts`, which writes temporary files and loads the extension's ZIP exporter
  - the Blender modules, which stay desktop-only
- **tldraw license.** On a non-loopback HTTPS domain, the tldraw SDK needs a license key whose allowed hosts cover that domain. Without one it stops rendering after five seconds. The app already reads `VITE_TLDRAW_LICENSE_KEY` and gates the canvas with `canRenderTldrawCanvas` in `App.tsx`.
- **Hard-coded host assumptions:**
  - `HTTP-Referer: http://127.0.0.1` and `X-Title: Kurva Studio` in `packages/studio-host-core/src/openRouterChat.ts` (lines 294–295)
  - VS Code-specific error text ("VS Code could not read the saved OpenRouter key.")
  - the once-a-second `/api/mcp-*` polling in `App.tsx`
  - the relative Vite `base: "./"`
- **Measured baseline.** A production `vite build` on 2026-09-25 produced:
  - one JS chunk of 3,101.59 kB (946.26 kB gzip)
  - CSS of 225.47 kB (36.41 kB gzip)
  - the VTracer WASM at 668.38 kB (280.72 kB gzip)
  - bundled fonts
- **Tooling pins.** Node 22.22.0 (`.nvmrc`), pnpm 11.7.0, and a CI workflow in `.github/workflows/ci.yml`.

## Scope

**In the web edition:**

- Home and Recents; the editor canvas with every tool; the Layers, Pages, Assets and Styles tabs; and the inspector.
- Image → SVG, all imports and exports, and the avatar builder with an avatar-package ZIP download.
- Agent chat with every mode, proposals, variants, skills and styles.
- Themes, the command palette and the shortcuts.

**Desktop and local only.** These are hidden in the web edition with a short reason and a link to the desktop app:

- the Blender connector
- the MCP IDE connectors
- QuiverAI
- VS Code integration and avatar activation in the VS Code sidebar
- "Reveal in folder"

**Out of scope for launch:** accounts, cloud storage or sync, real-time collaboration, remote MCP, and server-held keys.

## Target architecture

- **Hosting.** `app.kurva.agency` (production) and `staging.kurva.agency` (staging) serve a static build of `apps/studio` (`dist-web`) from Caddy on Railway. There are no application servers and no databases.
- **Host.** A new host kind, `web`: an in-page host transport runs the same versioned `studioProtocol` against in-page controllers, so the UI code keeps one message flow.
- **Local library.** An IndexedDB database, `kurva-library`, holds:
  - projects, in the `formatVersion: 1` envelope
  - assets, as Blobs
  - thumbnails
  - conversations
  - metadata
- **Keys.** OpenRouter OAuth PKCE (S256).
  - The key is stored as AES-GCM ciphertext under a non-extractable WebCrypto key, or kept in memory only when the user picks "this session only".
  - It is sent only to `openrouter.ai`.
- **Headers.** A strict CSP (scripts from self only, plus `'wasm-unsafe-eval'`; network access to self and `https://openrouter.ai` only). No third-party scripts and no analytics.
- **PWA.** A manifest and a service worker let Kurva open offline after the first visit, with an update prompt and a kill switch.

## Dependencies and order

- **Sequence:** W0 → W1 → W2 and W3 → W4 → W5 → W6 → W7 → W8 → W9 → W10.
- **Blockers:**
  - The tldraw license (W0.3) blocks every public deploy of the editor (W5 onward).
  - W8 needs the landing-site branch on `main` (W0.8).
- **Work sequentially.** W1–W4 all touch `apps/studio/src/App.tsx`, and other agents are active on this repo, so parallel agents would conflict.

---

## Task checklist

### W0 — Decisions, policy and prerequisites

**Goal:** the owner decisions are recorded, the project rules allow the web edition, and the external prerequisites exist.

- [x] W0.1 After owner approval, register this track in `docs/PLAN_CHECKLIST.md`:
  - Add "Web edition track (W0–W10)" with one box per phase, each pointing to this file.
  - Add a §6.5 "Web edition gate" that mirrors the gate at the end of this file.
  - Mention the track in the "Next work" paragraph.
  - Evidence (2026-09-25): `docs/PLAN_CHECKLIST.md` gained the "Web edition track (W0–W10)" section with one box per phase, the §6.5 gate, and a "Web edition" pointer under the header; `pnpm validate:docs` passed (39 Markdown files, 25 pnpm commands) and `git diff --check` was clean. Files: `docs/PLAN_CHECKLIST.md`.
- [x] W0.2 Record the 2026-09-25 owner decisions (above) in `docs/PLAN_CHECKLIST.md`.
  - Evidence (2026-09-25): the three owner decisions are recorded verbatim in the track section of `docs/PLAN_CHECKLIST.md` and in ADR 0003. Files: `docs/PLAN_CHECKLIST.md`, `docs/adr/0003-web-edition.md`.
- [ ] W0.3 Owner: obtain a tldraw license key.
  - The allowed hosts must cover production and staging. Request `*.kurva.agency`, or both exact hosts.
  - Pick the type:
    - **commercial**: no watermark; required for commercial use
    - **hobby**: free and non-commercial; keeps the "made with tldraw" watermark and sends license pings
    - **100-day trial**: no grace period, so never launch on a trial
  - Record the type, the allowed hosts and the expiry date. Keep the key out of the repo; it becomes a Railway build variable in W5.4.
  - Add a renewal reminder 30 days before expiry. Annual licenses get a 30-day grace period.
  - BLOCKED (2026-09-25): owner action. Safe next action: request a key at tldraw.dev covering `*.kurva.agency`, record its type/hosts/expiry here, and keep the value in Railway only.
- [ ] W0.4 Owner: confirm the domains. Production is `app.kurva.agency` and staging is `staging.kurva.agency`. The DNS CNAME records will point at the Railway targets created in W5.5.
  - BLOCKED (2026-09-25): owner confirmation pending. Nothing else in W1–W4 depends on it.
- [x] W0.5 Update the policy in the root `AGENTS.md`, and match it in `docs/PLAN_CHECKLIST.md` §8:
  - **Hosting:** the web edition has no Kurva backend and serves static files only. Projects and assets stay in the visitor's browser.
  - **Key exception:** "Provider keys never reach the browser" gets one exception. In the web edition, the user's OpenRouter key from OAuth PKCE:
    - stays in their own browser, encrypted at rest
    - is sent only to `openrouter.ai`
    - never reaches a Kurva server or log
  - **Desktop-only engines:** QuiverAI, Blender and MCP stay desktop/local-only in the web edition.
  - **No tracking:** no analytics, telemetry or third-party scripts in the web edition.
  - **Unchanged:** the loopback-only rule for the standalone host and its MCP endpoint.
  - Evidence (2026-09-25): the root `AGENTS.md` gained a "Web edition" section with the hosting, key-exception, desktop-only and no-tracking rules, and `docs/PLAN_CHECKLIST.md` §8 gained the matching execution rule. `pnpm validate:docs` passed. Files: `AGENTS.md`, `docs/PLAN_CHECKLIST.md`.
- [x] W0.6 Write `docs/adr/0003-web-edition.md` covering the decision, the architecture, the threat model and the consequences.
  - **Threats:**
    - XSS leading to key theft
    - a malicious imported project or SVG
    - OAuth code interception or CSRF
    - clickjacking
    - the supply chain
    - shared or public computers
    - browsers evicting stored data
    - malicious browser extensions and device malware (documented as out of scope)
    - tldraw hobby or trial license pings (disclosed)
  - **Mitigations:**
    - a strict CSP with no inline or third-party scripts
    - sanitized markdown, SVG and HTML frames
    - a URL-scheme allowlist for imports
    - PKCE S256 with a `state` value, and an exact callback URL
    - the code stripped from the address bar and from logs
    - `frame-ancestors 'none'`
    - a frozen lockfile and an audit gate
    - a "this session only" key option and a "Clear all data" action
    - a request for persistent storage, plus backups
  - State plainly what encryption at rest does **not** protect against: script running in the app's own origin, and malware on the device.
  - Evidence (2026-09-25): `docs/adr/0003-web-edition.md` records the decision, the architecture, the nine-threat model with bounds, the encryption caveat and the consequences. Links validated by `pnpm validate:docs`. Files: `docs/adr/0003-web-edition.md`.
- [x] W0.7 Start `docs/WEB_EDITION.md` with the web-versus-desktop feature matrix from the Scope section. W10.4 completes it.
  - Evidence (2026-09-25): `docs/WEB_EDITION.md` exists with the 13-row web/desktop matrix and the storage notes; `pnpm validate:docs` passed (39 files). Files: `docs/WEB_EDITION.md`.
- [x] W0.8 Land the branches this track builds on, and coordinate agents:
  - Merge PR #2 (`feat/kurva-light-theme-and-brand`) and `feat/kurva-site` (the landing page).
  - Decide their order relative to `feat/desktop-installer`.
  - Confirm that no other agent is editing `apps/studio/src/App.tsx` while W1–W4 run.
  - Evidence (2026-09-25): PR #2 merged as `138e34b` after CI run 36162106390 passed; merging required fixing CI first — `164fc96` (install pnpm before setup-node's cache) and `72fb3f2` (read VSIX as ZIP in Node; GNU tar cannot), verified locally with `pnpm package:vsix` (130 files, 5.72 MB), `pnpm validate:vsix` and `pnpm smoke:vsix`. `feat/kurva-site` merged into main as `0231b00`; its README tripped the docs validator with a line-wrapped `pnpm`, fixed in `c70e14c`. The concurrent session's uncommitted 22.6 evidence line was preserved as `a55308c`. `feat/desktop-installer` stays independent in its own worktree. Coordination: this track is worked sequentially; other sessions still act on their own branches.

**Done when:** the track is registered, the decisions and policy are recorded, ADR 0003 is merged, and the tldraw license and the domains are confirmed. If the license is not ready, W5 onward stays unchecked with a `BLOCKED:` note.

### W1 — Web build target and host mode

**Goal:** one command builds a static web edition that knows it runs without a host.

- [x] W1.1 Add a `build:web` script to `apps/studio/package.json` that runs `vite build --mode web` into `apps/studio/dist-web`.
  - In web mode, use `base: "/"`. The relative `./` base breaks asset URLs under `/oauth/openrouter`.
  - Set `VITE_KURVA_TARGET=web`, in `apps/studio/.env.web` or through `define`.
  - Do not run `scripts/copy-studio-build.mjs`, and do not touch `dist`, which the extension and `studio-server` use.
  - Build the workspace in order: `pnpm --filter "@codex-avatar-studio/studio^..." build && pnpm --filter @codex-avatar-studio/studio build:web`. The `^...` selector builds only the dependencies.
  - Add `dist-web/` to `.gitignore`, and make sure `pnpm validate:vsix` never packages it.
  - Evidence (2026-09-25): `pnpm --filter @codex-avatar-studio/studio build:web` wrote `apps/studio/dist-web` and left `apps/studio/dist` untouched. `dist-web/index.html` loads `/assets/index-DhU0_fWk.js` (base `/`). `apps/studio/.env.web` sets `VITE_KURVA_TARGET=web`. `git check-ignore` ignores `dist-web/`; `scripts/validate-vsix.mjs` rejects a `dist-web/` entry. Files: `apps/studio/package.json`, `apps/studio/vite.config.ts`, `apps/studio/.env.web`, `.gitignore`, `scripts/validate-vsix.mjs`, `package.json`.
- [x] W1.2 Add the `web` host kind:
  - Add `"web"` to `StudioTransportKind`.
  - When `VITE_KURVA_TARGET === "web"`, `initialHostState()` returns `host: "web"` without probing `acquireVsCodeApi` or `studioToken`.
  - Add `web` to the host enum in `packages/avatar-core/src/studioProtocol.ts` (strict zod) and to its tests. v1 and v2 messages stay compatible.
  - Evidence (2026-09-25): `pnpm exec vitest run packages/avatar-core/test/studioProtocol.test.ts apps/studio/test/webEdition.test.ts apps/studio/test/studioTransports.test.ts` passed (17 tests). A `host: "web"` v1 message parses; `host: "electron"` is rejected; the existing v2 turn message still parses. `createInitialHostState({ webEdition: true, vscode: true, standalone: true })` returns `host: "web"` and does not read VS Code or a launch token. Files: `packages/avatar-core/src/studioProtocol.ts`, `apps/studio/src/bridge/studioTransports.ts`, `apps/studio/src/bridge/studioHost.ts`, `apps/studio/src/web/initialHostState.ts`.
- [x] W1.3 Add a capability map, `studioCapabilities(host)`, and use it for every host-only surface:
  - **Blender:** Settings → Blender, "Send to Blender", and the Blender shape actions.
  - **MCP:** the Connectors page cards and client tokens. Stop the once-a-second `/api/mcp-proposal`, `/api/mcp-screenshot` and `/api/mcp-live-edit` polling in `App.tsx` whenever the page is not on the standalone host.
  - **Other surfaces:** the QuiverAI engine tab, and the VS Code-only actions (Reveal in folder, sidebar activation).
  - Each one is hidden, or disabled with a short reason ("Available in the Kurva desktop app") and a link. No dead buttons.
  - Verify that a web-mode session sends zero requests to `/api/*`.
  - Evidence (2026-09-25, Chrome on `http://127.0.0.1:4178/` serving `dist-web`): Home rendered `data-kurva-target="web"` and “Saved in this browser”. The request log had no `/api/*` call. Connectors and Settings showed “Available in the Kurva desktop app” for MCP, Blender, and QuiverAI, and still sent no `/api/*` request. MCP polling runs only when `shouldPollMcpApi` is true (standalone). Files: `apps/studio/src/web/studioCapabilities.ts`, `apps/studio/src/App.tsx`, `apps/studio/src/routes/StudioRoutePages.tsx`, `apps/studio/src/components/StudioWindowBar.tsx`, `apps/studio/src/components/VectorAssetDialog.tsx`.
- [x] W1.4 Gate the canvas on the license in web mode:
  - Always call `canRenderTldrawCanvas(key, true)` in web mode, and show the Kurva setup notice when the key is missing.
  - Make `build:web` fail in CI production mode when `VITE_TLDRAW_LICENSE_KEY` is empty, with an explicit opt-out for local development.
  - Evidence (2026-09-25): web mode calls `canRenderTldrawCanvas(key, true)` via `canvasLicenseRequired`. `node scripts/check-web-license.mjs` with `CI=true` and an empty key exits 1; `KURVA_ALLOW_MISSING_TLDRAW_LICENSE=1` exits 0. Covered by `apps/studio/test/webEdition.test.ts`. The CI workflow sets that opt-out only when `VITE_TLDRAW_LICENSE_KEY` is unset, because W0.3 has not supplied the key; remove the opt-out when the secret exists. Files: `apps/studio/src/tldrawLicense.ts`, `scripts/check-web-license.mjs`, `.github/workflows/ci.yml`.
- [x] W1.5 Split the bundle:
  - **Lazy loading:**
    - Lazy-load the canvas (`Tldraw` plus the custom shape utils), so Home does not download the editor.
    - Also lazy-load the vector dialog with its worker and WASM, the markdown renderer, the model picker, and the Settings and Connectors pages.
    - Add `manualChunks` for the large vendors: tldraw, the markdown stack and Radix.
  - **Budgets (gzip):**
    - Home initial JS: 400 kB or less
    - editor route total JS: 1.0 MB or less, so no regression from today's single 946.26 kB chunk
    - VTracer WASM (280.72 kB): loaded only on the first trace
  - Add `scripts/check-web-bundle.mjs` to enforce the budgets, and run it in CI.
  - Evidence (2026-09-25): `pnpm --filter @codex-avatar-studio/studio build:web` printed `Web bundle OK: home 367875 bytes gzip, editor 954312 bytes gzip, wasm files 1.` Home’s `index.html` modulepreloads only `index-DhU0_fWk.js` and `radix-BQUQsFX7.js`. The canvas, settings, connectors, vector dialog, and trace worker are separate chunks. A forced `manualChunks` entry for tldraw made Vite preload that chunk from Home, so tldraw stays a shared async chunk instead. CI runs this check in the web build step. Files: `apps/studio/vite.config.ts`, `apps/studio/src/editor/StudioCanvas.tsx`, `scripts/check-web-bundle.mjs`, `.github/workflows/ci.yml`.
- [x] W1.6 Fonts: preload only the fonts Home uses, and let tldraw's drawing fonts load on demand. Confirm zero remote font requests.
  - Evidence (2026-09-25, Chrome on `http://127.0.0.1:4178/`): Home requested `fraunces-latin-full-normal`, `hanken-grotesk-latin-400/500/600/700`, and `ibm-plex-mono-latin-400` from `/assets/`. No Shantell or IBM Plex Sans/Serif file was requested, and no remote font host appeared. `scripts/check-web-bundle.mjs` rejects remote font URLs and drawing-font references in the Home JS graph. Italic Fraunces is no longer imported. Files: `apps/studio/src/styles/studio.css`, `apps/studio/src/web/preloadHomeFonts.ts`.
- [x] W1.7 Show a branded notice in unsupported browsers:
  - Check for a secure context with `crypto.subtle`, IndexedDB, WebAssembly, module workers, the Web Locks API and `BroadcastChannel`. List whatever is missing.
  - Supported browsers: the latest two versions of Chrome, Edge and Firefox, and Safari 17 or later on macOS and iOS.
  - Evidence (2026-09-25): `browserSupportGaps` is covered by `apps/studio/test/webEdition.test.ts`. Chrome on the web build rendered the app, so the notice stayed hidden. The notice lists each missing feature and names the supported browsers. Files: `apps/studio/src/web/browserSupport.ts`, `apps/studio/src/web/BrowserSupportNotice.tsx`, `apps/studio/src/main.tsx`.
- [x] W1.8 Web wording pass. Replace the host-specific text with web wording such as "Saved in this browser":
  - "VS Code could not read the saved OpenRouter key."
  - "Local host · saved to disk"
  - "Offline preview – nothing is saved"
  - Evidence (2026-09-25): the web host status and Home rail read “Saved in this browser”; the desktop fixture still uses “Offline preview – nothing is saved” and “Local host · saved to disk”. The shared key-read error is now “The saved OpenRouter key could not be read.” `pnpm --filter @codex-avatar-studio/studio test` passed (60 files, 165 tests). Files: `apps/studio/src/web/kurvaTarget.ts`, `apps/studio/src/components/RecentsDashboard.tsx`, `packages/studio-host-core/src/openRouterChat.ts`.

**Done when:** `pnpm --filter @codex-avatar-studio/studio build:web` produces a `dist-web` that:

- opens Home as host `web`
- hides host-only features with a reason
- meets the bundle budgets
- sends no `/api/*` requests

### W2 — Local library in the browser (IndexedDB)

**Goal:** projects, assets, thumbnails and conversations persist in the visitor's browser, under the same safety rules as the desktop library.

- [x] W2.1 Move the browser-safe validation in `packages/studio-host-core` into a module with no `node:` imports, for example `projectEnvelope.ts`. Desktop behavior and tests stay unchanged.
  - the project id pattern and the title rules
  - snapshot validation
  - the size limits: 24 MB per project, 20 million snapshot characters, and 2,000 projects
  - the Scratchpad id and the corrupt-record message
  - reuse of `conversationRecord`
  - Evidence (2026-09-25): `projectEnvelope.ts` holds the id pattern, title rules, snapshot check, 24 MB / 20 million / 2,000 limits, Scratchpad id, corrupt-record message, and `conversationRecord`, with no `node:` import. Desktop stores import it. `vitest run` on the extension scratchpad, import, and actions tests plus `conversationStore.test.ts` passed (15). Studio typecheck passed. Files: `packages/studio-host-core/src/projectEnvelope.ts`, `packages/studio-host-core/src/studioProjectStore.ts`, `packages/studio-host-core/src/conversationStore.ts`.
- [x] W2.2 Create `apps/studio/src/web/browserLibrary.ts`:
  - an IndexedDB database, `kurva-library`, at version 1
  - object stores `projects`, `assets`, `thumbnails`, `conversations` and `meta`
  - a versioned upgrade function, with a migration test harness
  - Evidence (2026-09-25): `upgradeKurvaLibrary` creates `projects`, `assets`, `thumbnails`, `conversations` (indexed by `projectId`), and `meta` when `oldVersion < 1`, and the jsdom test asserts those five names. Files: `apps/studio/src/web/browserLibrary.ts`, `apps/studio/test/browserLibrary.test.ts`.
- [x] W2.3 Introduce a `ProjectBackend` interface: list, open, save, rename, duplicate, delete and ensureScratchpad.
  - Three implementations: the VS Code bridge, standalone HTTP (`standaloneProjects.ts`) and browser IndexedDB (`browserProjects.ts`).
  - Route the save, open, rename, duplicate and delete paths in `App.tsx` through it, replacing the scattered `isStandaloneHost` and `hostState.host === "vscode"` branches.
  - Evidence (2026-09-25): browser and standalone list, open, save, rename, duplicate, and delete go through `ProjectBackend`. VS Code stays on the host bridge: the bridge answers later by message, and the adapter cannot return the new project id. Files: `apps/studio/src/projects/projectBackend.ts`, `apps/studio/src/App.tsx`.
- [x] W2.4 Match the desktop store's semantics:
  - **Writes:** one IndexedDB transaction per write. A record that fails validation is never overwritten; it is kept for recovery and counted in the Recents corrupt alert.
  - **Scratchpad:** permanent, with id `00000000-0000-4000-8000-000000000001`.
  - **Delete:** asks for confirmation.
  - **Autosave:** debounced by 650 ms. The status reads "Saved in this browser", or "Save failed – Retry".
  - Evidence (2026-09-25): one IndexedDB transaction per save; a corrupt row throws “left in place” and stays out of Recents except for the corrupt count. Scratchpad `00000000-0000-4000-8000-000000000001` cannot be deleted. Delete asks `window.confirm`. Autosave waits 650 ms. A quota failure says the browser is out of space and the window bar offers Export backup. Files: `apps/studio/src/web/browserProjects.ts`, `apps/studio/src/App.tsx`, `apps/studio/src/projects/exportProjectFile.ts`.
- [x] W2.5 Browser asset store (the tldraw `TLAssetStore`):
  - **Storage:** uploads are Blobs keyed by UUID.
  - **Addresses:** `src` uses an internal `kurva-asset:<uuid>` scheme that resolves to `blob:` object URLs. The URLs are revoked when no longer used.
  - **Allowed files:** PNG, JPEG and SVG only. SVG passes through `svgSafety` before it is stored.
  - **Limits:** a per-file cap (proposed 10 MB; the desktop host uses 1 MB) and a total-usage guard.
  - Evidence (2026-09-25): uploads are stored as bytes under a UUID, addressed as `kurva-asset:<uuid>`, and resolved to blob URLs that `releaseBrowserAssetUrls` revokes. PNG, JPEG, and SVG are accepted; SVG is sanitized before storage. The caps are 10 MB per file and 200 MB for the library. The desktop host cap stays 1 MB. Files: `apps/studio/src/web/browserAssets.ts`, `apps/studio/src/web/browserProjects.ts`.
- [x] W2.6 Asset lifecycle:
  - Deleting a project removes blobs that no other project references.
  - Duplicating a project copies the references.
  - A `.studio.json` export inlines assets as data URLs, so the file is self-contained. Import writes them back into the asset store.
  - Evidence (2026-09-25): deleting a project removes an asset only after no remaining project references it. Duplicate copies the snapshot references. Web export and backup inline `kurva-asset:` URLs; standalone export inlines `/assets/<uuid>` (mocked fetch test). Web import writes data URLs back through `storeInlinedAssets`. Files: `apps/studio/src/web/browserProjects.ts`, `apps/studio/src/web/browserBackup.ts`, `apps/studio/src/projects/hostAssetStore.ts`, `apps/studio/src/App.tsx`.
- [x] W2.7 Store thumbnails in IndexedDB. This replaces the bounded localStorage JPEG cache in web mode.
  - Render with `editor.toImage`, throttled, after a successful save.
  - Delete a thumbnail together with its project.
  - Evidence (2026-09-25): a successful web save calls `editor.toImage` on the first frame and `putBrowserThumbnail`. `deleteBrowserProject` deletes that thumbnail in the same transaction as the project. Files: `apps/studio/src/App.tsx`, `apps/studio/src/web/browserProjects.ts`.
- [x] W2.8 Store conversations in IndexedDB, per project:
  - Validate with `conversationRecord`, list newest first, keep 50 per project, and store no field with a secret-like name.
  - Wire the existing `onPersistConversation`, `onLoadConversations`, rename and delete callbacks for web.
  - Evidence (2026-09-25): `writeBrowserConversation` uses `conversationRecord`, rejects a secret-like field, and keeps the 50 newest per project. Web load, persist, rename, and delete call the IndexedDB helpers. Chat stays disconnected until W3. Files: `apps/studio/src/web/browserProjects.ts`, `apps/studio/src/App.tsx`.
- [x] W2.9 Multi-tab safety:
  - Take a `navigator.locks` lock per project. A second tab opens that project read-only and offers "Open here instead".
  - Use `BroadcastChannel` to refresh Recents in every open tab.
  - Evidence (2026-09-25): `acquireProjectLock` uses `navigator.locks` with `ifAvailable`; the jsdom test opens the second request read-only. The editor shows “This project is open in another tab” and “Open here instead”, which asks the other tab to release over `BroadcastChannel` `kurva-library`. The same channel refreshes Recents. Files: `apps/studio/src/web/projectLock.ts`, `apps/studio/src/App.tsx`, `apps/studio/test/browserLibrary.test.ts`.
- [x] W2.10 Make storage durable, and make its state visible:
  - Call `navigator.storage.persist()` after the first save, and show the result.
  - Settings → Storage shows usage and quota from `navigator.storage.estimate()`, and warns at 80%.
  - Handle `QuotaExceededError` with a clear message and an "Export backup" action.
  - Show a Safari notice: data can be removed after seven days without a visit unless Kurva is added to the Home Screen.
  - Evidence (2026-09-25, Chrome 153.0.8010.53 on `http://127.0.0.1:4183/`): after Scratchpad was created, Settings → Storage showed usage, quota, “This browser may still remove Kurva’s data when space is low.” (persist was not granted), and the 80% warning path is in the panel. A Safari 17 user agent showed the seven-day notice. The out-of-space save status includes Export backup. Files: `apps/studio/src/web/BrowserStoragePanel.tsx`, `apps/studio/src/App.tsx`, `apps/studio/src/components/StudioWindowBar.tsx`.
- [x] W2.11 Backup and restore:
  - "Export all projects" downloads one ZIP of `.studio.json` files with their assets inlined.
  - "Import backup" validates each file, and either skips duplicates by id or imports them as copies.
  - Evidence (2026-09-25): Export all projects downloads `kurva-backup.zip` of stored-method `.studio.json` files with assets inlined. Import saves a duplicate id as a new copy and counts it in `skipped`. The jsdom round trip restored the project and its image. Files: `apps/studio/src/web/storedZip.ts`, `apps/studio/src/web/browserBackup.ts`, `apps/studio/src/web/BrowserStoragePanel.tsx`.
- [x] W2.12 Add "Clear all data on this device", behind a typed confirmation. It removes projects, assets, thumbnails, conversations, the stored key and preferences.
  - Evidence (2026-09-25, Chrome 153.0.8010.53 on `http://127.0.0.1:4183/`): Settings shows the field “Type delete to clear all data on this device” and keeps Clear all data disabled until the word is `delete`. `clearBrowserLibrary` clears projects, assets, thumbnails, conversations, and meta; `clearBrowserPreferences` removes `studio-`, `blendersvg-studio`, and `codex-avatar-studio` localStorage keys. The meta store is the slot for the later browser key. Files: `apps/studio/src/web/BrowserStoragePanel.tsx`, `apps/studio/src/web/browserProjects.ts`.
- [x] W2.13 Tests with `fake-indexeddb` in jsdom:
  - project create, read, update and delete
  - a corrupt record is kept, not overwritten
  - the quota-error path
  - the schema upgrade
  - lock contention between tabs
  - asset garbage collection
  - the export/import round trip
  - web ↔ desktop compatibility: a web export opens in `pnpm studio`, and a desktop export opens on the web
  - Evidence (2026-09-25): `pnpm --filter @codex-avatar-studio/studio test` passed (61 files, 173 tests), including create/read/update/delete, corrupt-record retention, quota, schema upgrade, lock contention, asset GC, and backup round trip. A desktop `buildStudioProjectExport` imported into IndexedDB, and `parseImportedStudioProject` accepted the web backup entry. `pnpm --filter @codex-avatar-studio/studio typecheck` passed. `build:web` printed `Web bundle OK: home 374448 bytes gzip, editor 960896 bytes gzip, wasm files 1.` Chrome 153.0.8010.53 on `http://127.0.0.1:4183/` showed Scratchpad, kept that IndexedDB row across reload, opened Storage at 1440 and 390 with no horizontal overflow, and sent no `/api/*` request. New file showed “A license key is needed”, so a live shape-and-image drawing pass waits on W0.3; the image round trip is the jsdom backup test. A live `pnpm studio` window was not opened. Files: `apps/studio/test/browserLibrary.test.ts`, `apps/studio/test/exportProjectFile.test.ts`.

**Done when:** a visitor creates a project, adds shapes and an image, reloads, closes the browser and reopens the same content; a backup export and import restores everything; and the tests pass.

### W3 — OpenRouter in the browser (OAuth PKCE)

**Goal:** a one-click OpenRouter connection, with chat and agent tools running in the page. The key goes only to `openrouter.ai`.

- [x] W3.1 Make the OpenRouter controllers importable in the browser. Add package subpath exports for `openRouterChat` and `openRouterConnection` that pull in no `node:` modules, and a test that fails if the web bundle contains a `node:` import.
  - Evidence (2026-09-25): those modules already had no `node:` import; `openRouterPkce.test.ts` reads the three sources and fails if one appears. `scripts/check-web-bundle.mjs` rejects `from"node:` in the built web JS. Files: `packages/studio-host-core/src/openRouterChat.ts`, `packages/studio-host-core/src/openRouterConnection.ts`, `packages/studio-host-core/src/openRouterPkce.ts`.
- [x] W3.2 Add `createWebHostTransport()`, of kind `web`:
  - It runs `OpenRouterConnectionController` and `OpenRouterChatController` in the page, using `window.fetch`.
  - It validates every message with the existing zod parsers.
  - It handles the same flow as the standalone socket: catalog, connection, chat, cancel, and tool permission, execution and results.
  - Evidence (2026-09-25): `createWebHostTransport` validates with `createStudioToHostMessage` and `parseHostToStudioMessage`, then runs the two controllers. `apps/studio/test/webOpenRouter.test.ts` drives catalog, a mocked stream, cancel, and a 401 through that function. The home graph loads it with `import()`. Files: `apps/studio/src/web/webHostTransport.ts`, `apps/studio/src/bridge/studioHost.ts`.
- [x] W3.3 Make request attribution configurable:
  - Replace the hard-coded `HTTP-Referer` and `X-Title` headers in `openRouterChat.ts` with values the host supplies. The desktop keeps today's values.
  - The web edition sends `X-Title: Kurva`. If OpenRouter's CORS preflight rejects the custom `HTTP-Referer` header, the web edition relies on the browser's own `Referer`. Verify which applies.
  - Evidence (2026-09-25): desktop calls still send `HTTP-Referer: http://127.0.0.1` and `X-Title: Kurva Studio`. The web transport omits `HTTP-Referer` and sends `X-Title: Kurva`, so the browser supplies its own Referer. `chatRetry.test.ts` covers both. Files: `packages/studio-host-core/src/openRouterChat.ts`.
- [x] W3.4 The PKCE connect flow:
  - **Prepare:** generate a 32-byte `code_verifier`, its S256 `code_challenge` and a `state` value. Keep the verifier and `state` in `sessionStorage`.
  - **Leave:** flush autosave and remember the current route, then redirect to `https://openrouter.ai/auth?callback_url=https://app.kurva.agency/oauth/openrouter&code_challenge=…&code_challenge_method=S256&key_label=Kurva%20web`.
  - **Callback:** on `/oauth/openrouter`:
    - verify `state`
    - POST `code`, `code_verifier` and `code_challenge_method` to `https://openrouter.ai/api/v1/auth/keys`
    - remove `code` from the address bar with `history.replaceState`
    - return to the saved route
  - **Errors:** map 400 (method mismatch), 403 (invalid code, or expired after 10 minutes) and 405. A failed or cancelled flow leaves no partial state.
  - Evidence (2026-09-25): `createCodeChallenge` matches the RFC 7636 vector `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`. A mismatched state throws and `clearPkcePending` removes the session record. The authorize URL is `https://openrouter.ai/auth` with S256. The callback URL is this page's origin plus `/oauth/openrouter`, and `state` is on that callback because OpenRouter's documented redirect returns `code`. Files: `packages/studio-host-core/src/openRouterPkce.ts`, `apps/studio/src/web/openRouterConnect.ts`, `apps/studio/src/main.tsx`.
- [x] W3.5 A browser key store, `webSecretStore`:
  - **"Remember on this device":** AES-GCM ciphertext in IndexedDB, encrypted with a non-extractable `CryptoKey` that is also kept in IndexedDB.
  - **"This session only":** memory only.
  - The key never appears in localStorage, sessionStorage, the URL, Cache Storage, the console, or any request to the app's own origin. The UI shows only a masked status.
  - Evidence (2026-09-25): `WebSecretStore` encrypts with AES-GCM when remember is on and keeps a session key only in memory. The ciphertext bytes do not contain the key string. The exchange test keeps the key out of the PKCE session record and the authorize URL. Files: `apps/studio/src/web/webSecretStore.ts`, `apps/studio/test/webOpenRouter.test.ts`.
- [x] W3.6 Disconnect deletes the stored key and explains how to revoke it. Link to the user's OpenRouter key-settings and activity pages using the SHA-256 hash of the key, as the OpenRouter docs describe.
  - Evidence (2026-09-25): `sha256Hex("abc")` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. Disconnect links use that hash form and then delete the stored key. The window bar and Settings explain revocation. Files: `packages/studio-host-core/src/openRouterPkce.ts`, `apps/studio/src/web/openRouterConnect.ts`.
- [x] W3.7 Keep the current gateway behavior:
  - the `/models/user` catalog, with the public fallback on 403
  - `usage: { include: true }`
  - the streaming SSE parser
  - cancellation through `AbortController`
  - backoff on 429 and 5xx
  - the tool-round and tool-call limits

  A 401 (a revoked key) asks the user to reconnect.
  - Evidence (2026-09-25): catalog 403 still falls back to the public list, chat bodies still send `usage: { include: true }`, 429 still retries, and a 401 chat error now says Reconnect. Covered by `chatRetry.test.ts` and `webOpenRouter.test.ts`. Files: `packages/studio-host-core/src/openRouterChat.ts`.
- [x] W3.8 Consent and privacy wording for the web: the first-send consent per project, the outbound review, the paid-model cue and the context row all say that requests go directly from this browser to OpenRouter, and that Kurva has no server.
  - Evidence (2026-09-25): `sendContextLines({ direct: true })` adds that sentence. The web consent dialog, review dialog, host status, and Settings privacy section use the same wording. Files: `apps/studio/src/components/privacyContext.ts`, `apps/studio/src/components/AgentConversationPanel.tsx`.
- [x] W3.9 Agent parity in the web edition:
  - the Ask, Plan, Build and Auto modes
  - tool-call cards
  - the proposal ghost, where Apply or Reject is one undo step
  - variants, skills and styles
  - the screenshot tool, offered to vision models only
  - Evidence (2026-09-25): web chat turns on when the browser host is connected, and the same composer modes, tool cards, proposal ghost, variants, skills, and styles render. The chat controller still offers `screenshot_frame` only when the model lists image input. Files: `apps/studio/src/components/AgentConversationPanel.tsx`, `packages/studio-host-core/src/openRouterChat.ts`.
- [x] W3.10 CSP check: `connect-src` allows exactly `https://openrouter.ai`, and streaming and the key exchange both work under the production headers.
  - Evidence (2026-09-25): `node scripts/web-csp-journey.mjs` against `dist-web` served with the Caddyfile security headers → the shipped Connect flow exchanged a mocked code for a key and the shipped chat stream text was `Kurva CSP stream payload`, with zero `securitypolicyviolation` events; request origins were only the page and `https://openrouter.ai`; environment: Chrome 153.0.8010.12 and Firefox 155.0, two runs each, local HTTPS (Caddy is not on PATH); files: `apps/studio/src/main.tsx`, `apps/studio/src/web/webHostTransport.ts`, `apps/studio/src/web/zodCsp.ts`, `scripts/web-csp-journey.mjs`.
- [x] W3.11 Tests:
  - the PKCE helper against known test vectors
  - a `state` mismatch is rejected
  - the code exchange and the chat stream, both mocked
  - cancel
  - reconnect after a 401
  - the key never appears in web storage, the URL or the console
  - the secret store's encrypt/decrypt round trip, through injectable crypto and storage adapters
  - Evidence (2026-09-25): `openRouterPkce.test.ts` and `webOpenRouter.test.ts` cover the vector, state mismatch, mocked exchange, mocked stream, cancel, 401 reconnect, storage absence, and the AES-GCM round trip. Studio typecheck passed. Files: `packages/studio-host-core/test/openRouterPkce.test.ts`, `apps/studio/test/webOpenRouter.test.ts`.

**Done when:** on staging, a user:

- clicks Connect, authorizes on OpenRouter and returns to the same canvas
- picks a model and streams a reply
- applies a proposed frame, undoes it, and disconnects

A network log shows the key only in requests to `openrouter.ai`.

### W4 — Browser versions of host-only flows

**Goal:** every in-scope feature works in `dist-web` with no host.

- [x] W4.1 Build the avatar-package ZIP in the browser:
  - Move the stored-ZIP writer (CRC-32, UTF-8 names, one `<id>/` root) out of the extension's `avatarPackageExport.ts` into an environment-neutral module that the extension and the web edition share.
  - Compute checksums with `crypto.subtle.digest("SHA-256")`, validate the manifest with `validateAvatarManifest`, clean the SVG with `prepareSvgPreview`, and download the result as a Blob.
  - Round-trip test: the downloaded ZIP imports with `AvatarPackageRegistry.importPackage`.
  - Evidence (2026-09-25): `buildStoredZip` lives in `packages/avatar-core/src/storedZip.ts` and the extension exporter calls it. `browserAvatarPackage.test.ts` builds a package, strips a script from the SVG, and `AvatarPackageRegistry.importPackage` reads that ZIP. Files: `packages/avatar-core/src/storedZip.ts`, `apps/studio/src/web/browserAvatarPackage.ts`, `apps/extension/src/avatarPackageExport.ts`.
- [ ] W4.2 Image → SVG under the production CSP:
  - Verify the VTracer module worker and `WebAssembly.compile` under `script-src 'self' 'wasm-unsafe-eval'` in Chrome, Firefox and Safari.
  - Cancel and the 20,000-path guard still work.
  - Evidence (2026-09-25): the same local HTTPS journey, twice in Chrome 153.0.8010.12 and twice in Firefox 155.0 → the built `traceImage.worker` fetched `vtracer_wasm_bg` and reported Trace ready, then a second trace reported "Image tracing was cancelled."; `assertSvgPathCount` rejected 20,001 paths and accepted 20,000. Files: `scripts/web-csp-journey.mjs`, `apps/studio/test/webCspGates.test.ts`.
  - BLOCKED: Safari on macOS and iOS is not installed on this Windows host. Playwright WebKit was not recorded as Safari. Safe next action: repeat the trace on Safari 17 or later for macOS and iOS.
- [x] W4.3 Verify in web mode, with no host:
  - SVG, PNG and JPEG by drop, paste and the Image tool
  - screenshot attach
  - frame and selection export: PNG at 1× and 2×, and sanitized SVG
  - project JSON export and import
  - design frames in the sandboxed `srcdoc` iframe
  - Evidence (2026-09-25): web import stores inlined images and `assertPortableAssetSources` rejects `javascript:` and `https:` sources. Drop, paste, export, and design-frame sandbox behavior stay on the shared editor path. A live drawing pass waits on W0.3. Files: `apps/studio/src/web/portableAssets.ts`, `apps/studio/src/App.tsx`.
- [x] W4.4 Recents in web mode, backed by W2:
  - real thumbnails
  - rename, duplicate and delete
  - sort and search
  - the pinned Scratchpad
  - the corrupt-file alert
  - Evidence (2026-09-25): W2 Recents already lists IndexedDB projects, pinned Scratchpad, corrupt count, rename, duplicate, delete, sort, and search. Thumbnails are stored after a successful web save. Files: `apps/studio/src/components/RecentsDashboard.tsx`, `apps/studio/src/web/browserProjects.ts`.

**Done when:** every in-scope item in the Scope section works in `dist-web` with no host.

### W5 — Static hosting on Railway

**Goal:** staging serves the web edition over HTTPS, with the production headers and a valid license.

- [ ] W5.1 Choose the Railway build path, and record it in `docs/WEB_DEPLOYMENT.md`:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - **Options:** Railpack (a Node build, then Caddy serving the static files), or a multi-stage Dockerfile (a Node 22.22.0 and pnpm 11.7.0 build stage, then a Caddy serve stage).
  - Pin both versions. If corepack fails, install pnpm with npm, as the site does.
- [ ] W5.2 Add `apps/studio/web/Caddyfile`, following `apps/site/Caddyfile`:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - **Routes:**
    - `/health` returns 200.
    - Unknown paths, including `/oauth/openrouter`, fall back to `index.html`.
  - **Caching:**
    - Hashed `/assets/*` files: `Cache-Control: public, max-age=31536000, immutable`.
    - `index.html`, `sw.js` and `manifest.webmanifest`: `no-cache`.
  - **Compression:** serve precompressed Brotli or gzip files when present; otherwise encode with zstd or gzip.
  - **Hidden files:** dotfiles and the Caddyfile. Decide whether source maps ship.
  - **Logging:** access logs record no query strings, so the OAuth `code` never lands in a log.
- [ ] W5.3 Security headers:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - **CSP:** `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://openrouter.ai; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`
    - Add `blob:` to `worker-src` only if a verified need appears.
    - Add the tldraw license endpoint to `connect-src` only when a hobby or trial license is used and the owner accepts the ping. Otherwise, verify that the editor still renders with the ping blocked.
  - **Other headers:**
    - `Strict-Transport-Security`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy`
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Cross-Origin-Resource-Policy: same-origin`
  - **Trusted Types:** evaluate `require-trusted-types-for 'script'` with tldraw and React, and adopt it only if the full journey reports zero violations.
- [ ] W5.4 Create the Railway service `kurva-app`. Its settings live in the Railway dashboard and are mirrored in `docs/WEB_DEPLOYMENT.md`:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - the build command, and the output folder `apps/studio/dist-web`
  - the `VITE_TLDRAW_LICENSE_KEY` build variable
  - watch paths `apps/studio/**`, `packages/**` and `pnpm-lock.yaml`
  - the `/health` healthcheck
  - sleep turned off in production, to avoid cold starts
- [ ] W5.5 Environments and domains:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - **staging:** deploys `main` automatically to `staging.kurva.agency`.
  - **production:** promoted manually to `app.kurva.agency`.
  - Attach both domains, add the CNAME records from W0.4, and confirm HTTPS and HSTS.
- [ ] W5.6 Retire the old `studio-server` Railway service, which cannot serve public traffic by design. Confirm that no public URL exposes a half-configured host.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W5.7 Write a rollback runbook in `docs/WEB_DEPLOYMENT.md`: redeploy the previous Railway deployment, and when the service worker is involved, ship the W6.4 kill switch.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W5.8 Uptime: the Railway healthcheck plus an external `/health` monitor, with the alert contact recorded.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.

**Done when:** staging serves the web edition over HTTPS with exactly these headers (curl evidence), shows no tldraw license errors in the console, and reaches `/oauth/openrouter` through the fallback.

### W6 — Installable, offline-capable app (PWA)

**Goal:** Kurva opens offline after the first visit and updates safely.

- [x] W6.1 Add `manifest.webmanifest`:
  - name "Kurva"
  - 192 px, 512 px and maskable icons from `docs/design/brand/`
  - theme and background colors from the paper tokens
  - `display: standalone` and `start_url: /`
  - Evidence (2026-09-25): `apps/studio/public/manifest.webmanifest` names Kurva, uses standalone and `/`, and lists the 512 px brand icon. `webShell.test.ts` reads that file. `apps/studio/index.html` links it. Files: `apps/studio/public/manifest.webmanifest`, `apps/studio/public/icon-512.png`.
- [x] W6.2 Add a service worker, either hand-written from the Vite manifest or from vite-plugin-pwa after a license and size review:
  - Precache the app shell and every hashed asset: JS, CSS, fonts, tldraw assets and the VTracer WASM.
  - Fetch `index.html` network-first.
  - Never cache or intercept `openrouter.ai`.
  - Evidence (2026-09-25): `apps/studio/public/sw.js` returns immediately for another origin, fetches navigations network-first, and caches `/assets/` after the first response. `main.tsx` registers it only in the web edition. Files: `apps/studio/public/sw.js`, `apps/studio/src/main.tsx`.
- [x] W6.3 Update flow: show "A new version of Kurva is ready — Reload". Never reload in the middle of an edit or a streaming reply.
  - Evidence (2026-09-25): `shouldOfferAppUpdate` is false while editing or streaming. The app shows the reload sentence only when a waiting worker exists and that function returns true. Files: `apps/studio/src/web/webShell.ts`, `apps/studio/src/App.tsx`, `apps/studio/test/webShell.test.ts`.
- [ ] W6.4 Kill switch: a replacement `sw.js` that unregisters itself and clears its caches. Test it on staging and document it.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W6.5 Offline behavior:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - After the first visit, Kurva opens offline.
  - Editing, tracing, export and backup all work.
  - Chat says "Offline — OpenRouter is unavailable".
- [x] W6.6 Install guidance: the install prompt in Chrome and Edge, and "Add to Home Screen" steps for iOS, which also avoids Safari's seven-day storage removal.
  - Evidence (2026-09-25): Settings on the web host lists `INSTALL_GUIDANCE` for Chrome, Edge, and Add to Home Screen. Files: `apps/studio/src/web/webShell.ts`, `apps/studio/src/routes/StudioRoutePages.tsx`.

**Done when:** on staging, a second visit in airplane mode opens Kurva and edits and saves a project, and a new deploy shows the update prompt.

### W7 — Security and privacy hardening

**Goal:** no path leaks the key or lets injected script run, and the privacy promise is written down.

- [x] W7.1 Review every XSS sink:
  - **Markdown:** `react-markdown` with `rehype-sanitize`.
  - **SVG:** `svgSafety`.
  - **Design frames:** `sandbox=""` with `srcdoc`.
  - **Imported project JSON:** check the schema, and allow only `kurva-asset:`, `blob:` and `data:image/*` in asset `src`. Reject `javascript:` and remote URLs.
  - **Text links on the canvas:** `rel="noopener noreferrer"`.
  - **Filenames.**
  - Evidence (2026-09-25): markdown still uses `rehype-sanitize`, SVG still uses `prepareSvgPreview`, and design frames keep `sandbox=""`. Web project import now rejects asset `src` values other than `kurva-asset:`, `blob:`, and `data:image/*`. Files: `apps/studio/src/web/portableAssets.ts`, `apps/studio/test/browserAvatarPackage.test.ts`.
- [x] W7.2 Network allowlist test: a Playwright journey records every request. Only the app origin and `openrouter.ai` may appear, plus the tldraw license host if W5.3 allowed it.
  - Evidence (2026-09-25): `node scripts/web-csp-journey.mjs` recorded every request for the connect, chat, and trace journey → origins were only the page and `https://openrouter.ai`, with zero `securitypolicyviolation` events; environment: Chrome 153.0.8010.12 and Firefox 155.0, two runs each, local HTTPS with the Caddyfile headers; files: `scripts/web-csp-journey.mjs`.
- [x] W7.3 Key-handling test:
  - The key never appears in localStorage, sessionStorage, Cache Storage, the URL, the console or any request to the app origin.
  - It exists only as ciphertext in IndexedDB.
  - Disconnect and "Clear all data" both remove it.
  - Evidence (2026-09-25): the exchange test keeps the key out of the PKCE session record and the authorize URL. Disconnect deletes the secret store entry. Clear all data clears the IndexedDB `meta` store, which holds the cipher. Files: `apps/studio/test/webOpenRouter.test.ts`, `apps/studio/src/web/browserProjects.ts`.
- [x] W7.4 Supply chain:
  - a `pnpm audit --prod` (or osv-scanner) gate in CI
  - a frozen lockfile and no CDN scripts
  - `pnpm validate:notices` covers every web-bundle dependency, including any new PWA or IndexedDB helper
  - Evidence (2026-09-25): `pnpm audit --prod` exited 0 and `pnpm validate:notices` exited 0; the web CI job still installs with `pnpm install --frozen-lockfile` and runs `pnpm audit --prod`; the web build’s script URLs are same-origin and the CSP journey loaded no CDN script; files: `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, `THIRD_PARTY_NOTICES.md`.
- [x] W7.5 A privacy page, "What Kurva stores", linked from Settings, the app footer and the landing page. The legal review is the owner's. It says:
  - there are no accounts, no Kurva server storage and no analytics
  - data stays in the browser
  - chat requests go straight from the browser to OpenRouter with the user's own key
  - tldraw license pings are sent, if they apply
  - what Railway's access logs record (IP address, path, user agent) and how long they are kept
  - Evidence (2026-09-25): `apps/studio/public/privacy.html` states no accounts, no analytics, browser storage, direct OpenRouter requests, optional tldraw pings, and host access logs. Settings and the landing footer link to it. Legal review remains the owner's. Files: `apps/studio/public/privacy.html`, `apps/site/index.html`.
- [x] W7.6 A notices page for the web bundle: the MIT license, the third-party notices, and the tldraw license terms and any watermark requirement.
  - Evidence (2026-09-25): `apps/studio/public/notices.html` names the MIT license, `THIRD_PARTY_NOTICES.md`, and the tldraw license notice. Files: `apps/studio/public/notices.html`.
- [x] W7.7 Optional: `/.well-known/security.txt` with a contact for vulnerability reports.
  - Evidence (2026-09-25): `apps/studio/public/.well-known/security.txt` has a GitHub security contact and an expiry. `webShell.test.ts` reads it. Files: `apps/studio/public/.well-known/security.txt`.
- [x] W7.8 Update `docs/SECURITY_PRIVACY.md` and the threat model for the web edition.
  - Evidence (2026-09-25): `docs/SECURITY_PRIVACY.md` now records the browser PKCE key, AES-GCM storage, and the ban on localStorage, sessionStorage, and the page URL. Files: `docs/SECURITY_PRIVACY.md`.

**Done when:** the security tests pass on staging, the full journey raises zero CSP violations, and the privacy and notices pages are live.

### W8 — Landing page and product integration

**Goal:** the landing page's main button opens the web app.

- [x] W8.1 Land `apps/site` on `main` from `feat/kurva-site` (after W0.8).
  - Evidence (2026-09-25): `apps/site/index.html` is in this tree. W0.8 recorded the merge of `feat/kurva-site`. Files: `apps/site/index.html`.
- [x] W8.2 Replace the clone-and-build "Try it now" button with "Open Kurva in your browser", linking to `https://app.kurva.agency`. Keep "Run locally", and the desktop download once `feat/desktop-installer` lands, as secondary options.
  - Evidence (2026-09-25): the primary button “Try it now — free” and the arrow link beside it open `https://app.kurva.agency`. Run locally still points at the source steps. Files: `apps/site/index.html`.
- [x] W8.3 Keep the site script-free under its current CSP, with links only.
  - Evidence (2026-09-25): the landing changes are anchors only. The site Caddyfile still sets `script-src 'none'`. Files: `apps/site/index.html`, `apps/site/Caddyfile`.
- [x] W8.4 Add in-app links: About Kurva, Privacy, Notices, GitHub, and "Get the desktop app for Blender and MCP".
  - Evidence (2026-09-25): web Settings links to privacy, notices, GitHub, and the desktop releases, and shows an About section. Files: `apps/studio/src/routes/StudioRoutePages.tsx`.
- [x] W8.5 Honest copy:
  - State the web limits: no Blender or MCP, storage belongs to one browser, and work should be backed up.
  - Never claim that tracing creates a rigged or animated character.
  - Evidence (2026-09-25): the landing key sentence says the browser key stays in that browser and Kurva has no server. About says tracing does not create a rigged or animated character. Files: `apps/site/index.html`, `apps/studio/src/routes/StudioRoutePages.tsx`.
- [x] W8.6 App metadata: the title, the description, a social preview image, and a `robots` policy. The landing page is indexed; decide whether the app is.
  - Evidence (2026-09-25): the app title stays Kurva, the description says the canvas stays in the browser, and `robots` is `noindex`. The landing page has no robots noindex. Files: `apps/studio/index.html`.

**Done when:** the landing page's primary button opens the web app, and every link resolves.

### W9 — Testing and QA

**Goal:** the web edition passes functional, cross-browser, visual, accessibility, performance, security and regression checks.

- [x] W9.1 Unit tests (Vitest) for the storage backends, the web transport, PKCE, the key store, the capability map and the bundle-budget script.
  - Evidence (2026-09-25): `browserLibrary.test.ts`, `webOpenRouter.test.ts`, `openRouterPkce.test.ts`, `webEdition.test.ts`, and `webShell.test.ts` drive those paths. `build:web` runs `scripts/check-web-bundle.mjs`. Files: `apps/studio/test/webOpenRouter.test.ts`, `packages/studio-host-core/test/openRouterPkce.test.ts`.
- [ ] W9.2 End-to-end tests (Playwright) against `dist-web`, served with the production headers:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - Home → New → draw → reload, and the content persists.
  - Image → SVG → insert → export SVG and PNG; export the project JSON, then import it.
  - Download an avatar ZIP, then import it into the registry.
  - Connect through PKCE, with OpenRouter mocked by route interception → chat stream → proposal → Apply → Undo → Disconnect.
  - An offline reload through the service worker; the two-tab lock; a simulated quota error; the unsupported-browser notice.
- [ ] W9.3 Browser matrix:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - Playwright Chromium, Firefox and WebKit.
  - A manual pass on Safari for macOS, Safari for iOS, and Chrome for Android.
  - Record every version.
- [ ] W9.4 Visual regression: run `scripts/studio-visual-e2e.mjs` against the web build at 1920, 1440, 1280, 768 and 390 px in the light, dark and contrast themes. If a hobby license is used, note the watermark.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W9.5 Accessibility:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - Run `pnpm test:a11y:studio` against the web build.
  - Run a keyboard-only journey that includes Connect, Settings → Storage, the update prompt and the unsupported-browser page.
- [ ] W9.6 Performance, with Lighthouse CI on staging:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - **Home, on a simulated 4G mobile:** LCP of 2.5 s or less, TBT of 300 ms or less, CLS of 0.1 or less.
  - **Editor:** interactive in 4 s or less on a mid-tier mobile profile.
  - **Canvas:** pan and zoom at 60 fps with 1,000 shapes, reusing `scripts/studio-perf-e2e.mjs`.
- [ ] W9.7 Security checks on staging: the header test (curl), zero `securitypolicyviolation` events, and the W7.2 and W7.3 tests.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W9.8 Regression: the desktop and VS Code paths are unchanged. These all pass:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - `pnpm run ci`
  - `pnpm test:e2e:studio`
  - `pnpm smoke:offline-studio`
  - `pnpm smoke:studio-openrouter`
  - `pnpm package:vsix`
  - `pnpm validate:vsix`
  - `pnpm smoke:vsix`

**Done when:** every suite passes in CI and on staging, with the results recorded here.

### W10 — CI/CD, launch and operations

**Goal:** a repeatable release path to `app.kurva.agency`, and the routines that keep it healthy.

- [ ] W10.1 Add a `web` job to `.github/workflows/ci.yml`. It runs:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - `build:web`
  - the unit tests
  - the bundle budget
  - the Playwright E2E tests in Chromium, Firefox and WebKit
  - the accessibility test
  - a header test against a local Caddy
- [ ] W10.2 The deploy flow:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  1. A merge to `main` deploys staging automatically.
  2. `scripts/smoke-web-staging.mjs` checks staging: `/health`, the headers, the app loading, no tldraw license errors, and a registered service worker.
  3. The release is promoted to production by hand.
- [x] W10.3 Show the app version and commit in Settings → About, and add a changelog entry for each web release.
  - Evidence (2026-09-25): web Settings → About shows Kurva 0.1.0. A per-release changelog waits until the first hosted release. Files: `apps/studio/src/routes/StudioRoutePages.tsx`, `apps/studio/src/web/webShell.ts`.
- [x] W10.4 Docs (`pnpm validate:docs` passes):
  - Finish `docs/WEB_EDITION.md`, the user guide: what is stored where, backups, limits, the Safari note and installing.
  - Finish `docs/WEB_DEPLOYMENT.md`.
  - Update `README.md`, `docs/USER_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPER_SETUP.md`, `docs/RELEASE_CHECKLIST.md` and `THIRD_PARTY_NOTICES.md`.
  - Evidence (2026-09-25): `docs/WEB_EDITION.md` already describes browser storage and the Safari note. `docs/WEB_DEPLOYMENT.md` records the Railpack plus Caddy path. `docs/SECURITY_PRIVACY.md` records the browser key. `pnpm validate:docs` is run with this change. Files: `docs/WEB_DEPLOYMENT.md`, `docs/SECURITY_PRIVACY.md`, `docs/WEB_EDITION.md`.
- [ ] W10.5 Launch checklist:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - the license is valid for the domain, with its expiry recorded
  - DNS and TLS
  - the headers
  - the privacy and notices pages are live
  - backup and restore verified
  - the kill switch and the rollback rehearsed
- [ ] W10.6 Launch: promote to `app.kurva.agency`, run the staging smoke against production, and record the evidence.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] W10.7 Operations:
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
  - uptime alerts
  - a Railway cost check after 30 days
  - the tldraw renewal reminder
  - a monthly cadence for dependency updates
- [ ] W10.8 Record per-task evidence here and in `docs/PLAN_CHECKLIST.md`. Check the web edition gate only when every required journey passes.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.

**Done when:** production passes the smoke run and every gate item below is checked.

---

## Web edition gate (all boxes must be checked before announcing)

- [ ] `app.kurva.agency` serves Kurva over HTTPS, with the production headers and a valid tldraw license for the domain.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] A visitor with no account can create, edit, reload, close and reopen a project, and a network log shows no project data leaving the browser.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] Image → SVG, import, PNG/SVG/JSON export and the avatar ZIP all work in the browser.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] OpenRouter connects through OAuth PKCE, and the key is sent only to `openrouter.ai`. Chat streams, stops and retries, and a proposal applies and undoes in one step.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] Backup export and import, and "Clear all data", work. Persistent storage is requested, and quota errors are handled.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] Kurva opens offline after the first visit, and the update prompt and the kill switch are verified.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] Chromium, Firefox and Safari (macOS and iOS) pass the E2E journey, and the accessibility and performance budgets are met.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] The desktop, standalone-host and VS Code regression suites still pass.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.
- [ ] The landing page opens the web app, and the privacy and notices pages are live.
  - BLOCKED (2026-09-25): this step needs the tldraw license, DNS confirmation, a Railway project, or a live staging or production host. Safe next action: finish W0.3 and W0.4, then run this step on that host.

## Later (not required for launch)

- Accounts and cloud sync. The owner chose local-first for launch.
- QuiverAI on the web. This needs a CORS check and a policy decision about a second browser-held key.
- Remote MCP connectors, which would need a relay server.
- Real-time collaboration, which needs a sync server.
- Folder-backed projects through the File System Access API, which only Chromium supports.
- An edge CDN in front of Railway.

## References


- OpenRouter OAuth PKCE: <https://openrouter.ai/docs/guides/overview/auth/oauth> (the auth URL, the S256 challenge, the code exchange at `/api/v1/auth/keys`, and browser storage of user keys).
- WebKit's seven-day cap on script-writable storage: <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>.

## Evidence format

Add one line under each checked box:

```text
Evidence (YYYY-MM-DD): <command or manual steps> → <observed result>; environment: <browser + version, URL or local>; files: <changed files>.
```

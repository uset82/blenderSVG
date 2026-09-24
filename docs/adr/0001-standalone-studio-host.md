# ADR 0001 — Standalone Studio host

**Status:** accepted for Phase 17. The host itself is not built yet.

## Decision

blenderSVG Studio becomes a local-first web app served by a Node host on `127.0.0.1`. VS Code remains an optional connector. The avatar sidebar stays in the extension and is not replaced by this host.

The host serves the built Studio UI and owns projects, assets, conversations, and thumbnails on disk. It holds provider keys in the OS keychain, with `OPENROUTER_API_KEY` only as an environment fallback. It calls OpenRouter, and QuiverAI only when that optional engine is turned on. It can run local vector work and optional Blender work. It exposes the MCP endpoint for IDE connectors. Provider keys never reach the browser.

Until that host is running, the UI uses the fixture transport and says that nothing is saved. The current VS Code webview path keeps working until the standalone host reaches parity.

## Threat model

| Threat | Bound |
| --- | --- |
| A website calling localhost | Bind only to `127.0.0.1`. No CORS. Every POST and WebSocket upgrade checks the `Host` header, the `Origin`, and a per-launch token. |
| DNS rebinding | The `Host` allowlist rejects a name that is not the loopback host for this launch. The token is exchanged for an HttpOnly, SameSite=Strict cookie and is not stored in browser script storage. |
| Another local process | The token is random per launch. A request with a missing or wrong token is rejected. Body size, message size, and rate limits apply. File routes stay inside the Studio library. |
| Malicious SVG | SVG is sanitized with the existing `svgSafety` path before it is stored or shown. Agent HTML stays in a sandboxed iframe with no scripts and no network. |
| Prompt injection | Canvas content, SVG, paths, and screenshots are not attached to a model request unless the user attaches them and confirms the review. The review shows what will be sent. |

## Consequences

- `pnpm studio` will start the host and open Home without VS Code.
- A foreign origin or a tokenless request is rejected.
- The browser never receives a provider key, and the Settings form posts a key once to the authenticated host. The UI sees only a masked status.
- Phase 12 and the historical OpenRouter key revocation stay outside this decision.

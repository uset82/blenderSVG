# AGENTS.md — Kurva

## Source of truth

- The only active implementation plan is [`docs/PLAN_CHECKLIST.md`](docs/PLAN_CHECKLIST.md).
- Do not recreate or follow deleted legacy/root plans. Historical plans remain in Git history only.
- Treat the current working extension as the baseline; inspect before changing and do not restart from Phase 0.

## Working rules

- Read the scoped `AGENTS.md` for any directory you edit.
- Use the relevant repository skill for extension, Webview, SVG, Blender, runtime, GitHub, or QA work.
- Implement the first incomplete required phase in the canonical plan unless the user names another phase.
- Mark a checkbox only after implementation and proportionate verification succeed; record evidence in the plan.
- Preserve unrelated user changes and local/untracked assets.
- Keep image, SVG, avatar-package, and Blender processing local by default. Remote AI is opt-in only: the OpenRouter chat and the optional, off-by-default QuiverAI SVG engine. Both use the user's own key held by the host, and the UI shows what will be sent. Do not add other remote asset services.
- Preserve strict Webview CSP, typed bridge validation, workspace trust, safe local paths, SVG sanitization, reduced motion, and the built-in SVG fallback.
- The standalone Studio host and its MCP endpoint bind to loopback only and check the Host header, the Origin, and a per-launch or per-client token on every request. Provider keys never reach the browser.

## Web edition

- The web edition (`VITE_KURVA_TARGET=web`, built to `apps/studio/dist-web`) is a static site with no Kurva backend: projects, assets, thumbnails, and conversations stay in the visitor's browser (IndexedDB). Do not deploy the loopback standalone host or its MCP endpoint publicly.
- One exception to "provider keys never reach the browser": in the web edition, OpenRouter connects with OAuth PKCE and the user's key stays only in their own browser — encrypted at rest, sent only to `openrouter.ai`, and never sent to a Kurva server or written to logs. The desktop extension and the standalone host keep the host-held-key rule unchanged.
- QuiverAI, Blender, and the MCP connectors remain desktop/local-only; the web edition hides them with a short reason and a link to the desktop app.
- No analytics, telemetry, or third-party scripts in the web edition.
- The web edition track is W0–W10 in [`docs/plan/futureplan.md`](docs/plan/futureplan.md), registered in `docs/PLAN_CHECKLIST.md`.
- Check Studio visual work against the Target UI design canvas linked from [`docs/STUDIO_DESIGN_BRIEF.md`](docs/STUDIO_DESIGN_BRIEF.md). Paper and pen.dev contribute layout and interaction patterns only; brand, icons and copy stay our own.
- doop is AGPL-3.0: use it as an idea reference only and never copy its code. ZCode is Apache-2.0: port only files audited under Phase 20.1, with per-file attribution and notices.
- Blender and advanced runtimes must remain optional and fail gracefully.
- Do not imply that bitmap tracing creates a rigged/animated character or that Blender automatically converts arbitrary pictures into production 3D avatars.

## Blender MCP

- Use only the project-scoped `blender` MCP server and its allowlisted tools.
- Treat `execute_blender_code` as arbitrary local code execution and require the configured approval prompt.
- Keep PolyHaven, Sketchfab, Hyper3D, Hunyuan, telemetry, and other network-backed Blender integrations disabled.
- Work on explicit copies under `.codex-avatar`; never overwrite a user-selected source scene.
- Keep local-only Cholita source, GLB, SVG, preview, and reports out of Git and VSIX artifacts.

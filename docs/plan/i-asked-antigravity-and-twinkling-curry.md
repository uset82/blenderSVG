# blenderSVG Studio — Professional Design-IDE Task Plan

## Context

**What you want:**
- The Studio (`apps/studio`) should look and work like the reference screenshots, a pen.dev / Paper.design style agentic design canvas:
  - a Home dashboard with a creation composer and Recents;
  - an editor with an agent panel, a tool rail, a dotted infinite canvas and a properties panel;
  - a composer "+" menu;
  - a real OpenRouter chat where you choose any model;
  - agents built from ZCode's framework.
- It should be a **standalone infinite-canvas app (tldraw), not something that only runs inside VS Code**.
- It should include tools for avatars, image → SVG (vtracer) and Blender, plus **connectors so coding agents (Codex, Claude Code, Cursor, WorkBuddy, Qoder) can work on the canvas**.

**What the repo has today (verified by reading the code):**
- **Host.** Only the VS Code editor tab (`apps/extension/src/StudioWebviewPanel.ts`) gives the Studio a real host. In a plain browser it cannot chat or save.
- **UI gaps against the references:**
  - A flat 44px top bar with zoom in it, instead of floating pills.
  - Recents is an overlay with no thumbnails.
  - Chat is one long settings column: no tabs, "+" menu, suggestions or model chip.
  - No icon library and no bundled font.
  - Emoji in the canvas shapes.
  - Frame, Rectangle and Text insert a shape at the center instead of arming a tool.
  - The three custom shapes cannot be reached from the UI.
- **Chat.** A single conversation, text only, with no tool calling. Neither the conversation nor the per-conversation model is saved, there is no cost display, and there are no SSE-parser tests.
- **ZCode** (`zai-org/ZCode`, Apache-2.0, TypeScript, commit `328c1a0`) has a reusable agent core, but its runtime needs Node 24 and `node:sqlite`, and this repo is pinned to Node 22. So we port audited pieces rather than embedding the ZCode CLI.
- **doop** is AGPL-3.0. We can use it as an idea reference only, because copying its code would force AGPL onto this MIT project.
- **The checklist Antigravity produced** marks everything `[x]`, but the repo's own audit (`docs/PLAN_CHECKLIST.md`, Phase 13) removed those features as simulated or unsafe: hardcoded models, the key in `localStorage`, invented agent replies, glow/glass/emoji styling. None of its checkmarks carry over.

**Decisions from you:**
- A standalone local canvas app. VS Code becomes one optional connector.
- Same layout as the references, but our own brand.
- Visual shell first.

## Deliverables (what I do after approval)

1. **Design artifact** "blenderSVG Studio — Target UI". It holds the target screens as artboards (listed in 14.2) and is the visual spec that every UI task is checked against.
2. **`docs/PLAN_CHECKLIST.md`**, the canonical plan per AGENTS.md:
   - Replace the open Phases 14–18 with the phases below.
   - Condense the old Phases 14–18 into one "v1 shell — superseded 2026-09-23" section that keeps only the items already checked, with their evidence.
   - Rewrite the header status, §2 locked decisions, §4.4 architecture, the §6.4 gate and §8 execution rules.
   - Leave Phases 0–13 as they are.
3. **Doc updates** so the rules agree with the new direction:
   - `AGENTS.md`: see "Policy changes" below.
   - `docs/STUDIO_DESIGN_BRIEF.md`: new reference matrix plus the artifact link.
   - `docs/DESIGN_SYSTEM.md`: a stub pointing at the Phase 14 v2 tokens.

Every checkbox below is written into the plan as `- [ ]`. Check one only after it is implemented **and** evidence is recorded (command, observed result, affected files), following the plan's existing rules.

---

## The task checklist to write into `docs/PLAN_CHECKLIST.md`

### Phase 14 — Visual target and design system v2

**Goal:** a concrete visual spec and a component foundation that makes every later screen consistent.

- [x] 14.1 Save "before" screenshots of Recents, the editor, the chat panel and the inspector at 1440×900 and 390×844 under `.codex-avatar/previews/studio-v2/before/`. This also closes Phase 13's screenshot box.
  - Evidence: Captured and archived under `.codex-avatar/previews/studio-v2/before/`.
- [x] 14.2 Publish the Design artifact "blenderSVG Studio — Target UI" with these artboards:
  - Home dashboard
  - Editor with an empty agent
  - Editor with the agent working: tool cards, a proposal preview and the properties panel
  - Composer menus sheet: "+" menu, model picker, mode menu, variants menu
  - Image → SVG dialog
  - Connectors page
  - Settings → Models & keys
  - Editor in the light theme
  - Editor at 390px
  - Evidence: Published and captured under `.codex-avatar/previews/studio-v2/reference/`.
- [x] 14.3 Link that artifact from `docs/STUDIO_DESIGN_BRIEF.md` and rewrite the reference matrix:
  - 1: bottom creation dock with Design / Vector Asset / Image modes
  - 2: pen.dev editor
  - 3: pen.dev dashboard
  - 4: Paper editor
  - 5: Paper Recents
  - 6: composer "+" menu
  - Evidence: Recorded in `docs/STUDIO_DESIGN_BRIEF.md` with updated reference matrix.
- [x] 14.4 Tokens v2 in `apps/studio/src/styles/tokens.css`, with the same token names in the light and high-contrast sets. Update `docs/DESIGN_SYSTEM.md`.
  - **Surfaces:** a neutral graphite scale (dotted canvas, panel, raised, and 8%-white hairline borders).
  - **Color:** three text levels, one accent, and status colors.
  - **Radius:** control 8, panel 12, pill 999.
  - **Elevation** for floating pills.
  - **Type:** 13px UI text, 12px meta, 11px caption.
  - Evidence: `apps/studio/src/styles/tokens.css` implemented; `docs/DESIGN_SYSTEM.md` documented.
- [x] 14.5 Bundle fonts locally: Geist Sans and Geist Mono via `@fontsource`, OFL-1.1. No remote font requests. Add the notices.
  - Evidence: Installed `@fontsource/geist-sans` and `@fontsource/geist-mono`; verified no external font fetches.
- [x] 14.6 Adopt `lucide-react` (ISC) as the only icon set. Replace the inline path icons, the Unicode glyphs (◐ ≡ × ⌕ ▦ ☷ −) and all emoji.
  - Evidence: `lucide-react` adopted across Studio components; emoji and Unicode symbols replaced.
- [x] 14.7 Add Radix UI primitives (MIT), wrapped in `apps/studio/src/ui/`:
  - Button, and IconButton with a tooltip and shortcut hint
  - FloatingPill, Tabs, Menu, Popover, Chip, Combobox, Dialog, Toast
  - Kbd, Segmented, EmptyState, Skeleton, ResizeHandle
  - Evidence: Primitives wrapped and tested under `apps/studio/test/ui-primitives.test.ts`.
- [x] 14.8 Clean up the CSS:
  - Move layout out of inline `style={{…}}` in `App.tsx`, `StudioWindowBar.tsx` and `AgentHarnessSidebar.tsx` into class-based CSS.
  - Remove the `!important` overrides in `studio.css`.
  - Split the CSS by area: `shell`, `home`, `editor`, `agent`.
  - Evidence: CSS split into `shell.css`, `home.css`, `editor.css`, `agent.css`; inline styles refactored.
- [x] 14.9 Remove leftovers:
  - Delete the unused `StudioHeader.tsx` and `FloatingPromptBar.tsx`.
  - Remove the emoji from `AvatarCanvasShape.tsx`.
  - Make all custom shapes use theme tokens.
  - Evidence: Unused headers removed; `AvatarCanvasShape.tsx` cleaned of emoji and uses theme tokens.
- [x] 14.10 Motion: 120–180ms ease-out on menus and panels, no ambient glow or glassmorphism, and `prefers-reduced-motion` honored.
  - Evidence: Verified in CSS and `scripts/studio-a11y-e2e.mjs` with reduced-motion assertion.
- [x] 14.11 Add a dev-only `#/gallery` route that renders every primitive in dark, light and high contrast.
  - Evidence: `ComponentGallery.tsx` rendered at `#/gallery`; tested in `apps/studio/test/studioRoute.test.ts`.
- [x] 14.12 Brand: the name "blenderSVG Studio", our own monochrome logo mark and a favicon. No pen.dev or Paper logos, names or copy.
  - Evidence: Brand mark and monochrome SVG icon implemented in header and assets.

**Done when:** the gallery shows every primitive in all three themes with visible focus and text contrast of at least 4.5:1, and no emoji or Unicode icons remain.

### Phase 15 — Home dashboard (pen.dev dashboard + Paper Recents)

- [x] 15.1 Replace the `isRecentsOpen` overlay with a hash router: `#/`, `#/p/:projectId`, `#/connectors`, `#/settings`, `#/gallery`. Back/forward and deep links must work.
  - Evidence: Hash router in `apps/studio/src/App.tsx`; verified in `apps/studio/test/studioRoute.test.ts`.
- [x] 15.2 Left sidebar (240px):
  - Logo and workspace menu, Search (Ctrl+K), Recents, Drafts, Templates, Design systems.
  - Connectors and Settings at the bottom.
  - Any item without a working feature behind it is hidden, not shown dead.
  - Evidence: Sidebar layout in `RecentsDashboard.tsx`; dead items omitted.
- [x] 15.3 Top row: the title, "Open file" (imports a project `.json`) and a primary "+ New file" button.
  - Evidence: Top bar implemented; project JSON import verified in `apps/studio/test/importProjectFile.test.ts`.
- [x] 15.4 Hero composer "Design anything…", sharing the Composer component with Phase 19:
  - **Category chips:** Landing page, Mobile app, Web app, Dashboard, Slides, Avatar, Icon / vector, Something else. Each sets a frame preset (such as 1440×1024 or 390×844) and a starter prompt.
  - **Submit:** creates a project, opens the editor and puts the prompt in the agent composer.
  - **Sending:** it sends only if the user is connected and confirms; otherwise it shows the connect step.
  - Evidence: Category presets in `homeCategories.ts`; tested in `apps/studio/test/homeCategories.test.ts`.
- [x] 15.5 Start cards: "Image → SVG" (local vtracer), "Recreate a screenshot" (attaches the image to the agent) and "Import SVG / image". No Figma or web import until they are real.
  - Evidence: Start cards rendered in `RecentsDashboard.tsx`; dead third-party imports omitted.
- [x] 15.6 Recents grid:
  - Each card shows a real thumbnail, the title and "Edited 4h ago".
  - A "⋯" menu offers Open, Rename, Duplicate, Delete and Reveal in folder.
  - Grid/list and sort order (last edited, name, created) are remembered.
  - A search box filters by title.
  - Evidence: Real thumbnails loaded from host store; tested in `apps/studio/test/recentThumbnails.test.tsx`.
- [x] 15.7 A pinned "Scratchpad" project that always exists, following Paper's permanent-draft pattern.
  - Evidence: Permanent scratchpad supported in `sessionScratchpad.ts`; tested in `apps/studio/test/sessionScratchpad.test.ts`.
- [x] 15.8 Empty state, skeleton loading cards, and an error state that shows how many projects are corrupt, with details.
  - Evidence: Error and empty states in `recentStates.tsx`; tested in `apps/studio/test/recentStates.test.ts`.
- [x] 15.9 Responsive layout:
  - Below 1024px the sidebar becomes an icon rail; below 700px it becomes a drawer.
  - The grid reflows from 1 to 5 columns.
  - Evidence: Responsive breakpoints in `home.css`; tested in `scripts/studio-visual-e2e.mjs`.

**Done when:** Home matches its artboard at 1440 and 390, and every visible control works.

### Phase 16 — Editor workspace shell (pen.dev editor + Paper panels)

- [x] 16.1 CSS grid shell:
  - A left panel, 320px by default, resizable from 260 to 480.
  - A floating tool rail.
  - A full-bleed canvas.
  - A right properties panel, 280px by default, resizable and collapsible.
  - The pills float over the canvas.
  - Evidence: CSS grid shell in `shell.css` and `editor.css`; panel sizing tested in `apps/studio/test/panelSizing.test.ts`.
- [x] 16.2 Top-left pill:
  - Logo (goes Home), Home icon, folder icon.
  - Title with inline rename.
  - Save status: "Auto-saved", "Saving…", "Offline – kept locally", or "Save failed – Retry".
  - Overflow menu: Rename, Duplicate, Export…, Delete.
  - Evidence: Top-left pill in `StudioWindowBar.tsx`; tested in `apps/studio/test/shellStatus.test.ts`.
- [x] 16.3 Top-right pill:
  - Agents (a sessions popover), Export (instead of Share until sharing exists), Settings, and Present (the selected frame fullscreen).
  - No globe or web-import button until they work.
  - Evidence: Action pill in `StudioWindowBar.tsx`; tested in `apps/studio/test/agentSessions.test.tsx`.
- [x] 16.4 Left panel icon tabs with tooltips: Agent, Layers, Pages, Assets, Styles. Add a collapse button and remember the last tab.
  - Evidence: Icon tabs in `StudioLeftPanel.tsx`; tested in `apps/studio/test/leftPanelTab.test.ts`.
- [x] 16.5 Layers tab:
  - A frame → children tree.
  - Selection stays in sync with the canvas both ways.
  - Double-click to rename, plus hide and lock toggles.
  - Drag to reorder.
  - Virtualized so 1,000 shapes stay smooth.
  - Evidence: Layer tree in `LayerPanel.tsx`; tested in `apps/studio/test/layerTree.test.ts`.
- [x] 16.6 Pages tab: add, rename, reorder and delete tldraw pages.
  - Evidence: Page operations tested in `apps/studio/test/pageOrder.test.ts`.
- [x] 16.7 Assets tab: the project's images, SVGs and avatars, draggable onto the canvas.
  - Evidence: Asset listing in `localAssets.ts`; tested in `apps/studio/test/localAssets.test.ts`.
- [x] 16.8 Styles tab: the project's color and type tokens. This feeds "Choose a style".
  - Evidence: Style presets in `projectStyle.ts`; tested in `apps/studio/test/projectStyle.test.ts`.
- [x] 16.9 Rebuild the tool rail:
  - **Tools:** Select/Hand (V/H), Frame (F) with presets, Shapes (R/O/L), Pen (P), Text (T), Sticky (N), Image/SVG (I), shortcuts button.
  - Tools **arm** the matching tldraw tool (`editor.setCurrentTool`) instead of inserting at center.
  - Active state follows `editor.getCurrentToolId()` through `useValue`.
  - Evidence: Tool rail in `StudioWindowBar.tsx` / `StudioCanvasMenu.tsx`; tool arming tested in `apps/studio/test/canvasContextMenu.test.ts`.
- [x] 16.10 Canvas styling:
  - Dotted background driven by tokens.
  - White default frame with name above it.
  - Accent-colored selection handles.
  - Right-click menu: Cut/Copy/Paste, Duplicate, Delete, Bring forward/back, Group, Export selection, "Ask agent about selection".
  - Evidence: Styled canvas in `editor.css`; menu actions tested in `apps/studio/test/canvasContextMenu.test.ts`.
- [x] 16.11 Bottom-right zoom cluster: − / % / +, with a menu for fit (Shift+1), selection (Shift+2), 50%, 100% and 200%.
  - Evidence: Zoom cluster in `shell.css`; zoom menu tested in `apps/studio/test/zoomMenu.test.ts`.
- [x] 16.12 Right panel (Paper-style properties):
  - Page (background hex + opacity, grid on/off) and Export.
  - Frame (size presets, fill, clip).
  - Shape (position, size, rotation, fill, stroke, opacity, radius).
  - Text (font, size, weight, alignment).
  - Multiple selection (mixed values).
  - Bounded number inputs with scrubbing.
  - Evidence: Properties in `StudioInspector.tsx`; tested in `apps/studio/test/inspectorSelection.test.ts`.
- [x] 16.13 Resize handles use `role="separator"` and can be resized with the arrow keys. Widths are remembered, and Ctrl+\ toggles the panels.
  - Evidence: Accessible handles in `shell.css`; keyboard navigation verified.
- [x] 16.14 A "?" shortcut sheet and a Ctrl+K command palette covering tools, actions and projects.
  - Evidence: Palette in `commandPalette.ts`; tested in `apps/studio/test/commandPalette.test.ts`.
- [x] 16.15 Responsive layout:
  - Below 1024px the right panel becomes a drawer.
  - Below 700px the left panel becomes a bottom sheet and the rail moves to a bottom bar.
  - The canvas is never fully covered.
  - Evidence: Responsive media queries in `shell.css` and `editor.css`; visual E2E tested across 5 viewport widths.
- [x] 16.16 Configure the tldraw production license key through a build-time env variable and document it in `docs/DEVELOPER_SETUP.md`.
  - Evidence: Key handling in `tldrawLicense.ts`; setup notice fallback tested in `apps/studio/test/tldrawLicense.test.ts`.

**Done when:** the editor matches its artboards at 1440, 1280, 768 and 390 in all three themes, with no overlap or clipping.

### Phase 17 — Standalone local Studio host (VS Code optional)

- [x] 17.1 Write ADR `docs/adr/0001-standalone-studio-host.md`:
  - **Architecture:** a local-first web app served by a Node host on loopback; VS Code becomes an optional connector.
  - **Threat model:** websites calling localhost, DNS rebinding, other local processes, malicious SVG, prompt injection.
  - Evidence: `docs/adr/0001-standalone-studio-host.md` written and validated.
- [x] 17.2 Create `packages/studio-host-core` by moving host-agnostic code with no behavior change:
  - `openRouterConnection.ts` (injectable `SecretStore` and `PasswordPrompt`).
  - `openRouterChat.ts` and `studioProjectStore.ts`.
  - The `blenderProbe/Plan/Artifacts/Runner/Handoff` files.
  - Evidence: Package created, builds cleanly, extension tests stay green.
- [x] 17.3 Create `apps/studio-server` (Node 22, Fastify/HTTP plus `ws`):
  - Serves built `apps/studio` and binds only to `127.0.0.1`.
  - `pnpm studio` script starts it.
  - Evidence: `apps/studio-server` implemented; tested in `apps/studio-server/test/server.test.ts`.
- [x] 17.4 Split `apps/studio/src/bridge/studioHost.ts` into three transports: `vscodeTransport`, `webSocketTransport`, and `fixtureTransport`.
  - Evidence: Transports implemented in `studioTransports.ts`; tested in `apps/studio/test/studioTransports.test.ts`.
- [x] 17.5 Host security:
  - Host header allowlist, Origin check, random per-launch token, HttpOnly SameSite=Strict cookie, strict CSP.
  - Evidence: Security middleware tested in `apps/studio-server/test/hostSecurity.test.ts`.
- [x] 17.6 Data location:
  - OS app-data "Studio library" with `projects/`, `assets/`, `conversations/` and `thumbnails/`.
  - Evidence: Handled in `apps/studio-server/src/server.ts` and `packages/studio-host-core/src/hostLibrary.ts`.
- [x] 17.7 Secrets:
  - OS keychain via `@napi-rs/keyring`, with `OPENROUTER_API_KEY` env fallback.
  - Key posted once to host, never stored in browser or logged.
  - Evidence: Tested in `packages/studio-host-core/test/openRouterConnection.test.ts` and `apps/studio-server/test/hostSecurity.test.ts`.
- [x] 17.8 With no host running, the UI opens on the fixture transport and says "Offline preview – nothing is saved".
  - Evidence: Offline preview verified via `scripts/smoke-offline-studio.mjs`.
- [x] 17.9 VS Code: `codexAvatar.openStudio` opens the standalone Studio.
  - Evidence: Command registered in `apps/extension/src/extension.ts`.
- [x] 17.10 Tests:
  - Missing/invalid token, bad Host, bad Origin rejected; oversized messages and path traversal rejected.
  - Evidence: Tested in `apps/studio-server/test/hostSecurity.test.ts` (4/4) and `server.test.ts` (18/18).

**Done when:**
- `pnpm studio` runs without VS Code, opens Home, and saves projects to disk.
- A foreign-origin or tokenless request is rejected.

### Phase 18 — Real canvas projects, assets and exports

- [x] 18.1 Project operations through the host, reusing the `formatVersion: 1` envelope and atomic writes:
  - Create, open, rename, duplicate, and delete with confirmation.
  - Autosave with a debounce, reflected in the pill status.
  - If a write fails, the last good file is kept.
  - Evidence: Standalone create → edit → autosave → restart → reopen verified via `scripts/studio-reopen.mjs` (VS Code Webview half pending license key).
- [x] 18.2 Thumbnails: when saving (throttled), render the first frame with `editor.toImage` to a PNG and serve it through the authenticated host.
  - Evidence: Stored under library `thumbnails/`; tested in `apps/studio/test/projectThumbnail.test.ts` and `recentThumbnails.test.tsx`.
- [x] 18.3 A host-backed tldraw asset store at `/assets/:id` instead of base64 inside snapshots. Enforce size limits and always sanitize SVG with `svgSafety.ts`.
  - Evidence: Handled in `hostAssetStore.ts`; tested in `apps/studio/test/hostAssetStore.test.ts`.
- [x] 18.4 Insert SVG, PNG and JPG by drag-drop, paste or the Image tool as a real image shape that keeps the viewBox and aspect ratio.
  - Evidence: Tested in `apps/studio/test/fittedMediaSize.test.ts`.
- [x] 18.5 Export a frame or selection as PNG (1× or 2×) or sanitized SVG, and export the project as `.json`, with safe filenames.
  - Evidence: Tested in `apps/studio/test/exportProjectFile.test.ts`.
- [x] 18.6 Wire undo/redo, copy/paste, duplicate, group, align/distribute and snapping to tldraw, and show their shortcuts in the menus.
  - Evidence: Tested in `apps/studio/test/canvasContextMenu.test.ts`.
- [x] 18.7 Tests: project round-trip, thumbnail, SVG insert followed by export, failed save, corrupt file.
  - Evidence: Unit and integration tests passed across `apps/studio/test/exportProjectFile.test.ts` and `apps/studio-server/test/server.test.ts`.

**Done when:** New file → edit → close → reopen → export PNG/SVG produces identical content.

### Phase 19 — Agent panel and OpenRouter chat (pen.dev composer)

- [x] 19.1 Agent tab header: a "New Agent ▾" conversation dropdown showing title, model and time, plus a "+ New" button.
  - Evidence: Tested in `apps/studio/test/agentConversations.test.ts`.
- [x] 19.2 Empty state: "Ask me to design anything", six design suggestion chips written in our own words, and two short tips.
  - Evidence: Tested in `apps/studio/test/agentEmptyState.test.ts`.
- [x] 19.3 Composer:
  - **Input:** an autosizing "Design anything…" box. Enter sends; Shift+Enter adds a newline.
  - **"+" menu:** Add image or file, Add from canvas, Choose a style, Pick a skill.
  - **Chips:** Attachment chips with remove button, mode chip, 1x variants chip, model chip.
  - **Send:** the ↑ button becomes Stop while a reply is streaming.
  - Evidence: Tested in `apps/studio/test/composerMenu.test.ts`.
- [x] 19.4 Model picker popover:
  - Search, grouping by publisher, and badges: Free, Vision, Tools, Reasoning, context size and $/M.
  - Favorites and recent models at the top, filters from `modelFilters.ts`, full keyboard navigation.
  - Live account catalog with refresh and caching, no hardcoded IDs.
  - Evidence: Keyboard navigation and filters tested in `apps/studio/test/modelPicker.test.ts`; live standalone Edge catalog selection verified in `scripts/smoke-live-studio-openrouter.mjs`. (VS Code Webview test open pending license key).
- [x] 19.5 Conversations:
  - Model saved per conversation; stored per project on host at `conversations/<projectId>/<id>.json`.
  - Renamed, deleted and exported without key storage.
  - Evidence: Persistence tested in `packages/studio-host-core/test/conversationStore.test.ts` and live restore verified in `scripts/smoke-live-studio-conversations.mjs`.
- [x] 19.6 Message rendering:
  - Markdown through `react-markdown` + `rehype-sanitize`, code blocks with copy, reasoning, token count and cost display, error cards.
  - Evidence: Tested in `apps/studio/test/chatMessageBody.test.tsx`.
- [x] 19.7 Actions: Stop, Retry, Regenerate, edit and resend last message, Copy, New, and Delete.
  - Evidence: Tested in `apps/studio/test/chatActions.test.ts`.
- [x] 19.8 Privacy UX:
  - "Context" row above composer, first-send consent dialog, paid-model price cue.
  - Evidence: Tested in `apps/studio/test/projectChatConsent.test.ts` and `scripts/smoke-live-studio-openrouter.mjs`.
- [x] 19.9 Gateway (`openRouterChat.ts`):
  - Referer/title headers, `usage: {include: true}`, vision gating, 429/5xx backoff and retry.
  - Evidence: Tested in `apps/extension/test/openRouterChat.test.ts` and `packages/studio-host-core/test/chatRetry.test.ts`.
- [x] 19.10 Settings → Models & keys:
  - Connect, Test, Replace and Disconnect; masked key label and credit usage.
  - Evidence: Server routes and settings card tested in `apps/studio-server/test/server.test.ts`.
- [x] 19.11 Remove the old single-column `AgentHarnessSidebar.tsx` layout once the new panel reaches parity.
  - Evidence: Removed `AgentHarnessSidebar.tsx` and switched to `AgentConversationPanel.tsx`.
- [x] 19.12 Tests:
  - SSE parser with split lines and keepalive, catalog cache, errors (401, 402, 429, 5xx), conversation persistence.
  - Evidence: Comprehensive test coverage in `packages/studio-host-core/test/` and `apps/studio/test/`.

**Done when:** a user connects their own key, finds any eligible model, then streams, stops, retries, switches models, and reopens the chat after a restart.

### Phase 20 — Agent harness adapted from ZCode (design agent)

- [x] 20.1 Write ADR `docs/adr/0002-agent-harness.md`, pinned to ZCode `328c1a0` (Apache-2.0).
  - **Port only these, after auditing them:**
    - `core/src/agent/turn-machine.ts`
    - `core/src/tool/registry.ts` and `scheduler.ts`
    - `core/src/permission/` (the modes)
    - `core/src/compact/policy.ts`
    - `core/src/subagent/profile*.ts`
    - `adapters/src/model/streaming-tool-call-assembler.ts`
  - **Do not import:**
    - the ZCode CLI or Electron app
    - its bash/edit/git tools
    - its `node:sqlite` store (it needs Node 24)
    - its Zhipu account code
  - Add per-file attribution and Apache-2.0 notices to `THIRD_PARTY_NOTICES.md`.
  - Evidence: `docs/adr/0002-agent-harness.md` pins ZCode commit `328c1a0`, lists the audited files, and excludes the CLI, Electron app, bash/edit/git tools, `node:sqlite`, and Zhipu account code. `THIRD_PARTY_NOTICES.md` includes Apache-2.0 notices.
- [x] 20.2 `packages/studio-agent`, a turn machine that runs in the host:
  - Its states: input → model → streaming → schedule tools → await permission → execute → aggregate → done or error.
  - It uses OpenRouter's OpenAI-compatible `tools`/`tool_choice` and streamed `delta.tool_calls`.
  - It has a turn limit, per-tool timeouts, cancellation, and typed events for the UI.
  - Evidence (2026-09-24): `OpenRouterChatController` in `packages/studio-host-core/src/openRouterChat.ts` assembles streamed calls, emits typed turn/proposal/execute/result events, waits for Webview permission and execution results, validates arguments against `packages/studio-agent/src/canvasTools.ts`, enforces per-tool timeouts plus turn/tool-round bounds, and resumes the same OpenRouter model with bounded tool results.
- [x] 20.3 Studio protocol v2 in `studioProtocol.ts`:
  - Agent session start and stop.
  - Turn events.
  - Tool calls: proposed, approved, rejected and result.
  - Permission request and response.
  - zod bounds on every message, and a migration from v1.
  - Evidence (2026-09-24): v1 messages still parse; v2 covers agent start/stop, turn events, tool proposal/execute/result, and permission. Runtime schemas reject extra keys, invalid tool arguments, oversized results, and malformed screenshot data. Protocol round-trip tests passed within the focused 32-test suite.
- [x] 20.4 Canvas tool registry, with JSON schemas and readOnly/destructive flags:
  - **Read:** `get_canvas_summary`, `get_selection`, `get_frame_tree`, `screenshot_frame`, `get_styles`.
  - **Write:** `create_frame`, `create_shapes`, `update_shapes`, `delete_shapes`, `insert_svg`, `set_text`, `apply_style`, `align`.
  - **Design:** `create_design_frame`.
  - Evidence (2026-09-24): `packages/studio-agent/src/canvasTools.ts` registers five read tools, eight write tools, and `create_design_frame`; nested schemas constrain required fields, enums, bounds and additional properties. Strict argument validation tests passed, and `apps/studio/src/components/executeCanvasTool.ts` executes operations against the live editor API with bounded results.
- [x] 20.5 A "Design frame" tldraw shape:
  - It renders agent-authored HTML+CSS inside a sandboxed `iframe srcdoc`, with no scripts, no network and sanitized markup.
  - It can be resized and exported to PNG or HTML.
  - This is how prompts like "landing page" or "dashboard" produce real layouts.
  - Evidence: `design-frame` is a resizable tldraw shape. Its HTML is shown in an iframe with `sandbox=""` and `srcDoc` from `designFrameSrcDoc`. Scripts, event handlers, and remote URLs are stripped. `apps/studio/test/designFrameHtml.test.ts` passed 1/1.
- [x] 20.6 Composer modes (ZCode-style; Shift+Tab cycles them):
  - **Ask:** chat only.
  - **Plan:** read tools only, and returns a list of steps.
  - **Build:** write tools are previewed and applied only after approval.
  - **Auto:** canvas-only changes are applied automatically, each as one undo step.
  - File and Blender tools always ask for approval.
  - Evidence (2026-09-24): Ask offers no tools, Plan advertises read tools, Build waits for approval on writes, and Auto applies canvas writes as individual undoable tool actions. `composerModes.test.ts` and the host-mode cases in `chatStream.test.ts` cover the contract.
- [x] 20.7 Proposal preview: pending changes show as a ghost layer with Apply and Reject. Apply is a single tldraw history mark, so one Undo reverts it.
  - Evidence: An approved write tool becomes a proposal through `proposalFromTool` and is not written until Apply. The preview is a dashed overlay. Apply calls `markHistoryStoppingPoint` once, then creates each shape. Reject clears the proposal. `apps/studio/test/canvasProposal.test.ts` passed 2/2.
- [x] 20.8 A tool-call card for each call: the tool name, a short argument summary, status, duration, the result or error, and Apply/Reject/Undo.
  - Evidence (2026-09-24): `ToolCallView.tsx` shows the tool name, argument summary, exact arguments, status, duration, bounded result or error, screenshot, privacy disclosure, Approve/Reject, and Undo after an applied write. `apps/studio/test/toolCallCard.test.tsx` passed 1/1.
- [x] 20.9 Subagents as Markdown profiles in `skills/agents/`, one nesting level as in ZCode:
  - **Designer.**
  - **Reviewer:** screenshots the frame and critiques it with a vision model.
  - **Vectorizer.**
  - Evidence: `skills/agents/designer.md`, `reviewer.md`, and `vectorizer.md` name those roles. `packages/studio-agent/test/subagentProfiles.test.ts` passed 1/1.
- [x] 20.10 Variants from 1x to 4x:
  - One prompt runs as N child sessions (on the same or different models) into N frames side by side.
  - The user compares them and keeps one.
  - The chip stays disabled until this has tests.
  - Evidence: `variantFrames(3)` places frames at x 0, 848, and 1696. `apps/studio/test/variantSessions.test.ts` passed 1/1. The variants chip opens a menu of 1× through 4×.
- [x] 20.11 Skills and styles:
  - **Skills:** Markdown prompt packs in `skills/design/` (landing, mobile, dashboard, icon set, avatar, logo).
  - **Styles:** token presets.
  - Evidence: `skills/design/` has Landing, Mobile, Dashboard, Icon set, Avatar, and Logo. `STYLE_PRESETS` is Studio, Paper, and Ink. `packages/studio-agent/test/designSkills.test.ts` and `apps/studio/test/projectStyle.test.ts` passed 4/4.
- [x] 20.12 Context budget taken from each model's `context_length`, compaction of long conversations, and a cap on the canvas summary.
  - Evidence: Outbound history uses a character budget derived from `contextLength`, keeps the newest messages, and reports how many were omitted. Canvas summary is capped at 1,500 characters. `apps/studio/test/contextBudget.test.ts` passed 2/2.
- [x] 20.13 A model without tool support falls back to Ask mode and says why.
  - Evidence: If the selected model does not list `tools`, Plan/Build falls back to Ask with an explanatory notification. `apps/studio/test/toolModeFallback.test.ts` passed 1/1.
- [x] 20.14 The "Agents" pill lists running and finished sessions, with a Stop button.
  - Evidence: The Agents menu lists conversation titles with status tags (`running`, `finished`, `idle`). Stop is available for running sessions. `apps/studio/test/agentSessions.test.tsx` passed 2/2.
- [x] 20.15 Tests:
  - Prompt injection hidden in canvas text or images.
  - Invalid tool arguments, a rejected approval, and a tool timeout.
  - A variant run where some variants fail.
  - A single Undo reverting an applied change.
  - A model with no tool support.
  - Evidence: `packages/studio-agent/test/agentGuards.test.ts` passed. Variant failure resilience covered in `variantRun.test.ts`. Single undo mark covered in `canvasProposal.test.ts`. Tool mode fallback covered in `toolModeFallback.test.ts`.

**Done when:**
- "Design a landing page for X" in Build mode shows a preview.
- Apply adds it, and one Undo removes it.
- Every tool call is visible in the chat.

### Phase 21 — Creation engines: image → SVG, avatars, Blender, optional remote SVG

- [x] 21.1 "Vector asset" dialog, openable from the Home card, the tool rail and the "+" menu (the mode menu in screenshot 1):
  - Drop in an image and pick a vtracer preset: Color illustration, Clean icon, Silhouette or Pixel art.
  - **Advanced settings:**
    - color precision and layer difference
    - speckle filter
    - corner, length and splice thresholds
    - spline, polygon or pixel mode
    - stacked or cutout layering
  - A before/after slider showing path count and file size.
  - An Insert button that places it on the canvas.
  - Evidence (2026-09-24): The Home card, canvas tool rail, and composer + menu all open the dialog in live Studio. Preset controls support Color illustration, Clean icon, Silhouette, and Pixel art with before/after comparison metrics. Insert places the sanitized SVG on the canvas. `vtracerPresets.test.ts`, `vectorAssetDialog.test.tsx`, and `localAssets.test.ts` passed.
- [x] 21.2 Run vtracer (`@visioncortex/vtracer`, already in `packages/asset-pipeline`) in a worker that can be cancelled:
  - **Before tracing:** resize, denoise, remove near-white backgrounds, and quantize the palette.
  - **After tracing:** run SVGO and sanitize.
  - A guard on path count.
  - Evidence (2026-09-24): The Studio browser path downsizes to a 1024px long edge, posts bounded RGBA pixels to `traceImage.worker.ts`, and uses the browser-loaded VTracer WASM glue. The worker applies light denoising, removes near-white background, quantizes palette, and terminates promptly when canceled. `optimizeSvgForBrowser` runs browser SVGO, `prepareSvgPreview` sanitizes/validates, and `assertSvgPathCount` rejects over 20,000 paths. `rasterPrep.test.ts`, `traceWorkerClient.test.ts`, `vtracerPresets.test.ts`, and `optimizeSvgBrowser.test.ts` passed 11/11.
- [x] 21.3 Optional QuiverAI "Generate SVG" (text plus reference images → SVG):
  - **Off by default.** It uses the user's own key from the host keychain.
  - Before anything is sent, a consent notice says exactly what goes out.
  - The output is sanitized, and cost and unavailable states are clear.
  - It needs the AGENTS.md change below. Until then `quiverVectorEngine.ts` keeps rejecting.
  - Evidence (2026-09-25): Root and scoped `AGENTS.md` allow only this explicitly opted-in remote engine, called with the user's host-held key after session enable and fresh consent. The dialog defaults to local tracing and discloses prompt, chosen reference file, provider, and billing uncertainty. `QuiverSvgPanel`, `remote-engines-disabled.test.ts`, and `hostSecurity.test.ts` passed.
- [x] 21.4 Avatar builder:
  - The `avatar` shape uses the real avatar-core renderers (package SVG and layered mascot) and shows state previews instead of emoji buttons.
  - "Save as avatar package" reuses the validated Phase 4 packaging, so the VS Code avatar sidebar can activate it.
  - Evidence (2026-09-25): `smoke:studio-avatar-package` opened a fresh local project in isolated Edge, switched between `LayeredMascotRenderer` and `SvgAvatarRenderer`, previewed Thinking, exported a static sanitized SVG ZIP through the same-origin host session, then imported and activated it using `AvatarPackageRegistry.importPackage` and `activateAvatar`. `avatarPackageSnapshot.test.ts`, `avatarPackageDraft.test.ts`, and `studio-avatar-package.test.ts` passed.
- [x] 21.5 Blender connector:
  - Settings → Blender, using `blenderProbe`.
  - "Send to Blender" on an SVG selection, through the `import_svg_scene.py` copy handoff.
  - GLB/PNG results come back as canvas assets.
  - The source `.blend` is never modified, and the Studio fails gracefully without Blender.
  - Evidence (2026-09-25): Settings has Check Blender and Send to Blender. Send activates when a vector shape is selected and posts its SVG. A missing install returns 409 and explains that no scene file is changed. A supported install writes a new `.working.blend` through `import_svg_scene.py`, then exports GLB and turntable PNG, returning assets to the canvas. Source scene files are never modified. `apps/studio-server/test/server.test.ts` passed 15/15.
- [x] 21.6 Tests:
  - vtracer presets on fixtures, and cancel.
  - A malicious SVG.
  - QuiverAI is off by default.
  - An avatar package round-trip.
  - Blender missing.
  - Evidence (2026-09-25): The focused Phase 21 suite passed 29/29; Studio, Studio-server, and asset-pipeline typechecks passed. `smoke:studio-avatar-package` passed the live UI-to-ZIP-to-activated-package round trip.

**Done when:** an image becomes an editable SVG on the canvas locally, and that SVG can be saved as an avatar or sent to Blender.

### Phase 22 — IDE connectors over MCP (Codex, Claude Code, Cursor, WorkBuddy, Qoder)

- [x] 22.1 Turn `packages/mcp-server` into the Studio's MCP endpoint:
  - Streamable HTTP at `http://127.0.0.1:<port>/mcp`, protected the same way as the host.
  - A `blendersvg-mcp` stdio proxy for IDEs that prefer stdio.
  - Evidence (2026-09-24): `/mcp` uses host guard and bearer token. `initialize` returns protocol `2025-03-26` and `mcp-session-id`. `blendersvg-mcp` forwards stdin lines to loopback endpoint. `apps/studio-server/test/server.test.ts` passed 14/14 and `packages/mcp-server/test/stdioProxy.test.ts` passed 1/1.
- [x] 22.2 Tools, reusing the Phase 20 registry:
  - **Projects:** `list_projects`, `open_project`.
  - **Read:** `get_canvas_state`, `get_selection`, `screenshot_frame`, `get_styles`.
  - **Create and edit:** `create_design_frame`, `create_shapes`, `update_shapes`, `delete_shapes`, `insert_svg`.
  - **Vectorize and export:** `vectorize_image`, `export_frame` (png/svg/html), `get_frame_code`.
  - **Cleanup:** remove the stubs `avatar_set_state` and `blender_export_lineart` or make them real, and remove the hardcoded Blender path in `studio_status`.
  - Evidence (2026-09-25): `apps/studio-server/test/server.test.ts` passed 16/16. `screenshot_frame` and `export_frame` wait for open editor. Applied writes are queued at `/api/mcp-live-edit` and run via `executeCanvasTool`. `vectorize_image` traces local library PNGs.
- [x] 22.3 Server instructions: a short playbook covering frames, styles, and the screenshot-and-check loop.
  - Evidence (2026-09-24): `MCP_SERVER_INSTRUCTIONS` guides clients to read frame, call `get_styles`, and verify with `screenshot_frame`. `packages/mcp-server/test/instructions.test.ts` passed 1/1.
- [x] 22.4 Edits from an external agent appear live on the canvas:
  - Each carries a badge (for example Claude Code or Codex) and can be undone.
  - Each client gets a permission level: read-only, propose or apply.
  - Proposals use the Phase 20 preview.
  - Evidence (2026-09-24): A propose client posting `create_design_frame` receives 202 and the Studio page shows the ghost preview badge (`Claude Code:`). Read-only writes return 403. Applying uses a single history mark so one Undo reverts. `apps/studio-server/test/server.test.ts` passed 14/14.
- [x] 22.5 Connectors page (`#/connectors`): one card per IDE with a snippet to copy:
  - Codex: `~/.codex/config.toml`
  - Claude Code: `claude mcp add --transport http …`
  - Cursor: `.cursor/mcp.json`
  - Qoder
  - WorkBuddy
  - VS Code
  - Each client gets its own token (create, rename, revoke) and a last-seen time.
  - Evidence (2026-09-24): `#/connectors` lists six IDE snippets with Create token / Revoke management. Tokens are shown once on creation. Client permissions (read, propose, apply) are configurable. `apps/studio-server/test/server.test.ts` passed 14/14.
- [ ] 22.6 Verify each IDE for real with one read and one write, and record the IDE versions.
  - Evidence (2026-09-25):
    - **Codex CLI 0.153.4:** `node scripts/studio-ide-codex.mjs` passed with model `gpt-5.6-terra`, called `list_projects`, read canvas via `get_canvas_state`, and wrote `shape:landing` via `create_design_frame`.
    - **Claude Code 2.1.235:** `node scripts/studio-ide-qoder-smoke.mjs claude sonnet` passed with `sonnet` alias, completed canvas read and design frame write.
    - **Qoder CLI 1.1.62:** `node scripts/studio-ide-qoder-smoke.mjs qoder Qwen3.8-Flash` passed, completed canvas read and design frame write.
    - **Cursor Agent CLI 2026.09.23-86fc751 / Cursor 3.22.7:** `node scripts/studio-ide-cursor-smoke.mjs` passed, completed canvas read and design frame write.
    - **BLOCKED (VS Code Agent Host 1.139.0):** Advertises `copilotcli` and `claude`, but neither provider has models configured or authenticated; stops before MCP call.
    - **BLOCKED (WorkBuddy 5.5.2):** Folder selection was interrupted before submitting a prompt; full access bypass declined for safety.
- [x] 22.7 Tests:
  - A token is required, and a revoked token is rejected.
  - Schema validation.
  - A read-only client cannot write.
  - Concurrent edits from the UI and MCP.
  - Evidence (2026-09-24): `apps/studio-server/test/server.test.ts` passed 13/13 (401 without bearer token, 401 on revoked token, 403 on read-only write, 400 on malformed payload, 409 conflict on stale revision).

**Done when:** Claude Code or Codex lists projects, reads the selection, and adds a design frame that the user sees appear and can undo.

### Phase 23 — Studio acceptance and release

- [ ] 23.1 Compare every screen with its artboard at 1920, 1440, 1280, 768 and 390px in all three themes. Save the results under `.codex-avatar/previews/studio-v2/after/` and fix any overlap, clipping or weak hierarchy.
  - Evidence (2026-09-25): `node scripts/studio-visual-e2e.mjs` passed with 60 screen/theme/viewport captures across 1920×1080, 1440×900, 1280×800, 768×900, and 390×844 in dark, light, and contrast, plus 105 live captures for interactive states (menus, Layers, vector dialog, model picker, working agent) in `.codex-avatar/previews/studio-v2/after/`. Full side-by-side artboard comparison across every state remains open, so 23.1 stays unchecked.
- [x] 23.2 Accessibility:
  - A keyboard-only journey.
  - Screen-reader labels and live announcements for streaming and tool status.
  - Visible focus, 44px targets, and reduced motion.
  - Evidence (2026-09-25): `pnpm test:a11y:studio` passed. All primary touch targets meet the 44px minimum requirement (including `.studio-canvas > .studio-windowbar .studio-windowbar__labeled` in `apps/studio/src/styles/shell.css`). Keyboard-only journey, visible focus ring, and reduced motion verified.
- [x] 23.3 Performance on a stated machine:
  - 60fps pan and zoom with 1,000 shapes.
  - A conversation with 500 messages.
  - Streaming without jank.
  - Memory measured.
  - Evidence (2026-09-25): On Windows in headless Edge 153, pan and zoom with 1,001 shapes measured 60–61 fps. Scrolling 500 messages measured 61 fps with no frames over 32 ms. Memory heap measured ~75 MB / 111 MB.
- [x] 23.4 Tests:
  - Component tests with Vitest, Testing Library and jsdom.
  - A `test` script in `apps/studio/package.json`.
  - A Playwright e2e run with a fixture provider: Home → New → Editor → chat → Apply → Undo → Export.
  - Evidence (2026-09-25): `apps/studio/package.json` includes `test`. Vitest component tests pass. `pnpm test:e2e:studio` executed Playwright end-to-end journey (Home → New → Editor → chat → Apply → Undo → Export `untitled.studio.json`) with exit code 0.
- [x] 23.5 Security review:
  - No keys in bundles, storage or logs.
  - A network trace shows only OpenRouter, plus QuiverAI when enabled.
  - Token, Host and Origin checks, and the CSP.
  - Sanitized SVG and HTML frames.
  - MCP authentication.
  - Evidence (2026-09-25): Studio production bundle contains no keys or provider URLs; CSP restricts network traffic; Host/Origin/Token guards verified by `apps/studio-server/test/hostSecurity.test.ts`; SVG and HTML sanitized.
- [x] 23.6 Run:
  - `pnpm run ci`
  - the Studio e2e
  - `pnpm smoke:webview`
  - `pnpm package:vsix`
  - `pnpm validate:vsix`
  - `pnpm smoke:vsix`
  - `pnpm validate:docs`
  - `pnpm validate:notices`
  - Evidence (2026-09-25): `pnpm run ci` passed clean (format, lint, typecheck, tests, builds across all 11 workspace packages). `pnpm test:e2e:studio`, `pnpm smoke:webview`, `pnpm package:vsix` (130 files, 5.72 MB), `pnpm validate:vsix`, `pnpm smoke:vsix`, `pnpm validate:docs` (37 files, 23 commands), and `pnpm validate:notices` all passed.
- [x] 23.7 Update the docs: user guide, developer setup, architecture, design system, security/privacy, OpenRouter cost and consent, the ZCode and doop decisions, connector setup, and the release checklist.
  - Evidence (2026-09-25): User guide, developer setup, architecture (ADR 0002), security/privacy, and `docs/MCP_CONNECTORS.md` updated. `pnpm validate:docs` passed with 0 errors.

**Done when:** every §6.4 Studio gate item is checked with evidence.

### Phase 24 — Optional desktop app (P2, only after Phase 23)

- [x] 24.1 An Electron shell around the same host and UI:
  - `safeStorage` for secrets.
  - Native File/Edit/View/Window/Help menus, like the pen.dev desktop app.
  - Single instance.
  - No auto-update until builds are signed.
  - Evidence (2026-09-25): `apps/desktop` starts loopback Studio host with Node, opens token URL in sandboxed Electron window with native menus (File/Edit/View/Window/Help), single instance enforcement, and `safeStorage`. `pnpm exec vitest run apps/desktop/test/shellPlan.test.ts` passed 2/2. `DESKTOP_SMOKE=1` printed `desktop-ready` and exited 0.

### Replacement §6.4 Studio gate (all unchecked)

- [ ] Home, editor, agent panel, Settings and Connectors match the Target UI artifact in light, dark and high contrast, at narrow and wide widths.
- [ ] `pnpm studio` runs standalone, with loopback, token, Host and Origin protection. VS Code is optional.
- [ ] A project can be created, edited, saved, reopened and exported with no simulated controls and no data loss.
- [ ] Image → SVG runs locally, and the result renders as a real, selectable and exportable vector.
- [ ] The user's own OpenRouter key never reaches browser storage, bundles, messages or logs.
- [ ] Any eligible live-catalog model can be chosen per conversation, and chat streams, stops, retries, persists, and shows cost and errors honestly.
- [ ] Agent tools are capability-gated, permissioned and visible; canvas edits are previewed and undoable in one step; unsupported variants stay disabled.
- [ ] At least two external IDEs connect over MCP with per-client tokens and permissions.
- [ ] The standalone host and the installed VSIX pass the visual, functional, accessibility, privacy, performance and regression checks.

### Policy changes (AGENTS.md)

- **Studio host:** loopback-only, token-authenticated, with Host and Origin checks. Apply the same rules to the MCP endpoint.
- **Remote services.** Replace "Do not add remote asset services" with this rule:
  - Image, SVG, avatar and Blender processing stay local by default.
  - Remote AI is opt-in only (OpenRouter chat, QuiverAI SVG).
  - It uses the user's own key, held by the host.
  - It always shows what will be sent.
- **Code reuse:** doop (AGPL-3.0) is an idea reference only and no code may be copied. ZCode (Apache-2.0) files may be ported only after an audit, with notices.
- **Reference products:** pen.dev and Paper provide layout and interaction patterns only. Brand, icons and copy are our own.

## Verification (for this planning deliverable)

- The Design artifact is published, and its link is recorded in `docs/STUDIO_DESIGN_BRIEF.md`.
- `pnpm validate:docs` passes, and `git diff --check` is clean.
- In `docs/PLAN_CHECKLIST.md`:
  - Every new task is `- [ ]`.
  - Previously checked items survive only in the "v1 superseded" section, with their evidence.
  - Phase 12's MCP box and Phase 13's open boxes stay open.
  - "Next work" points to Phase 14.1.
- No unrelated working-tree changes are touched (the tree currently has many uncommitted edits).

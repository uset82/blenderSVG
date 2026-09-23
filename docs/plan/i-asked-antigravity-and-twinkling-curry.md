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

- [ ] 14.1 Save "before" screenshots of Recents, the editor, the chat panel and the inspector at 1440×900 and 390×844 under `.codex-avatar/previews/studio-v2/before/`. This also closes Phase 13's screenshot box.
- [ ] 14.2 Publish the Design artifact "blenderSVG Studio — Target UI" with these artboards:
  - Home dashboard
  - Editor with an empty agent
  - Editor with the agent working: tool cards, a proposal preview and the properties panel
  - Composer menus sheet: "+" menu, model picker, mode menu, variants menu
  - Image → SVG dialog
  - Connectors page
  - Settings → Models & keys
  - Editor in the light theme
  - Editor at 390px
- [ ] 14.3 Link that artifact from `docs/STUDIO_DESIGN_BRIEF.md` and rewrite the reference matrix:
  - 1: bottom creation dock with Design / Vector Asset / Image modes
  - 2: pen.dev editor
  - 3: pen.dev dashboard
  - 4: Paper editor
  - 5: Paper Recents
  - 6: composer "+" menu
- [ ] 14.4 Tokens v2 in `apps/studio/src/styles/tokens.css`, with the same token names in the light and high-contrast sets. Update `docs/DESIGN_SYSTEM.md`.
  - **Surfaces:** a neutral graphite scale (dotted canvas, panel, raised, and 8%-white hairline borders).
  - **Color:** three text levels, one accent, and status colors.
  - **Radius:** control 8, panel 12, pill 999.
  - **Elevation** for floating pills.
  - **Type:** 13px UI text, 12px meta, 11px caption.
- [ ] 14.5 Bundle fonts locally: Geist Sans and Geist Mono via `@fontsource`, OFL-1.1. No remote font requests. Add the notices.
- [ ] 14.6 Adopt `lucide-react` (ISC) as the only icon set. Replace the inline path icons, the Unicode glyphs (◐ ≡ × ⌕ ▦ ☷ −) and all emoji.
- [ ] 14.7 Add Radix UI primitives (MIT), wrapped in `apps/studio/src/ui/`:
  - Button, and IconButton with a tooltip and shortcut hint
  - FloatingPill, Tabs, Menu, Popover, Chip, Combobox, Dialog, Toast
  - Kbd, Segmented, EmptyState, Skeleton, ResizeHandle
- [ ] 14.8 Clean up the CSS:
  - Move layout out of inline `style={{…}}` in `App.tsx`, `StudioWindowBar.tsx` and `AgentHarnessSidebar.tsx` into class-based CSS.
  - Remove the `!important` overrides in `studio.css`.
  - Split the CSS by area: `shell`, `home`, `editor`, `agent`.
- [ ] 14.9 Remove leftovers:
  - Delete the unused `StudioHeader.tsx` and `FloatingPromptBar.tsx`.
  - Remove the emoji from `AvatarCanvasShape.tsx`.
  - Make all custom shapes use theme tokens.
- [ ] 14.10 Motion: 120–180ms ease-out on menus and panels, no ambient glow or glassmorphism, and `prefers-reduced-motion` honored.
- [ ] 14.11 Add a dev-only `#/gallery` route that renders every primitive in dark, light and high contrast.
- [ ] 14.12 Brand: the name "blenderSVG Studio", our own monochrome logo mark and a favicon. No pen.dev or Paper logos, names or copy.

**Done when:** the gallery shows every primitive in all three themes with visible focus and text contrast of at least 4.5:1, and no emoji or Unicode icons remain.

### Phase 15 — Home dashboard (pen.dev dashboard + Paper Recents)

- [ ] 15.1 Replace the `isRecentsOpen` overlay with a hash router: `#/`, `#/p/:projectId`, `#/connectors`, `#/settings`, `#/gallery`. Back/forward and deep links must work.
- [ ] 15.2 Left sidebar (240px):
  - Logo and workspace menu, Search (Ctrl+K), Recents, Drafts, Templates, Design systems.
  - Connectors and Settings at the bottom.
  - Any item without a working feature behind it is hidden, not shown dead.
- [ ] 15.3 Top row: the title, "Open file" (imports a project `.json`) and a primary "+ New file" button.
- [ ] 15.4 Hero composer "Design anything…", sharing the Composer component with Phase 19:
  - **Category chips:** Landing page, Mobile app, Web app, Dashboard, Slides, Avatar, Icon / vector, Something else. Each sets a frame preset (such as 1440×1024 or 390×844) and a starter prompt.
  - **Submit:** creates a project, opens the editor and puts the prompt in the agent composer.
  - **Sending:** it sends only if the user is connected and confirms; otherwise it shows the connect step.
- [ ] 15.5 Start cards: "Image → SVG" (local vtracer), "Recreate a screenshot" (attaches the image to the agent) and "Import SVG / image". No Figma or web import until they are real.
- [ ] 15.6 Recents grid:
  - Each card shows a real thumbnail, the title and "Edited 4h ago".
  - A "⋯" menu offers Open, Rename, Duplicate, Delete and Reveal in folder.
  - Grid/list and sort order (last edited, name, created) are remembered.
  - A search box filters by title.
- [ ] 15.7 A pinned "Scratchpad" project that always exists, following Paper's permanent-draft pattern.
- [ ] 15.8 Empty state, skeleton loading cards, and an error state that shows how many projects are corrupt, with details.
- [ ] 15.9 Responsive layout:
  - Below 1024px the sidebar becomes an icon rail; below 700px it becomes a drawer.
  - The grid reflows from 1 to 5 columns.

**Done when:** Home matches its artboard at 1440 and 390, and every visible control works.

### Phase 16 — Editor workspace shell (pen.dev editor + Paper panels)

- [ ] 16.1 CSS grid shell:
  - A left panel, 320px by default, resizable from 260 to 480.
  - A floating tool rail.
  - A full-bleed canvas.
  - A right properties panel, 280px by default, resizable and collapsible.
  - The pills float over the canvas.
- [ ] 16.2 Top-left pill:
  - Logo (goes Home), Home icon, folder icon.
  - Title with inline rename.
  - Save status: "Auto-saved", "Saving…", "Offline – kept locally", or "Save failed – Retry".
  - Overflow menu: Rename, Duplicate, Export…, Delete.
- [ ] 16.3 Top-right pill:
  - Agents (a sessions popover), Export (instead of Share until sharing exists), Settings, and Present (the selected frame fullscreen).
  - No globe or web-import button until they work.
- [ ] 16.4 Left panel icon tabs with tooltips: Agent, Layers, Pages, Assets, Styles. Add a collapse button and remember the last tab.
- [ ] 16.5 Layers tab:
  - A frame → children tree.
  - Selection stays in sync with the canvas both ways.
  - Double-click to rename, plus hide and lock toggles.
  - Drag to reorder.
  - Virtualized so 1,000 shapes stay smooth.
- [ ] 16.6 Pages tab: add, rename, reorder and delete tldraw pages.
- [ ] 16.7 Assets tab: the project's images, SVGs and avatars, draggable onto the canvas.
- [ ] 16.8 Styles tab: the project's color and type tokens. This feeds "Choose a style".
- [ ] 16.9 Rebuild the tool rail:
  - **Tools:**
    - Select/Hand (V/H)
    - Frame (F) with a presets menu
    - Shapes: rectangle (R), ellipse (O), line/arrow (L)
    - Pen (P), Text (T), Sticky (N), Image/SVG (I)
    - A shortcuts button at the bottom
  - Tools **arm** the matching tldraw tool (`editor.setCurrentTool`) instead of inserting at the center.
  - The active state follows `editor.getCurrentToolId()` through `useValue`, so keyboard changes show on the rail.
- [ ] 16.10 Canvas styling:
  - A dotted background driven by tokens.
  - A white default frame with its name above it.
  - Accent-colored selection handles.
  - Our own right-click menu: Cut/Copy/Paste, Duplicate, Delete, Bring forward/back, Group, Export selection, "Ask agent about selection".
- [ ] 16.11 Bottom-right zoom cluster: − / % / +, with a menu for fit (Shift+1), selection (Shift+2), 50%, 100% and 200%.
- [ ] 16.12 Right panel (Paper-style properties):
  - **Nothing selected:** Page (background color as hex + opacity, grid on/off) and Export.
  - **Frame:** size presets, fill and clip.
  - **Shape:** position and size (reuses `StudioInspector.tsx` and `inspectorSelection.ts`), rotation, fill, stroke, opacity and radius.
  - **Text:** font, size, weight and alignment.
  - **Multiple selection:** mixed values.
  - Number inputs are bounded and support scrubbing.
- [ ] 16.13 Resize handles use `role="separator"` and can be resized with the arrow keys. Widths are remembered, and Ctrl+\ toggles the panels.
- [ ] 16.14 A "?" shortcut sheet and a Ctrl+K command palette covering tools, actions and projects.
- [ ] 16.15 Responsive layout:
  - Below 1024px the right panel becomes a drawer.
  - Below 700px the left panel becomes a bottom sheet and the rail moves to a bottom bar.
  - The canvas is never fully covered.
- [ ] 16.16 Configure the tldraw production license key through a build-time env variable (the preview already shows tldraw's license reminder) and document it in `docs/DEVELOPER_SETUP.md`.

**Done when:** the editor matches its artboards at 1440, 1280, 768 and 390 in all three themes, with no overlap or clipping.

### Phase 17 — Standalone local Studio host (VS Code optional)

- [ ] 17.1 Write ADR `docs/adr/0001-standalone-studio-host.md`:
  - **Architecture:** a local-first web app served by a Node host on loopback; VS Code becomes an optional connector.
  - **Threat model:**
    - websites calling localhost
    - DNS rebinding
    - other local processes
    - malicious SVG
    - prompt injection
- [ ] 17.2 Create `packages/studio-host-core` by moving host-agnostic code with no behavior change:
  - `openRouterConnection.ts` (it already uses the injectable `SecretStore` and `PasswordPrompt`).
  - `openRouterChat.ts` and `studioProjectStore.ts`.
  - The `blenderProbe/Plan/Artifacts/Runner/Handoff` files. Replace `import type * as vscode` in `blenderRunner.ts` with a small `Logger` interface.
  - The extension imports from this package, and its tests stay green.
- [ ] 17.3 Create `apps/studio-server` (Node 22, Hono or Fastify plus `ws`):
  - It serves the built `apps/studio` and binds only to `127.0.0.1`.
  - A new root script `pnpm studio` starts it and opens the browser.
- [ ] 17.4 Split `apps/studio/src/bridge/studioHost.ts` into three transports: `vscodeTransport`, `webSocketTransport`, and `fixtureTransport` for tests and offline mode. All three carry the existing versioned `studioProtocol` messages and zod parsers.
- [ ] 17.5 Host security:
  - A `Host` header allowlist.
  - An `Origin` check on the WebSocket upgrade and on every POST.
  - A random per-launch token, exchanged for an HttpOnly, SameSite=Strict cookie.
  - No CORS.
  - The strict CSP sent as a header.
  - Body and message size limits, rate limiting, and path containment on every file route.
- [ ] 17.6 Data location:
  - An OS app-data "Studio library" with `projects/`, `assets/`, `conversations/` and `thumbnails/`.
  - An optional workspace folder, trusted on first use. This replaces VS Code workspace trust.
- [ ] 17.7 Secrets:
  - The OS keychain via `@napi-rs/keyring`, with an `OPENROUTER_API_KEY` env fallback.
  - The Settings form posts the key once to the authenticated host.
  - The key is never kept in browser storage, never echoed back and never logged. The UI only ever sees a masked status.
  - Update `docs/SECURITY_PRIVACY.md` and the locked decision that forbade any browser key form.
- [ ] 17.8 With no host running, the UI opens on the fixture transport and says "Offline preview – nothing is saved".
- [ ] 17.9 VS Code: `codexAvatar.openStudio` opens the standalone Studio. Retire the duplicated `StudioWebviewPanel.ts` logic once the standalone host reaches parity. The avatar sidebar stays unchanged.
- [ ] 17.10 Tests:
  - A missing or invalid token, a bad Host, and a bad Origin are all rejected.
  - Oversized messages and path traversal are rejected.
  - A keychain mock.
  - WebSocket reconnect with state resync.

**Done when:**
- `pnpm studio` runs without VS Code, opens Home, and saves projects to disk.
- A foreign-origin or tokenless request is rejected.

### Phase 18 — Real canvas projects, assets and exports

- [ ] 18.1 Project operations through the host, reusing the `formatVersion: 1` envelope and atomic writes:
  - Create, open, rename, duplicate, and delete with confirmation.
  - Autosave with a debounce, reflected in the pill status.
  - If a write fails, the last good file is kept.
- [ ] 18.2 Thumbnails: when saving (throttled), render the first frame with `editor.toImage` to a PNG and serve it through the authenticated host.
- [ ] 18.3 A host-backed tldraw asset store at `/assets/:id` instead of base64 inside snapshots. Enforce size limits and always sanitize SVG with `svgSafety.ts`.
- [ ] 18.4 Insert SVG, PNG and JPG by drag-drop, paste or the Image tool as a real image shape that keeps the viewBox and aspect ratio. This replaces the black-rectangle placeholder.
- [ ] 18.5 Export a frame or selection as PNG (1× or 2×) or sanitized SVG, and export the project as `.json`, with safe filenames. Remove the ".svg & .blend bundle" claim.
- [ ] 18.6 Wire undo/redo, copy/paste, duplicate, group, align/distribute and snapping to tldraw, and show their shortcuts in the menus.
- [ ] 18.7 Tests:
  - a project round-trip
  - a thumbnail
  - SVG insert followed by export
  - a failed save
  - a corrupt file

**Done when:** New file → edit → close → reopen → export PNG/SVG produces identical content.

### Phase 19 — Agent panel and OpenRouter chat (pen.dev composer)

- [ ] 19.1 Agent tab header: a "New Agent ▾" conversation dropdown showing title, model and time, plus a "+ New" button.
- [ ] 19.2 Empty state: "Ask me to design anything", six design suggestion chips written in our own words, and two short tips (exporting and attaching context).
- [ ] 19.3 Composer:
  - **Input:** an autosizing "Design anything…" box. Enter sends; Shift+Enter adds a newline.
  - **"+" menu:**
    - Add image or file
    - Add from canvas: the selection or frame, as a PNG or a structured summary
    - Choose a style
    - Pick a skill
  - **Chips:**
    - Attachment chips with a remove button.
    - A mode chip (Phase 20).
    - A "1x" variants chip, disabled with a reason until Phase 20.
    - A model chip.
  - **Send:** the ↑ button becomes Stop while a reply is streaming.
- [ ] 19.4 Model picker popover:
  - Search, grouping by publisher, and badges: Free, Vision, Tools, Reasoning, context size and $/M.
  - Favorites and recent models at the top, the filters from `modelFilters.ts`, and full keyboard navigation.
  - **Catalog:**
    - The full `/models/user` catalog with `output_modalities=all`, falling back to the public catalog on a 403.
    - Pagination if the API has it.
    - Cached with a timestamp and a Refresh button.
    - No hardcoded model IDs.
  - A saved model that disappears stays visible with a warning.
- [ ] 19.5 Conversations:
  - The model is saved per conversation.
  - Conversations are stored per project on the host at `conversations/<projectId>/<id>.json`.
  - They can be renamed, deleted and exported, under a documented retention policy.
  - The key is never stored with them.
- [ ] 19.6 Message rendering:
  - Markdown through `react-markdown` + `rehype-sanitize`, with no raw HTML.
  - Code blocks with Copy, and a streaming caret.
  - Collapsible reasoning, and a footer with token count and `usage.cost`.
  - Error cards with Retry, Switch model, Open settings, and Add credits.
- [ ] 19.7 Actions: Stop, Retry, Regenerate, edit and resend the last message, Copy, New, and Delete. No duplicate sends.
- [ ] 19.8 Privacy UX:
  - A "Context" row above the composer lists exactly what will be sent.
  - A consent dialog appears on the first send in each project.
  - A setting to always show the full request preview.
  - A cue before sending to a paid model.
- [ ] 19.9 Gateway (`openRouterChat.ts`):
  - Add the `HTTP-Referer`/`X-Title` headers and `usage: {include: true}`, and pass reasoning deltas through.
  - Send images only to vision models.
  - Back off and retry on 429 and 5xx.
  - Let catalog refresh run even while the connection flag is `busy`.
  - Re-resolve the model after a host restart.
- [ ] 19.10 Settings → Models & keys:
  - Connect, Test, Replace and Disconnect.
  - A masked key label and credit usage.
  - These replace the connection and filter cards in the sidebar.
- [ ] 19.11 Remove the old single-column `AgentHarnessSidebar.tsx` layout once the new panel reaches parity.
- [ ] 19.12 Tests:
  - The SSE parser with split lines, keepalive comments, `[DONE]` and a mid-stream error.
  - Catalog pagination and cache, and model switching.
  - Errors: 401, 402, 429, 5xx, offline, an unavailable model, an empty reply, a malformed stream, and cancel.
  - Conversation persistence.

**Done when:** a user connects their own key, finds any eligible model, then streams, stops, retries, switches models, and reopens the chat after a restart.

### Phase 20 — Agent harness adapted from ZCode (design agent)

- [ ] 20.1 Write ADR `docs/adr/0002-agent-harness.md`, pinned to ZCode `328c1a0` (Apache-2.0).
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
- [ ] 20.2 `packages/studio-agent`, a turn machine that runs in the host:
  - Its states: input → model → streaming → schedule tools → await permission → execute → aggregate → done or error.
  - It uses OpenRouter's OpenAI-compatible `tools`/`tool_choice` and streamed `delta.tool_calls`.
  - It has a turn limit, per-tool timeouts, cancellation, and typed events for the UI.
- [ ] 20.3 Studio protocol v2 in `studioProtocol.ts`:
  - Agent session start and stop.
  - Turn events.
  - Tool calls: proposed, approved, rejected and result.
  - Permission request and response.
  - zod bounds on every message, and a migration from v1.
- [ ] 20.4 Canvas tool registry, with JSON schemas and readOnly/destructive flags:
  - **Read:** `get_canvas_summary`, `get_selection`, `get_frame_tree`, `screenshot_frame`, `get_styles`.
  - **Write:** `create_frame`, `create_shapes`, `update_shapes`, `delete_shapes`, `insert_svg`, `set_text`, `apply_style`, `align`.
  - **Design:** `create_design_frame`.
- [ ] 20.5 A "Design frame" tldraw shape:
  - It renders agent-authored HTML+CSS inside a sandboxed `iframe srcdoc`, with no scripts, no network and sanitized markup.
  - It can be resized and exported to PNG or HTML.
  - This is how prompts like "landing page" or "dashboard" produce real layouts.
- [ ] 20.6 Composer modes (ZCode-style; Shift+Tab cycles them):
  - **Ask:** chat only.
  - **Plan:** read tools only, and returns a list of steps.
  - **Build:** write tools are previewed and applied only after approval.
  - **Auto:** canvas-only changes are applied automatically, each as one undo step.
  - File and Blender tools always ask for approval.
- [ ] 20.7 Proposal preview: pending changes show as a ghost layer with Apply and Reject. Apply is a single tldraw history mark, so one Undo reverts it.
- [ ] 20.8 A tool-call card for each call: the tool name, a short argument summary, status, duration, the result or error, and Apply/Reject/Undo.
- [ ] 20.9 Subagents as Markdown profiles in `skills/agents/`, one nesting level as in ZCode:
  - **Designer.**
  - **Reviewer:** screenshots the frame and critiques it with a vision model.
  - **Vectorizer.**
- [ ] 20.10 Variants from 1x to 4x:
  - One prompt runs as N child sessions (on the same or different models) into N frames side by side.
  - The user compares them and keeps one.
  - The chip stays disabled until this has tests.
- [ ] 20.11 Skills and styles:
  - **Skills:** Markdown prompt packs in `skills/design/` (landing, mobile, dashboard, icon set, avatar, logo).
  - **Styles:** token presets.
- [ ] 20.12 Context budget taken from each model's `context_length`, compaction of long conversations, and a cap on the canvas summary.
- [ ] 20.13 A model without tool support falls back to Ask mode and says why.
- [ ] 20.14 The "Agents" pill lists running and finished sessions, with a Stop button.
- [ ] 20.15 Tests:
  - Prompt injection hidden in canvas text or images.
  - Invalid tool arguments, a rejected approval, and a tool timeout.
  - A variant run where some variants fail.
  - A single Undo reverting an applied change.
  - A model with no tool support.

**Done when:**
- "Design a landing page for X" in Build mode shows a preview.
- Apply adds it, and one Undo removes it.
- Every tool call is visible in the chat.

### Phase 21 — Creation engines: image → SVG, avatars, Blender, optional remote SVG

- [ ] 21.1 "Vector asset" dialog, openable from the Home card, the tool rail and the "+" menu (the mode menu in screenshot 1):
  - Drop in an image and pick a vtracer preset: Color illustration, Clean icon, Silhouette or Pixel art.
  - **Advanced settings:**
    - color precision and layer difference
    - speckle filter
    - corner, length and splice thresholds
    - spline, polygon or pixel mode
    - stacked or cutout layering
  - A before/after slider showing path count and file size.
  - An Insert button that places it on the canvas.
- [ ] 21.2 Run vtracer (`@visioncortex/vtracer`, already in `packages/asset-pipeline`) in a worker that can be cancelled:
  - **Before tracing:** resize, denoise, remove near-white backgrounds, and quantize the palette.
  - **After tracing:** run SVGO and sanitize.
  - A guard on path count.
- [ ] 21.3 Optional QuiverAI "Generate SVG" (text plus reference images → SVG):
  - **Off by default.** It uses the user's own key from the host keychain.
  - Before anything is sent, a consent notice says exactly what goes out.
  - The output is sanitized, and cost and unavailable states are clear.
  - It needs the AGENTS.md change below. Until then `quiverVectorEngine.ts` keeps rejecting.
- [ ] 21.4 Avatar builder:
  - The `avatar` shape uses the real avatar-core renderers (package SVG and layered mascot) and shows state previews instead of emoji buttons.
  - "Save as avatar package" reuses the validated Phase 4 packaging, so the VS Code avatar sidebar can activate it.
- [ ] 21.5 Blender connector:
  - Settings → Blender, using `blenderProbe`.
  - "Send to Blender" on an SVG selection, through the `import_svg_scene.py` copy handoff.
  - GLB/PNG results come back as canvas assets.
  - The source `.blend` is never modified, and the Studio fails gracefully without Blender.
- [ ] 21.6 Tests:
  - vtracer presets on fixtures, and cancel.
  - A malicious SVG.
  - QuiverAI is off by default.
  - An avatar package round-trip.
  - Blender missing.

**Done when:** an image becomes an editable SVG on the canvas locally, and that SVG can be saved as an avatar or sent to Blender.

### Phase 22 — IDE connectors over MCP (Codex, Claude Code, Cursor, WorkBuddy, Qoder)

- [ ] 22.1 Turn `packages/mcp-server` into the Studio's MCP endpoint:
  - Streamable HTTP at `http://127.0.0.1:<port>/mcp`, protected the same way as the host.
  - A `blendersvg-mcp` stdio proxy for IDEs that prefer stdio.
- [ ] 22.2 Tools, reusing the Phase 20 registry:
  - **Projects:** `list_projects`, `open_project`.
  - **Read:** `get_canvas_state`, `get_selection`, `screenshot_frame`, `get_styles`.
  - **Create and edit:** `create_design_frame`, `create_shapes`, `update_shapes`, `delete_shapes`, `insert_svg`.
  - **Vectorize and export:** `vectorize_image`, `export_frame` (png/svg/html), `get_frame_code`.
  - **Cleanup:** remove the stubs `avatar_set_state` and `blender_export_lineart` or make them real, and remove the hardcoded Blender path in `studio_status`.
- [ ] 22.3 Server instructions: a short playbook covering frames, styles, and the screenshot-and-check loop.
- [ ] 22.4 Edits from an external agent appear live on the canvas:
  - Each carries a badge (for example Claude Code or Codex) and can be undone.
  - Each client gets a permission level: read-only, propose or apply.
  - Proposals use the Phase 20 preview.
- [ ] 22.5 Connectors page (`#/connectors`): one card per IDE with a snippet to copy:
  - Codex: `~/.codex/config.toml`
  - Claude Code: `claude mcp add --transport http …`
  - Cursor: `.cursor/mcp.json`
  - Qoder
  - WorkBuddy
  - VS Code
  - Each client gets its own token (create, rename, revoke) and a last-seen time.
- [ ] 22.6 Verify each IDE for real with one read and one write, and record the IDE versions.
- [ ] 22.7 Tests:
  - A token is required, and a revoked token is rejected.
  - Schema validation.
  - A read-only client cannot write.
  - Concurrent edits from the UI and MCP.

**Done when:** Claude Code or Codex lists projects, reads the selection, and adds a design frame that the user sees appear and can undo.

### Phase 23 — Studio acceptance and release

- [ ] 23.1 Compare every screen with its artboard at 1920, 1440, 1280, 768 and 390px in all three themes. Save the results under `.codex-avatar/previews/studio-v2/after/` and fix any overlap, clipping or weak hierarchy.
- [ ] 23.2 Accessibility:
  - A keyboard-only journey.
  - Screen-reader labels and live announcements for streaming and tool status.
  - Visible focus, 44px targets, and reduced motion.
- [ ] 23.3 Performance on a stated machine:
  - 60fps pan and zoom with 1,000 shapes.
  - A conversation with 500 messages.
  - Streaming without jank.
  - Memory measured.
- [ ] 23.4 Tests:
  - Component tests with Vitest, Testing Library and jsdom.
  - A `test` script in `apps/studio/package.json`.
  - A Playwright e2e run with a fixture provider: Home → New → Editor → chat → Apply → Undo → Export.
- [ ] 23.5 Security review:
  - No keys in bundles, storage or logs.
  - A network trace shows only OpenRouter, plus QuiverAI when enabled.
  - Token, Host and Origin checks, and the CSP.
  - Sanitized SVG and HTML frames.
  - MCP authentication.
- [ ] 23.6 Run:
  - `pnpm run ci`
  - the Studio e2e
  - `pnpm smoke:webview`
  - `pnpm package:vsix`
  - `pnpm validate:vsix`
  - `pnpm smoke:vsix`
  - `pnpm validate:docs`
  - `pnpm validate:notices`
- [ ] 23.7 Update the docs: user guide, developer setup, architecture, design system, security/privacy, OpenRouter cost and consent, the ZCode and doop decisions, connector setup, and the release checklist.

**Done when:** every §6.4 Studio gate item is checked with evidence.

### Phase 24 — Optional desktop app (P2, only after Phase 23)

- [ ] 24.1 An Electron shell around the same host and UI:
  - `safeStorage` for secrets.
  - Native File/Edit/View/Window/Help menus, like the pen.dev desktop app.
  - Single instance.
  - No auto-update until builds are signed.

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

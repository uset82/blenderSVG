# Studio baseline inventory

Observed in the local Vite preview at `http://127.0.0.1:5174/` on 2026-09-23. The supplied Paper and pen.dev screenshots are design references, not descriptions of features this extension already provides.

## Visible controls and current behavior

| Surface | Control | Current behavior | Status |
| --- | --- | --- | --- |
| Window bar | Recent canvases | Opens the session canvas browser. | Working |
| Window bar | Project title and save state | Renames the active page and debounces a versioned project save in the VS Code host. The browser preview stays in memory. | Implemented; host round-trip pending |
| Window bar | AI setup | Opens and closes the connection/conversation panel. | Working |
| Window bar | Inspector | Opens and closes the selection inspector. It replaces the AI panel at every width. | Working |
| Window bar | Zoom −, percentage, + | Changes zoom, resets to 100%, and displays the initial fit level. | Working |
| Tool rail | Select, hand, pen | Selects tldraw's select, pan, and draw tools. | Working |
| Tool rail | Frame, rectangle, text | Adds the matching tldraw shape at the viewport center. | Working |
| Canvas | Pan, zoom, select, edit | Uses the tldraw editor. The default frame is created locally. | Working |
| Inspector | Selected shape geometry | Edits bounded x/y and supported width/height values on selected tldraw shapes. Multi-selection displays mixed values; updates apply to the current selection. | Working; visual and undo/redo check passed |
| Recents | Search and grid/list toggle | Filters saved workspace projects in VS Code; browser preview filters current-session pages. | Implemented; host round-trip pending |
| Recents | Open / New / Duplicate / Delete | Opens the most recent project at launch, creates a new project, duplicates its saved snapshot, or deletes it after native confirmation. Browser preview keeps session-only pages. | Implemented; host interaction pending |
| AI panel | Connect, Replace, Test, Disconnect | In the VS Code host, uses a native password prompt, VS Code SecretStorage, and OpenRouter's key-check endpoint. | Host-backed |
| AI panel | Browser preview | States that it cannot accept a key or send chat messages. | Setup-only |
| AI panel | Model picker and composer | VS Code host fetches the account-filtered catalog (with a labeled public-catalog fallback if `/models/user` returns 403), filters models by publisher, price, capability, context, and input/output price, reviews the exact request, streams chat, and exposes Stop/Retry. Browser preview keeps the controls disabled. The selected model is saved in browser preference storage; chat history and per-conversation model selection are not yet persisted. | Implemented; live account verification pending |
| Vector canvas shape | SVG preview | Displays only sanitized saved SVG; text generation and remote vectorization are unavailable. | Local preview only |
| Blender connector shape | Integration status | States that Studio has no live Blender status or export action on this canvas. It is not offered by the current toolbar. | Honest disabled placeholder |
| Avatar canvas shape | Expression controls | Draws a local illustrative SVG and changes its expression state. It is not a rigged or live 3D character. | Local illustration preview |

## Data flow and trust boundaries

| Data | Current route | Boundary |
| --- | --- | --- |
| OpenRouter API key | Native VS Code password prompt → `SecretStorage` → extension host request to `https://openrouter.ai/api/v1/key` | The key is not sent through the Studio bridge or Webview. The request has a 10-second timeout. |
| Connection state | Strict, versioned message → VS Code Webview host → Studio UI | Only status and a safe user-facing message cross into the Webview. |
| Browser preview | Shared protocol client detects the missing VS Code API and displays setup-only state | No key form, localStorage access, OpenRouter request, or chat request is enabled. |
| SVG preview | Stored SVG → local sanitizer → `data:` image URI in an `<img>` element | Raw SVG markup is not injected into the DOM. |
| Canvas pages | tldraw editor snapshot → trusted host → `.codex-avatar/studio/projects/<uuid>.json` | The file contains a versioned envelope and schema-bearing tldraw snapshot. Saves use a unique temporary file and same-folder rename; the browser preview remains session-only. Live host round-trip is not yet verified. |
| Picture tracing and Blender data | Not sent from the Studio preview | Local extension workflows remain separate from the chat host. |

## Visual review record

- Existing baseline canvas captures: `.codex-avatar/previews/studio-phase13/canvas-1280.png` and `.codex-avatar/previews/studio-phase13/canvas-360.png` (ignored local preview files).
- After the Recents and responsive-shell changes, reviewed the live Recents view at 1280×800 and 360×800 through the local browser. Search, layout toggle, and creation/switching between two session pages were observed.
- Live canvas review at 360×800, 768×900, 1280×800, and 1920×1080 showed the horizontal tool rail on a separate row at narrow widths and a fitted artboard. Resizing refits after an ordinary shape selection; Hand/middle-button pan, wheel, and explicit zoom preserve a manually chosen view. CUA verified that selecting a rectangle then opening Chat refits the full frame at 1280×800.
- A follow-up composition pass makes both side panels mutually exclusive at every width and starts with both closed so the artboard owns the workspace. It adds dark, light, and high-contrast themes; shared Studio/Recents tokens; 40px control targets; vector tool icons; and reduced-motion handling.
- Current local screenshot evidence is in `.codex-avatar/previews/studio-phase13/current-2026-09-23/` (ignored by Git), with 40 PNGs and a `manifest.json` of filename, dimensions, and bytes. For both `desktop-1280x800-` and `narrow-360x800-`, the dark set contains `dark-recents.png`, `dark-canvas-empty.png`, `dark-canvas-populated.png`, `dark-sidebar-populated.png`, `dark-inspector.png`, and `dark-composer-populated.png`. Corresponding light and high-contrast Recents, empty/populated canvas, Chat, and Inspector views were captured. Isolated Edge 153 headless profiles used CDP viewport emulation and local `Page.captureScreenshot`; panel captures waited 1.1 seconds for layout. The inspected dark populated Chat captures show the complete frame beside the desktop panel and above the narrow panel; the narrow Recents view fits one column. The browser preview correctly disables OpenRouter chat. The desktop canvas still displays a tldraw production-license reminder.
- The Inspector now edits selection geometry. In the local preview, a rectangle's x-position and width were changed, then undo and redo restored the expected values. The Inspector refreshed after each change. `inspectorSelection.test.ts` verifies empty, single, same-type multi-select, differing coordinates/dimensions, differing types, and shapes without resize properties.
- Conversation and Inspector have focusable resize dividers. CUA tested arrow-key and pointer resizing, plus panel/canvas bounds at 360×800, 768×900, 1280×800, and 1920×1080. Both panels and the composer fit in each viewport; the compact-height cap keeps the panel below 48% of workspace height. At 360×640 and the Inspector's maximum, the canvas retained 302px height. `panelSizing.test.ts` passed 3/3; sizing preferences are clamped and persisted locally.
- The OpenRouter catalog picker now has publisher, listed-price, capability, minimum-context, and maximum input/output price filters. The chosen ID persists as a local preference and is not replaced automatically if it disappears. The 403 fallback requests the public catalog without an Authorization header and reports that account-specific model preferences could not be read. No user's credential was used in this pass.
- After the project bridge changes, the local browser was clean-reloaded. Recents continues to present the session-only fallback with no API key or chat request controls. The installed-package mock-host smoke now covers project create/edited save/reopen, restart, corrupt-file protection and repair, and an injected atomic rename failure. It uses a synthetic snapshot and does not yet verify live Webview autosave.
- Focused tests passed 18/18 for panel sizing, model filters, inspector selection summary, catalog fallback, and key metadata/error handling. `pnpm --filter @codex-avatar-studio/studio typecheck`, `pnpm --filter codex-avatar-studio-extension typecheck`, and `pnpm package:vsix` passed after the resize/refit changes; the VSIX contains 40 files (2.7 MB). The earlier packaged-host `pnpm smoke:vsix` and `pnpm smoke:clean-profile` checks passed and will be rerun after the pending local-asset work. Vite emitted existing large-chunk advisory warnings for the Studio and avatar Webview bundles.
- A production license reminder from tldraw appeared in the accessibility tree during local preview. No account, external file, or user content was submitted during this review.

## Known work remaining

- Run the live VS Code Webview create/edit/autosave/reopen/restart journey; generate real project thumbnails and show any failed-save recovery state. The packaged mock-host round trip is covered.
- Finish the documented light/dark/high-contrast and accessibility review using the saved evidence set; resolve the desktop tldraw production-license reminder before a commercial release.
- Verify live OpenRouter model discovery and streaming with a user-owned key, then finish catalog filters, per-conversation model persistence, chat history retention, copy/regenerate, and the provider failure matrix.
- Connect the Studio Blender placeholder to measured optional Blender state before offering setup or export actions.
- Revoke any historical credential that may still be active. Its value is intentionally omitted from this file.

# Studio design brief

**Purpose:** make the canvas the primary work surface and make every visible action explain or change real Studio state. Use the supplied screenshots as layout and interaction references, and keep the product's own brand, icons and copy.

## Target UI

The visual spec for the Studio track (Phases 14–24 in [`PLAN_CHECKLIST.md`](PLAN_CHECKLIST.md)) is the design canvas [blenderSVG Studio — Target UI](https://claude.ai/artifact/KF4tzS5uc1apNpW8YDygGN). It is private to its owner until shared from the page's Share menu. A readable local copy of every artboard is in [`design/target-ui/`](design/target-ui/README.md). Its artboards:

| Artboard | Specifies | Phase |
| --- | --- | --- |
| Home dashboard | Sidebar, hero composer with category chips, start cards, Recents grid | 15 |
| Editor, empty agent | Floating pills, left panel tabs, empty agent state, tool rail, dotted canvas, Page properties, zoom cluster | 16, 19 |
| Editor, agent working | Conversation, tool-call cards, a proposed design frame with Apply/Reject, Frame properties | 19, 20 |
| Composer menus | "+" context menu, context chips, model picker, mode menu, variants menu | 19, 20 |
| Image → SVG dialog | vtracer presets, advanced settings, before/after comparison, Insert on canvas | 21 |
| IDE connectors | MCP endpoint, per-IDE config snippets, per-client permission and token | 22 |
| Settings, models & keys | OpenRouter key status, chat defaults, catalog refresh, optional QuiverAI | 17, 19, 21 |
| Editor, light theme with layers | Light tokens, Layers tree, shape properties | 14, 16 |
| Editor on a phone | 390px layout: bottom tool bar and agent sheet | 16 |

## Reference matrix

| Reference screenshot | Useful pattern | Studio application |
| --- | --- | --- |
| 1: creation dock | A bottom composer with a mode menu (Design, Vector asset, Image) and suggestion chips above it. | The Home hero composer and the "Vector asset" entry point (Phases 15 and 21). |
| 2: pen.dev editor | A left agent panel with a composer, a narrow tool rail, a centered frame on a dotted canvas, and floating project and action pills. | The editor shell (Phase 16) and the agent panel (Phase 19). |
| 3: pen.dev dashboard | Category chips, one large "Design anything" composer, import cards, and a Recents grid. | The Home dashboard (Phase 15). |
| 4: Paper editor | Pages list with Design/Theme tabs, a thin tool rail, and a quiet right panel showing page color. | The Pages and Styles tabs and the right properties panel (Phase 16). |
| 5: Paper Recents | A left navigation rail, a Recents grid, "New file", grid/list toggle, and a permanent Scratchpad draft. | The Home sidebar, Recents grid and pinned Scratchpad (Phase 15). |
| 6: composer "+" menu | Add image or file, add from workspace, import, choose a style, pick a skill. | The composer context menu (Phase 19): add image or file, add from canvas, choose a style, pick a skill. |

Paper and pen.dev contribute layout and interaction patterns only. Do not copy their logos, names, icons or copy, and do not show features that do not work yet.

## Product hierarchy

1. **Canvas:** the primary, uncluttered work surface, full-bleed behind floating pills.
2. **Project:** the top-left pill with an editable title and an honest save state; Home holds Recents.
3. **Tools:** a compact floating rail whose buttons arm tldraw tools, each with a keyboard shortcut.
4. **Left panel:** Agent, Layers, Pages, Assets and Styles tabs; the Agent tab holds conversations and the one composer.
5. **Right panel:** Page properties when nothing is selected, otherwise the selection's properties and export.
6. **Settings and connectors:** full pages reachable from Home and the top-right pill.

## Visual direction

- A neutral graphite workbench with a white artboard, hairline borders, restrained elevation for floating pills, and one accent for focus, the active tool and primary actions.
- Geist Sans and Geist Mono, bundled locally, with tabular figures for coordinates and zoom. Lucide-style stroke icons only; no emoji or Unicode glyph icons.
- No ambient glow, glassmorphism or decorative gradients in the work shell.
- Dark, light and high-contrast themes from one token set. Use a text label alongside color for connection, save, error and generation state.
- Keep empty states short and actionable, and label anything unavailable honestly.

## Acceptance matrix

| Viewport | Acceptance |
| --- | --- |
| 390×844 | Compact top bar, bottom tool bar and agent sheet; the artboard stays visible; 44px touch targets. |
| 768×900 | The right panel becomes a drawer; no panel overlap; tools remain reachable. |
| 1280×800 | Both side panels open with at least 640×500 of unobstructed canvas; no overlap or clipping. |
| 1440×900 | Matches the Target UI artboards. |
| 1920×1080 | The canvas stays primary; side panels do not expand into oversized empty regions. |
| All widths | Body text contrast at least 4.5:1; control boundaries and focus indicators at least 3:1; complete keyboard order and visible focus; reduced-motion behavior; screen-reader names and status for controls and updates. |

## Current implementation boundary

The shipped Studio still uses the v1 shell: a flat top bar, a Recents overlay, one side panel at a time, and chat only inside the VS Code editor tab. The Target UI describes where Phases 14–24 take it; see the plan for what is complete.

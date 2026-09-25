# Codex Avatar Studio design system

The Studio v2 tokens in [`apps/studio/src/styles/tokens.css`](../apps/studio/src/styles/tokens.css) follow the local [Target UI artboards](design/target-ui/README.md). The artboards specify the dark and light palettes; the high-contrast palette extends the same token names. Home, the editor, the agent panel, Settings, and Connectors use these tokens. Brand, icons, and copy are this product's own. Paper and pen.dev contribute layout patterns only.

## Direction

- **Visual thesis:** a quiet graphite workbench, with the white artboard as the dominant plane and one blue accent for action and focus.
- **Content plan:** Home orients the user around a working composer and recent projects; the editor gives most space to the canvas, then project state, tools, the agent panel, and properties.
- **Interaction thesis:** floating pills clarify the current mode and state; menus and panels respond quickly; canvas input remains direct. Motion must respect reduced-motion preferences.

Use plain layout and dividers for routine UI. Reserve elevation for floating controls, menus, and dialogs. No ambient glow, glassmorphism, decorative gradients, borrowed logos, or decorative emoji belong in the work shell.

## Tokens

All three themes expose the same names through `.studio-app` and its `data-theme` variants; the warm Kurva paper palette below is what `tokens.css` ships. Section dividers use the subtle hairline; interactive boundaries use the stronger control-border token so controls remain perceivable.

| Token | Dark | Light (Kurva paper, standalone default) | High contrast |
| --- | --- | --- | --- |
| Canvas `--studio-canvas` | `#16150f` | `#f3eee3` | `#000000` |
| Panel `--studio-surface-0` | `#16150f` | `#fbf8f1` | `#000000` |
| Raised `--studio-surface-1` | `#201e17` | `#fbf8f1` | `#080808` |
| Raised `--studio-surface-2` | `#2a271f` | `#f3eee3` | `#151515` |
| Active `--studio-surface-active` | `#2a271f` | `#efe8da` | `#262600` |
| Divider / hairline | ink 14% | paper ink 14% | `#ffffff` |
| Control boundary `--studio-control-border` | `#a9a294` | `#5a554b` | `#ffffff` |
| Primary text `--studio-text-primary` | `#efe9dc` | `#1b1a17` | `#ffffff` |
| Secondary text `--studio-text-secondary` | `#a9a294` | `#5a554b` | `#ffffff` |
| Muted text `--studio-text-muted` | `#a9a294` | `#5a554b` | `#ffffff` |
| Accent `--studio-accent` | `#f0623a` | `#b53a17` | `#ffff00` |
| Accent text `--studio-accent-contrast` | `#16150f` | `#fbf8f1` | `#000000` |
| Success `--studio-success` | `#8fd694` | `#1f7a4d` | `#00ff85` |
| Warning `--studio-warning` | `#f0a35e` | `#b4531f` | `#ffff00` |
| Error `--studio-danger` | `#ff9fa3` | `#b42335` | `#ff8585` |
| Grid dot `--studio-grid-dot` | `#3a362c` | `#c4bfb6` | `#666666` |

The canvas dot grid uses a 1px dot on a 16px grid. Spacing uses 4px increments. Controls use a 6px radius, panels 14px, and pills 999px. Floating pills have their own `--studio-elevation-pill` token; panels and dialogs have separate elevation tokens. The Studio build bundles Hanken Grotesk (UI text), Fraunces Variable (display), IBM Plex Mono and Geist fonts locally; no remote font requests. UI body, meta, and caption sizes are 13px, 12px, and 11px. Coordinates and zoom use tabular figures.

Measured contrast (WCAG 2.x ratios, recomputed 2026-09-25 against the current palette; panel surface = light `--studio-surface-0`, dark `--studio-surface-1`): light primary 16.41:1, secondary 6.98:1, accent text 5.53:1, text on accent 5.53:1, status 4.72–6.13:1, control boundary 6.98:1; dark primary 13.78:1, secondary 6.58:1, accent text 5.17:1, text on accent 5.67:1, status 8.02–9.70:1, control boundary 6.58:1. Every pair meets WCAG AA (4.5:1 for text, 3:1 for control boundaries). These calculations cover the token pairs; the completed screens still need visual and keyboard acceptance at every target width.

## Current behavior and acceptance

The existing Studio shell has a project bar, compact tool rail, Recents overlay, and mutually exclusive Conversation and Inspector panels. This is the v1 layout, not the target arrangement. The tldraw artboard keeps a light shape palette so design frames remain clear. The canvas background and high-contrast focus follow Studio tokens.

The standalone Studio opens on the Kurva paper light theme; inside the VS Code Webview it follows the editor theme (`vscode-light` / `vscode-dark` / `vscode-high-contrast` body classes) until the user picks one. A picked theme is saved in browser-local storage and wins from then on. The theme control cycles light → dark → high contrast, keeping dark one click away from the default, and Settings → Appearance offers each theme directly. The visible focus ring is 2px, or 3px in high-contrast mode. At 900px and below, the tool rail moves above the canvas and an open context panel follows the visible canvas. Reduced-motion preferences disable transitions and animations. The later Phase 14 and 16 checks cover complete keyboard order, screen-reader names, and acceptance at 390, 768, 1280, 1440, and 1920px.

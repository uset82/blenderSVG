# Codex Avatar Studio design system

The Studio v2 tokens in [`apps/studio/src/styles/tokens.css`](../apps/studio/src/styles/tokens.css) follow the local [Target UI artboards](design/target-ui/README.md). The artboards specify the dark and light palettes; the high-contrast palette extends the same token names. Home, the editor, the agent panel, Settings, and Connectors use these tokens. Brand, icons, and copy are this product's own. Paper and pen.dev contribute layout patterns only.

## Direction

- **Visual thesis:** a quiet graphite workbench, with the white artboard as the dominant plane and one blue accent for action and focus.
- **Content plan:** Home orients the user around a working composer and recent projects; the editor gives most space to the canvas, then project state, tools, the agent panel, and properties.
- **Interaction thesis:** floating pills clarify the current mode and state; menus and panels respond quickly; canvas input remains direct. Motion must respect reduced-motion preferences.

Use plain layout and dividers for routine UI. Reserve elevation for floating controls, menus, and dialogs. No ambient glow, glassmorphism, decorative gradients, borrowed logos, or decorative emoji belong in the work shell.

## Tokens

All three themes expose the same names through `.studio-app` and its `data-theme` variants. Section dividers use the subtle hairline; interactive boundaries use the stronger control-border token so controls remain perceivable.

| Token | Dark | Light | High contrast |
| --- | --- | --- | --- |
| Canvas `--studio-canvas` | `#151516` | `#f3f3f1` | `#000000` |
| Panel `--studio-surface-0` | `#1b1b1d` | `#ffffff` | `#000000` |
| Raised `--studio-surface-1` | `#232326` | `#f7f7f5` | `#080808` |
| Active `--studio-surface-2` | `#2b2b2f` | `#efefec` | `#151515` |
| Divider `--studio-divider` | `#2e2e32` | `#e4e4e1` | `#ffffff` |
| Hairline `--studio-hairline` | white 8% | graphite 8% | `#ffffff` |
| Control boundary `--studio-control-border` | `#8b8b93` | `#6b6b73` | `#ffffff` |
| Primary text `--studio-text-primary` | `#ededef` | `#18181b` | `#ffffff` |
| Secondary text `--studio-text-secondary` | `#a3a3aa` | `#52525b` | `#ffffff` |
| Muted text `--studio-text-muted` | `#8b8b93` | `#6b6b73` | `#ffffff` |
| Accent `--studio-accent` | `#7aa7ff` | `#2d62d6` | `#ffff00` |
| Accent text `--studio-accent-contrast` | `#0d1526` | `#ffffff` | `#000000` |
| Success `--studio-success` | `#8fd694` | `#1f7a4d` | `#00ff85` |
| Warning `--studio-warning` | `#f0a35e` | `#b4531f` | `#ffff00` |
| Error `--studio-danger` | `#ff9fa3` | `#b42335` | `#ff8585` |

The dark artboard uses a `#2a2a2d` dot on a 16px grid; the light artboard uses `#d6d6d1`. Spacing uses 4px increments. Controls use an 8px radius, panels 12px, and pills 999px. Floating pills have their own `--studio-elevation-pill` token; panels and dialogs have separate elevation tokens. Geist Sans and Geist Mono are bundled in the Studio build. UI body, meta, and caption sizes are 13px, 12px, and 11px. Coordinates and zoom use tabular figures.

Measured foreground contrast on the panel surface: dark primary 14.71:1, secondary 6.86:1, muted 5.09:1; light primary 17.72:1, secondary 7.73:1, muted 5.28:1. Accent text measures 7.64:1 in dark and 5.48:1 in light. Interactive boundary colors measure 5.09:1 in dark and 5.28:1 in light against the panel. These calculations cover the token pairs; the completed screens still need visual and keyboard acceptance at every target width.

## Current behavior and acceptance

The existing Studio shell has a project bar, compact tool rail, Recents overlay, and mutually exclusive Conversation and Inspector panels. This is the v1 layout, not the target arrangement. The tldraw artboard keeps a light shape palette so design frames remain clear. The canvas background and high-contrast focus follow Studio tokens.

The theme control cycles dark → light → high contrast and stores only the appearance preference in browser-local storage. The visible focus ring is 2px, or 3px in high-contrast mode. At 900px and below, the tool rail moves above the canvas and an open context panel follows the visible canvas. Reduced-motion preferences disable transitions and animations. The later Phase 14 and 16 checks cover complete keyboard order, screen-reader names, and acceptance at 390, 768, 1280, 1440, and 1920px.

# Performance and Stability Budgets

The base assistant keeps the SVG runtime available while optional renderers are loaded only when selected. These are the current measured safeguards and budgets:

| Area | Budget or safeguard | Verification |
| --- | --- | --- |
| Visible animation | 30 FPS by default; 60 FPS is opt-in | Pixi lifecycle debug info and runtime tests |
| Hidden Webview | Visibility change stops Pixi ticker and optional animation loops | Webview source smoke and Pixi lifecycle tests |
| Canvas size | Maximum 2048×2048 logical pixels, resolution capped at 2× | Pixi oversized-canvas test |
| Texture cache | 8 entries and 32 MiB estimated RGBA memory by default | Texture cache eviction and byte-budget tests |
| Runtime startup | Pixi initialization fails closed after 8 seconds in the Webview; runtime default is 10 seconds | Stalled-initialization test and Webview source smoke |
| Runtime recovery | Pixi initialization/render errors switch to the SVG fallback | Runtime boundary and Pixi error-path tests |
| Lifecycle | Twenty open/close cycles dispose their application and canvas; repeated initialization disposes the previous application | Pixi lifecycle test |
| Optional loading | Pixi is dynamically imported; optional runtime chunks stay out of the base Webview entry | Webview bundle smoke |

`PixiAvatarRuntime.getDebugInfo()` exposes renderer, bounded canvas dimensions, frame cap, visibility, state, and estimated texture memory for development diagnostics. The values are diagnostics, not a promise of exact GPU allocation; browser and driver overhead is outside the estimate.

The repository CI gate currently covers formatting, lint, typecheck, 19 avatar-core tests, 17 asset-pipeline tests, 18 Pixi tests, extension tests, Webview smoke tests, and all builds. Run `pnpm run ci` after runtime or Webview changes.

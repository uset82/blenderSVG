# Third-Party Notices

> Regenerated from the installed workspace manifests — 2026-07-12

Codex Avatar Studio is currently marked `UNLICENSED`. Third-party components retain their own copyrights and licenses. This inventory records direct dependencies; it does not relicense them.

The authoritative engineering review, optional-runtime restrictions, asset policy, and audited upstream SHAs are in [`docs/LICENSING.md`](docs/LICENSING.md).

## Current direct dependencies

Exact versions were read from `pnpm list -r --depth 0` on 2026-07-12.

| Component | Version | License | Upstream |
| --- | ---: | --- | --- |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | <https://github.com/biomejs/biome> |
| `@vitejs/plugin-react` | 5.2.0 | MIT | <https://github.com/vitejs/vite-plugin-react> |
| `@vscode/vsce` | 3.9.2 | MIT | <https://github.com/microsoft/vscode-vsce> |
| `esbuild` | 0.28.1 | MIT | <https://github.com/evanw/esbuild> |
| `fast-xml-parser` | 5.9.3 | MIT | <https://github.com/NaturalIntelligence/fast-xml-parser> |
| `imagetracerjs` | 1.2.6 | Unlicense | <https://github.com/jankovicsandras/imagetracerjs> |
| `jimp` | 0.14.0 | MIT | <https://github.com/oliver-moran/jimp> |
| `pixi.js` | 8.14.0 | MIT | <https://github.com/pixijs/pixi.js> |
| `react` / `react-dom` | 19.2.7 | MIT | <https://github.com/facebook/react> |
| `svgo` | 4.0.1 | MIT | <https://github.com/svg/svgo> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `vite` | 7.3.6 | MIT | <https://github.com/vitejs/vite> |
| `vitest` | 4.1.10 | MIT | <https://github.com/vitest-dev/vitest> |
| `zod` | 4.4.3 | MIT | <https://github.com/colinhacks/zod> |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/vscode` | lockfile versions | MIT | <https://github.com/DefinitelyTyped/DefinitelyTyped> |

The image-to-SVG path uses `imagetracerjs@1.2.6` (Unlicense) and `jimp@0.14.0` (MIT). The GPL-2.0 Potrace dependency is absent from the workspace manifests and lockfile. `scripts/validate-vsix.mjs` rejects a packaged extension bundle containing the removed dependency name.

## Deferred or not installed

These packages are not present in the current lockfile and must stay out of the base VSIX until a later optional phase re-approves them:

| Component | Reviewed version | License | Notes |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | Deferred optional runtime; not installed |
| `three` | 0.185.1 | MIT | Deferred optional 3D runtime; not installed |
| `sharp` | 0.35.3 | Apache-2.0 | Optional local preprocessing only; native binaries need packaging review |
| `motion` | 12.42.2 | MIT | Optional Webview transitions only |
| `@pixiv/three-vrm` | 3.5.5 | MIT | Deferred post-MVP 3D adapter only |

## Special restrictions

- Live2D Cubism is governed by separate Live2D SDK and publication agreements. No proprietary SDK binary, Core file, sample model, texture, or motion may be committed or distributed without explicit permission.
- Blender is an optional user-installed external program. Blender binaries and sample assets are not part of this project.
- Inochi2D code is reviewed under BSD-2-Clause, but Inochi models and artwork require independent licenses.
- Repository code licenses never imply permission to copy demo characters, voices, models, artwork, screenshots, or textures.

## Packaging requirement

Before a release candidate is distributed, regenerate this inventory from the installed manifests (`pnpm validate:notices`), include all license texts and copyright notices required by the packaged dependencies, and validate the actual VSIX contents. A dependency listed here but absent from the VSIX does not need to be represented as bundled code; a dependency present in the VSIX must never be omitted from the final notices.

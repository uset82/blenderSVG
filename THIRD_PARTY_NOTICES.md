# Third-Party Notices

> Phase 0 inventory — 2026-07-10

Codex Avatar Studio is currently marked `UNLICENSED`. Third-party components retain their own copyrights and licenses. This inventory records direct dependencies and reviewed additions; it does not relicense them.

The authoritative engineering review, optional-runtime restrictions, asset policy, and audited upstream SHAs are in [`docs/LICENSING.md`](docs/LICENSING.md).

## Current direct dependencies

| Component | Version | License | Upstream |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | <https://github.com/rive-app/rive-react> |
| `@vitejs/plugin-react` | 5.2.0 | MIT | <https://github.com/vitejs/vite-plugin-react> |
| `@vscode/vsce` | 3.9.2 | MIT | <https://github.com/microsoft/vscode-vsce> |
| `esbuild` | 0.28.1 | MIT | <https://github.com/evanw/esbuild> |
| `fast-xml-parser` | 5.9.3 | MIT | <https://github.com/NaturalIntelligence/fast-xml-parser> |
| `imagetracerjs` | 1.2.6 | Unlicense | <https://github.com/jankovicsandras/imagetracerjs> |
| `jimp` | 0.14.0 | MIT | <https://github.com/oliver-moran/jimp> |
| `react` / `react-dom` | 19.2.7 | MIT | <https://github.com/facebook/react> |
| `three` | 0.185.1 | MIT | <https://github.com/mrdoob/three.js> |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `vite` | 7.3.6 | MIT | <https://github.com/vitejs/vite> |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/vscode` | lockfile versions | MIT | <https://github.com/DefinitelyTyped/DefinitelyTyped> |

The image-to-SVG implementation now uses `imagetracerjs@1.2.6` and `jimp@0.14.0`; the GPL-2.0 Potrace dependency has been removed from the asset-pipeline manifest and lockfile. The VSIX validator also scans the bundled extension code for the removed dependency name.

## Reviewed additions for the PixiJS-first plan

These components are not all installed yet. Their license metadata was reviewed before their numbered implementation phase:

| Component | Audit version | License | Upstream |
| --- | ---: | --- | --- |
| `pixi.js` | 8.19.0 | MIT | <https://github.com/pixijs/pixijs> |
| `zod` | 4.4.3 | MIT | <https://github.com/colinhacks/zod> |
| `vitest` | 4.1.10 | MIT | <https://github.com/vitest-dev/vitest> |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | <https://github.com/biomejs/biome> |
| `@vscode/test-electron` | 3.0.0 | MIT | <https://github.com/microsoft/vscode-test> |
| `svgo` | 4.0.1 | MIT | <https://github.com/svg/svgo> |
| `sharp` | 0.35.3 | Apache-2.0 | <https://github.com/lovell/sharp> |
| `motion` | 12.42.2 | MIT | <https://github.com/motiondivision/motion> |
| `@pixiv/three-vrm` | 3.5.5 | MIT | <https://github.com/pixiv/three-vrm> |

## Special restrictions

- Live2D Cubism is governed by separate Live2D SDK and publication agreements. No proprietary SDK binary, Core file, sample model, texture, or motion may be committed or distributed without explicit permission.
- Blender is an optional user-installed external program. Blender binaries and sample assets are not part of this project.
- Inochi2D code is reviewed under BSD-2-Clause, but Inochi models and artwork require independent licenses.
- Repository code licenses never imply permission to copy demo characters, voices, models, artwork, screenshots, or textures.

## Packaging requirement

Before a release candidate is distributed, regenerate this inventory from the final lockfile, include all license texts and copyright notices required by the packaged dependencies, and validate the actual VSIX contents. A dependency listed here but absent from the VSIX does not need to be represented as bundled code; a dependency present in the VSIX must never be omitted from the final notices.

# Licensing and Provenance Policy

> Phase 0 audit snapshot — 2026-07-10

This file records the implementation license gate for Codex Avatar Studio. It is an engineering compliance record, not legal advice.

## Project license status

The repository's `LICENSE` file currently marks the project **UNLICENSED / all rights reserved**. That project-level status does not replace third-party license obligations. Every distributed dependency, copied source fragment, runtime SDK, artwork file, model, texture, voice, font, and generated derivative must have separate provenance and redistribution review.

## Non-negotiable asset policy

- Code licenses and artwork/model licenses are reviewed separately.
- Do not copy the appearance, personality, artwork, models, voices, textures, demo characters, or other proprietary assets of Grok Ani, Rudi, AITuber OnAir, Project AIRI, TalkingHead, Live2D samples, Inochi2D samples, or any other upstream project.
- Upstream demo assets are not approved merely because their containing code repository is open source.
- The built-in SVG and PixiJS spritesheet must be clean-room, original project work with recorded authorship and redistribution permission.
- Imported avatar packages remain local by default and must expose author and license metadata. Remote asset URLs are rejected by default.
- No microphone, cloud, marketplace, or remote asset service is licensed or required by the MVP.

## Current direct dependency audit

Exact installed versions were read from `pnpm list -r --depth 0 --json` and their installed `package.json` files.

| Dependency | Version | SPDX/license | Disposition |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | Existing optional code; retained but deferred outside the PixiJS-first MVP |
| `@vitejs/plugin-react` | 5.2.0 | MIT | Approved build-time dependency |
| `@vscode/vsce` | 3.9.2 | MIT | Approved packaging dependency |
| `esbuild` | 0.28.1 | MIT | Approved build-time dependency |
| `fast-xml-parser` | 5.9.3 | MIT | Approved for local XML/SVG parsing, subject to sanitization controls |
| `potrace` | 2.1.8 | GPL-2.0 | **Migration required.** Do not expand or ship in the final base VSIX; replace with the approved permissive tracing choice in Phase 11 |
| `react` / `react-dom` | 19.2.7 | MIT | Approved Webview dependencies |
| `three` | 0.185.1 | MIT | Existing optional 3D dependency; deferred and must remain out of the base MVP bundle |
| `typescript` | 5.9.3 | Apache-2.0 | Approved build-time dependency |
| `vite` | 7.3.6 | MIT | Approved Webview build dependency |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/vscode` | lockfile versions | MIT | Approved development-only type packages |

### Potrace decision

The installed `potrace@2.1.8` package declares `GPL-2.0`. The preserved baseline can remain untouched during the earlier ordered phases, but the project will not expand that code path or treat it as the planned MVP vectorizer. The new Phase 11 pipeline selects `imagetracerjs@1.2.6` (Unlicense) unless a later security/quality review rejects it. Packaging must prove that Potrace and its transitive runtime are absent from the base VSIX before release.

## Approved or reviewed MVP additions

The following registry metadata was reviewed on 2026-07-10. Versions are the audit snapshot; Phase 1 must pin compatible versions in the lockfile and re-run the license check.

| Dependency | Audit version | SPDX/license | Planned use |
| --- | ---: | --- | --- |
| `pixi.js` | 8.19.0 | MIT | Required 2D runtime |
| `zod` | 4.4.3 | MIT | Runtime schema validation |
| `vitest` | 4.1.10 | MIT | Unit tests |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | Formatter and linter |
| `@vscode/test-electron` | 3.0.0 | MIT | Extension integration tests |
| `svgo` | 4.0.1 | MIT | Conservative SVG optimization |
| `imagetracerjs` | 1.2.6 | Unlicense | Planned local raster tracing replacement |

These candidates are reviewed but not automatically authorized for immediate installation outside their numbered phase:

| Dependency | Audit version | SPDX/license | Restriction |
| --- | ---: | --- | --- |
| `sharp` | 0.35.3 | Apache-2.0 | Optional local preprocessing only; review native-binary packaging before use |
| `motion` | 12.42.2 | MIT | Optional interface transitions only; do not add unless the Webview needs it |
| `@pixiv/three-vrm` | 3.5.5 | MIT | Deferred post-MVP 3D adapter only |

## Upstream reference snapshot

The following repositories are **references only**. HEAD SHAs were captured with `git ls-remote <repository> HEAD` on 2026-07-10; license identifiers were checked against the repositories' GitHub metadata/license files.

| Upstream | License | Audited HEAD SHA | Use decision |
| --- | --- | --- | --- |
| [AITuber OnAir](https://github.com/shinshin86/aituber-onair) | MIT | `53b2f67982c2d7951e4c50ae8555b46cffc9d929` | Reference-only; no modules or assets adapted for the MVP |
| [PixiJS](https://github.com/pixijs/pixijs) | MIT | `497a53ca60e3c46ca01cd3efbb9ca0a4f37e3b10` | Runtime API/reference; package consumption only |
| [PixiJS skills](https://github.com/pixijs/pixijs-skills) | MIT | `6aae70d76cf410432dd144029c07a1ad4bb12793` | Coding reference only; do not bundle |
| [Inochi2D](https://github.com/Inochi2D/inochi2d) | BSD-2-Clause | `8e296345501583c85d5672890499eade5ee4fedd` | Deferred optional runtime research only |
| [Inochi Creator](https://github.com/Inochi2D/inochi-creator) | BSD-2-Clause | `dba60811cff224f8cc9ce367b1d9291bfa5f7640` | Deferred workflow reference only |
| [Project AIRI](https://github.com/moeru-ai/airi) | MIT | `9560a26fe24170274442ad53d89cab7e5fe251e1` | Architecture reference only; no assets copied |
| [TalkingHead](https://github.com/met4citizen/TalkingHead) | MIT | `eed58d198076a7e1e825f804802921c4d3804d46` | Architecture reference only; no assets copied |
| [three-vrm](https://github.com/pixiv/three-vrm) | MIT | `ff42fae4fcee1fcbca2cd262c7f5f8cbddeaf5ab` | Deferred optional adapter dependency |

## Proprietary and external-tool gates

### Live2D

Live2D Cubism is not an ordinary permissive open-source dependency. Development and publication are governed by Live2D's proprietary/open software agreements and release-license terms. Do not commit or distribute Cubism SDK binaries, Core files, sample models, textures, or proprietary assets. Phase 16 remains deferred until a dedicated licensing review is repeated for the intended publisher and distribution model.

### Blender

Blender is an optional external executable and must never be bundled or required by the extension. Project-authored Blender Python scripts may invoke a user-installed Blender process in Phase 17, but Blender's own binaries and sample assets are not distributed by this project.

### Inochi2D and VRM

The code licenses recorded above do not license user models. Every `.inp`, `.inx`, `.vrm`, `.glb`, texture, motion, and expression file requires its own author/license metadata and redistribution review.

## Current built-in asset inventory

| Asset | SHA-256 | Phase 0 disposition |
| --- | --- | --- |
| `apps/extension/media/avatars/svg/placeholder-avatar.svg` | `2F7389390C64D310F9849CE7ECA519CE514CB2E942B6E63764EEBAD10F21D980` | Existing simple orb placeholder; retain as user-owned baseline, but create/attest the final clean-room built-in asset before release |
| `apps/extension/media/icon.png` | `5CAB19385AA3C98570C3D75B5CC1F2C60873D635EAA75713B10099B0CFDA1843` | Existing icon derived from the same simple orb concept; retain as baseline pending final authorship attestation |

No `.riv`, `.glb`, `.vrm`, Live2D model, spritesheet, voice, or third-party character asset is present in the active source asset inventory. Generated Webview JavaScript is code output, not avatar artwork.

## Required release actions

- Generate `THIRD_PARTY_NOTICES.md` entries from the final lockfile and include required license texts in the VSIX.
- Prove optional runtime packages and the GPL-2.0 Potrace path are absent from the base bundle.
- Attach authorship/license metadata to the original built-in SVG and PixiJS spritesheet.
- Re-run dependency and asset license checks before every release candidate.
- Treat any unknown or ambiguous asset license as non-redistributable until resolved.


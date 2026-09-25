# Third-Party Notices

> Updated against the installed workspace manifests — 2026-09-23

Codex Avatar Studio is currently marked `UNLICENSED`. Third-party components retain their own copyrights and licenses. This inventory records direct dependencies; it does not relicense them.

The authoritative engineering review, optional-runtime restrictions, asset policy, and audited upstream SHAs are in [`docs/LICENSING.md`](docs/LICENSING.md).

## Current direct dependencies

Exact versions were checked against the installed workspace manifests and lockfile on 2026-09-23.

| Component | Version | License | Upstream |
| --- | ---: | --- | --- |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 | <https://github.com/biomejs/biome> |
| `@modelcontextprotocol/sdk` | 1.30.0 | MIT | <https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x> |
| `@vitejs/plugin-react` | 5.2.0 | MIT | <https://github.com/vitejs/vite-plugin-react> |
| `@vscode/vsce` | 3.9.2 | MIT | <https://github.com/microsoft/vscode-vsce> |
| `esbuild` | 0.28.1 | MIT | <https://github.com/evanw/esbuild> |
| `fake-indexeddb` | 6.2.5 | Apache-2.0 | <https://github.com/dumbmatter/fakeIndexedDB> |
| `fast-xml-parser` | 5.11.1 | MIT | <https://github.com/NaturalIntelligence/fast-xml-parser> |
| `@fontsource/geist-sans` / `@fontsource/geist-mono` | 5.3.0 | OFL-1.1 | <https://fontsource.org/fonts/geist> · bundled font license below |
| `@fontsource-variable/fraunces` | 5.3.0 | OFL-1.1 | <https://fontsource.org/fonts/fraunces> |
| `@fontsource/hanken-grotesk` | 5.3.0 | OFL-1.1 | <https://fontsource.org/fonts/hanken-grotesk> |
| `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | <https://fontsource.org/fonts/ibm-plex-mono> |
| `@resvg/resvg-js` | 2.6.2 | MPL-2.0 | <https://github.com/yisibl/resvg-js> |
| `hono` | 4.13.8 | MIT | <https://github.com/honojs/hono> |
| `@napi-rs/keyring` | 2.1.0 | MIT | <https://github.com/Brooooooklyn/keyring-node> |
| `imagetracerjs` | 1.2.6 | Unlicense | <https://github.com/jankovicsandras/imagetracerjs> |
| `jimp` | 0.14.0 | MIT | <https://github.com/oliver-moran/jimp> |
| `lucide-react` | 1.47.0 | ISC, with MIT for Feather-derived icons | <https://github.com/lucide-icons/lucide> · bundled license below |
| `pixi.js` | 8.14.0 | MIT | <https://github.com/pixijs/pixi.js> |
| `playwright` | 1.63.0 | Apache-2.0 | <https://github.com/microsoft/playwright> |
| `radix-ui` | 1.6.7 | MIT | <https://www.radix-ui.com/> · bundled license below |
| `react` / `react-dom` | 19.2.7 | MIT | <https://github.com/facebook/react> |
| `react-markdown` | 10.1.0 | MIT | <https://github.com/remarkjs/react-markdown> |
| `rehype-sanitize` | 6.0.0 | MIT | <https://github.com/rehypejs/rehype-sanitize> |
| `@testing-library/dom` | 10.4.2 | MIT | <https://github.com/testing-library/dom-testing-library> |
| `@testing-library/react` | 16.3.3 | MIT | <https://github.com/testing-library/react-testing-library> |
| `jsdom` | 30.1.1 | MIT | <https://github.com/jsdom/jsdom> |
| `ws` | 8.21.3 | MIT | <https://github.com/websockets/ws> |
| `svgo` | 4.1.0 | MIT | <https://github.com/svg/svgo> |
| `three` | 0.185.1 | MIT | <https://github.com/mrdoob/three.js> |
| `tldraw` / `@tldraw/tldraw` / `@tldraw/assets` | 5.4.2 | tldraw license | <https://tldraw.dev/community/license> · production use requires a valid license key |
| `typescript` | 5.9.3 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| `@visioncortex/vtracer` | 1.0.0-alpha.4 | MIT OR Apache-2.0 | <https://github.com/visioncortex/vtracer> |
| `vite` | 7.3.6 | MIT | <https://github.com/vitejs/vite> |
| `vitest` | 4.1.10 | MIT | <https://github.com/vitest-dev/vitest> |
| `zod` | 4.4.3 | MIT | <https://github.com/colinhacks/zod> |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/vscode` | lockfile versions | MIT | <https://github.com/DefinitelyTyped/DefinitelyTyped> |

The image-to-SVG path uses `imagetracerjs@1.2.6` (Unlicense), `jimp@0.14.0` (MIT), and the local `@visioncortex/vtracer@1.0.0-alpha.4` WASM build (MIT OR Apache-2.0; copyright 2024 TSANG, Hao Fung). See the [VTracer license](https://github.com/visioncortex/vtracer/blob/master/LICENSE). The GPL-2.0 Potrace dependency is absent from the workspace manifests and lockfile. `scripts/validate-vsix.mjs` rejects a packaged extension bundle containing the removed dependency name.

## Project-local Blender skills

These source-pinned development skills live under `.agents/skills` and are not included in the distributable VSIX:

| Skills | Source pin | License and notice |
| --- | --- | --- |
| `blender-modeling`, `blender-materials`, `blender-animation`, `blender-export`, `animation-quality-gate` | [`roble3/cc-blender-skill@11016c9a5847897491dde935c346571bd7548e3d`](https://github.com/roble3/cc-blender-skill/tree/11016c9a5847897491dde935c346571bd7548e3d) | MIT; Copyright (c) 2026 RobLe3. Full terms: [upstream LICENSE](https://github.com/roble3/cc-blender-skill/blob/11016c9a5847897491dde935c346571bd7548e3d/LICENSE). |
| `rigging-animation` | [`omer-metin/skills-for-antigravity@e8dcf4e8737921a10088bd5c9eb65e81f74c051f`](https://github.com/omer-metin/skills-for-antigravity/tree/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/rigging-animation) | Apache-2.0. Full terms: [upstream LICENSE](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/LICENSE). |
| `blender-motion-state-inspection` | [`affaan-m/everything-claude-code@ed387446052dfbc6b52de149406b70efa65edc59`](https://github.com/affaan-m/everything-claude-code/tree/ed387446052dfbc6b52de149406b70efa65edc59/skills/blender-motion-state-inspection) | MIT; Copyright (c) 2026 Affaan Mustafa. Full terms: [upstream LICENSE](https://github.com/affaan-m/everything-claude-code/blob/ed387446052dfbc6b52de149406b70efa65edc59/LICENSE). |

Blender MCP is optional developer tooling, not a VSIX dependency. The project configuration pins `blender-mcp==1.6.4`; its Blender add-on is pinned to commit `6641189231caf3752302ae20591bc87fda85fc4e` and raw-download SHA-256 `BBA60831F5F89A74DEDA0294B131668A086CF46EB35A6A01ABBD0D21D9E92630` (the CRLF-normalized checkout hash is `3A517C6BA6EC3168C021A1A5D5F5F3F993EB64B1D2DBFE8927E28464EFE8AC36`). The add-on remains governed by its [upstream terms](https://github.com/ahujasid/blender-mcp/blob/6641189231caf3752302ae20591bc87fda85fc4e/TERMS_AND_CONDITIONS.md) and is installed into the user's Blender profile only by the explicit setup command.

## Deferred or not installed

These packages are not present in the current lockfile and must stay out of the base VSIX until a later optional phase re-approves them:

| Component | Reviewed version | License | Notes |
| --- | ---: | --- | --- |
| `@rive-app/react-webgl2` | 4.29.4 | MIT | Deferred optional runtime; not installed |
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

## Bundled Geist font licenses

The Studio bundle self-hosts Geist Sans and Geist Mono from Fontsource. The following copyright and license text accompanies the font files in the built assets.

### Geist Sans

Geist Sans and Geist Mono Font
(C) 2023 Vercel, made in collaboration with basement.studio

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: http://scripts.sil.org/OFL and copied below

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

### Geist Mono

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git) GeistMono-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

## Bundled Lucide license

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bundled Radix UI license

MIT License

Copyright (c) 2022 WorkOS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

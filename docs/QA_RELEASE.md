# QA and Release

## Automated Checks

Run these from the repository root before a release or PR handoff:

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke:webview
```

Expected coverage:

- TypeScript builds every workspace package.
- Typecheck and lint run with strict TypeScript settings.
- `avatar-core` validates state, manifest, runtime fallback, Live2D mapping, GPU guards, and reduced motion helpers.
- `asset-pipeline` validates image metadata, output paths, SVG optimization, layer checks, manifest entries, and an end-to-end local vectorize output.
- `extension` smoke tests command contribution, activation events, strict Webview CSP, asset reload messaging, and Blender dry-run export plans.
- `webview` smoke tests built entry assets, lazy runtime chunks, asset manager styles, and bridge commands.
- `smoke:webview` serves the bundled webview locally and verifies React mounts in headless Edge.

## Manual QA Checklist

- [ ] Launch Extension Development Host.
- [ ] Run `Codex Avatar: Open Assistant`.
- [ ] Confirm the Assistant view appears in the activity bar.
- [ ] Confirm the SVG fallback avatar renders before any optional runtime assets are present.
- [ ] Run `Codex Avatar: Set State` and preview several states.
- [ ] Trigger thinking, speaking, success, and error commands from the Command Palette.
- [ ] Toggle enabled/disabled from both Command Palette and Webview UI.
- [ ] Change runtime, character, position, intensity, reduced motion, and speech bubble settings.
- [ ] Reload the window and confirm settings persisted.
- [ ] Use Reset Settings and confirm defaults return without restart.
- [ ] Open the Asset Manager and confirm manifest, runtime, warnings, and action buttons are visible.
- [ ] Use Open Avatar Assets Folder and confirm the workspace-local asset folder opens.
- [ ] Use Validate Manifest and confirm missing optional assets are listed clearly.
- [ ] Use Reload Avatar and confirm the avatar reloads without restarting the extension host.
- [ ] Run Vectorize Image to SVG with a small PNG/JPG/WebP and confirm local `.codex-avatar/exports/svg/` output.
- [ ] Run Blender export with no Blender configured and confirm the friendly setup warning appears.
- [ ] If Blender is installed, run SVG, GLB, and PNG preview exports on a test `.blend`.
- [ ] Verify reduced-motion behavior with system reduced motion enabled.
- [ ] Verify focus mode reduces motion and chatter.
- [ ] Inspect Webview developer tools for CSP errors.
- [ ] Confirm there are no remote network calls in normal SVG fallback use.

## Release Gates

- [ ] `pnpm build` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm smoke:webview` passes.
- [ ] Extension Development Host launches.
- [ ] SVG fallback works without optional assets.
- [ ] Missing Rive, Live2D, WebGL, WebGPU, and Blender assets fail gracefully.
- [ ] VSIX packaging succeeds.

Use `docs/RELEASE_CHECKLIST.md` for the release handoff checklist.

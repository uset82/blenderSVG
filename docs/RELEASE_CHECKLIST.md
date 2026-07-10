# Release Checklist

## Preflight

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm smoke:webview`.
- [ ] Run `pnpm package:vsix`.
- [ ] Run `pnpm smoke:vsix`.

## VSIX

- [ ] Confirm `dist/codex-avatar-studio-0.1.0.vsix` exists.
- [ ] Install the VSIX in an isolated VS Code extensions directory.
- [ ] Open Extension Development Host or a local VS Code window with the installed extension.
- [ ] Run `Codex Avatar: Open Assistant`.
- [ ] Confirm SVG fallback renders.
- [ ] Confirm asset manager opens and reload works.
- [ ] Confirm optional missing Rive, Live2D, WebGL, WebGPU, and Blender assets fail gracefully.

## Notes

- The extension host is bundled for VSIX packaging. Optional runtime assets remain separate and local.

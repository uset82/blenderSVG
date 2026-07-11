# Codex Avatar Studio

Codex Avatar Studio is a VS Code/Codex-compatible animated assistant system for the IDE. It starts with a safe local SVG fallback and is designed to grow into optional Rive, Blender/GLB, Live2D, and WebGL/WebGPU runtimes without making any advanced runtime mandatory.

## Architecture

The project is organized as a pnpm TypeScript workspace:

- `apps/extension` hosts the VS Code extension, command registration, settings, and secure Webview provider.
- `apps/webview` hosts the React/Vite Webview UI.
- `packages/avatar-core` contains shared avatar states, runtime interfaces, manifest validation, and event mapping.
- `packages/asset-pipeline` contains local image-to-SVG processing and manifest generation.
- `scripts/blender` contains optional Blender Python exporters.

The runtime strategy is deliberately layered. SVG must always work. Rive, Live2D, WebGL, WebGPU, and Blender assets are optional enhancements that must fail gracefully and fall back to SVG.

## Usage

Open the repository in VS Code, press `F5`, and run `Codex Avatar: Open Assistant` in the Extension Development Host. The assistant starts with the bundled SVG fallback. Use the settings panel to switch runtimes, adjust motion intensity, change the avatar id, and open the asset manager.

Useful commands:

- `Codex Avatar: Set State`
- `Codex Avatar: Vectorize Image to SVG`
- `Codex Avatar: Export Blender Scene`
- `Codex Avatar: Open Avatar Assets Folder`
- `Codex Avatar: Reload Avatar`

Read `docs/USER_GUIDE.md` for installation, package import, settings, and recovery. Read `docs/DEVELOPER_SETUP.md` to build from a clean checkout, and `docs/RUNTIME_ADAPTERS.md` to add a renderer.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke:webview
pnpm package:vsix
pnpm validate:vsix
pnpm smoke:vsix
pnpm smoke:clean-profile
pnpm validate:docs

# Pre-release artifact (does not modify package.json)
pnpm package:vsix:pre
```

Start with:

1. Read `AGENTS.md`.
2. Read `docs/PLAN_CHECKLIST.md`.
3. Read `docs/DEVELOPER_SETUP.md`.
4. Use `docs/CODEX_IDE_PROMPT.md` in Codex IDE.

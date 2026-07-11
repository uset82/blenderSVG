# User Guide

Codex Avatar Studio is a local VS Code extension. The built-in SVG avatar works without an account, a network connection, Blender, or a GPU runtime. PixiJS is loaded only when the selected avatar provides a Pixi entrypoint; a failed optional runtime returns to SVG.

## Install and open the assistant

1. Install VS Code 1.96 or newer.
2. Install the packaged `codex-avatar-studio-<version>.vsix` from **Extensions → … → Install from VSIX**.
3. Open a trusted workspace.
4. Run `Codex Avatar: Open Assistant`, or open the Codex Avatar view from the Activity Bar.
5. If the panel is not visible, run `Codex Avatar: Toggle Assistant` and then `Codex Avatar: Reload Avatar`.

For a source checkout, use the developer steps in [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) and press `F5` to start an Extension Development Host.

## Import an avatar package

1. Prepare a local folder containing `avatar.manifest.json` and its referenced files. The format is documented in [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md).
2. Run `Codex Avatar: Import Avatar Package` and select the manifest or package folder.
3. Review the validation message, including the declared author and license.
4. Run `Codex Avatar: Activate Avatar Package` and select the imported id.
5. Run `Codex Avatar: Reload Avatar` if the panel was already open.

Imports are copied to `.codex-avatar/avatars/<id>/`. Paths must be local and relative to the package. Packages are limited to 128 files, 10 MiB per file, and 64 MiB total. Remote URLs, traversal, symlinks that escape the package, unsafe SVG, invalid checksums, and oversized Pixi metadata are rejected.

To return to the built-in avatar, use `Codex Avatar: Remove Avatar Package`. To remove the copied package completely, use `Codex Avatar: Delete Imported Avatar Package`. Use `Codex Avatar: Clear Generated Cache` to remove generated cache and previews while preserving imports and exports.

## States, triggers, and settings

`Codex Avatar: Set State` lets you preview `idle`, `welcome`, `listening`, `thinking`, `speaking`, `coding`, `reviewing`, `debugging`, `building`, `success`, `warning`, `error`, and `sleeping`. The manual actions `Start Thinking`, `Start Speaking`, `Mark Success`, and `Mark Error` are shortcuts.

The trigger commands cover blink, gaze, nod, shake, celebrate, point, speaking start/stop, particles, and clearing effects. A one-shot trigger returns to the current state automatically when the selected runtime supports it.

Use `Codex Avatar: Open Settings` to change runtime, character id, frame rate, intensity, particles, sound, lip sync, idle/sleep timeouts, reduced motion, focus mode, speech bubbles, and the asset workspace. `soundEnabled` and `lipSyncEnabled` are opt-in; the MVP does not request microphone permission.

## Local outputs

- Imported packages: `.codex-avatar/avatars/`
- Generated cache and previews: `.codex-avatar/cache/` and `.codex-avatar/previews/`
- SVG exports: `.codex-avatar/exports/svg/`
- Blender exports: `.codex-avatar/exports/blender/`

The [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md), [PERFORMANCE.md](PERFORMANCE.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) documents explain data handling, resource limits, and recovery steps.

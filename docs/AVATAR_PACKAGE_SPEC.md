# Avatar Package Specification

An avatar package is a local directory containing an `avatar.manifest.json` file and the assets referenced by that manifest. The extension imports packages into the workspace-local `.codex-avatar/avatars/<id>/` registry.

## Manifest

Required fields:

- `schemaVersion`: currently `1`;
- `id`, `name`, `version`, `author`, and `license`;
- `preferredRuntime` and `fallbackRuntime`;
- `entrypoints`, `capabilities`, and `states`.

Optional fields include `triggers`, `previewImage`, `runtimePriority`, `assets`, and `checksums`. Checksums are SHA-256 hex strings keyed by package-relative asset paths.

All entrypoints, assets, preview images, and checksum keys must be local relative paths. Absolute paths, `..` segments, URL schemes, remote URLs, and symlinks escaping the package are rejected. Referenced files must exist and checksum values must match when supplied.

## Runtime behavior

The requested runtime is selected when its capability and local entrypoint are available. The declared fallback is used when it is not; the built-in SVG avatar remains the final fallback. State and trigger values are names interpreted by the selected runtime, not executable code.

## Commands

- `Codex Avatar: Import Avatar Package` copies and validates a local package.
- `Codex Avatar: Activate Avatar Package` selects an imported package or returns to the built-in avatar.
- `Codex Avatar: Remove Avatar Package` removes an imported package; removing the active package returns to the built-in avatar.

The Webview displays the package name, author, license, runtime paths, and validation status. Imported packages remain local to the workspace and are never uploaded by this feature.

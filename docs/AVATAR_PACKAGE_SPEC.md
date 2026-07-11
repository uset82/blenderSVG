# Avatar Package Specification

An avatar package is a local directory containing an `avatar.manifest.json` file and the assets referenced by that manifest. The extension imports packages into the workspace-local `.codex-avatar/avatars/<id>/` registry. The package is a data-only bundle: it does not execute JavaScript.

## Manifest

Required fields:

- `schemaVersion`: currently `1`;
- `id`, `name`, `version`, `author`, and `license`;
- `preferredRuntime` and `fallbackRuntime`;
- `entrypoints`, `capabilities`, and `states`.

Optional fields include `triggers`, `previewImage`, `runtimePriority`, `assets`, and `checksums`. Checksums are SHA-256 hex strings keyed by package-relative asset paths.

All entrypoints, assets, preview images, and checksum keys must be local relative paths. Absolute paths, `..` segments, URL schemes, remote URLs, and symlinks escaping the package are rejected. Referenced files must exist and checksum values must match when supplied.

## Minimal package

```text
my-orb/
├── avatar.manifest.json
├── svg/avatar.svg
└── pixi/avatar-spritesheet.json
```

```json
{
  "schemaVersion": 1,
  "id": "my-orb",
  "name": "My Original Orb",
  "version": "1.0.0",
  "author": "Your Name",
  "license": "CC0-1.0",
  "preferredRuntime": "pixi",
  "fallbackRuntime": "svg",
  "entrypoints": {
    "pixi": "pixi/avatar-spritesheet.json",
    "svg": "svg/avatar.svg"
  },
  "capabilities": ["state-animation", "reduced-motion"],
  "states": {
    "idle": "idle_loop",
    "thinking": "think_loop"
  },
  "previewImage": "svg/avatar.svg"
}
```

Start with an SVG entrypoint and add Pixi metadata only when the atlas is ready. The `idle` state and an SVG entrypoint are required for a useful fallback. The author is responsible for ensuring that the chosen license covers the artwork and any included fonts, sounds, models, or generated derivatives.

## Runtime behavior

The requested runtime is selected when its capability and local entrypoint are available. The declared fallback is used when it is not; the built-in SVG avatar remains the final fallback. State and trigger values are names interpreted by the selected runtime, not executable code.

## Commands

- `Codex Avatar: Import Avatar Package` copies and validates a local package.
- `Codex Avatar: Activate Avatar Package` selects an imported package or returns to the built-in avatar.
- `Codex Avatar: Remove Avatar Package` removes an imported package; removing the active package returns to the built-in avatar.

The Webview displays the package name, author, license, runtime paths, and validation status. Imported packages remain local to the workspace and are never uploaded by this feature.

## Creation and import checklist

1. Create original art or use assets whose license permits the intended distribution.
2. Add `avatar.manifest.json` and local relative entrypoints.
3. Add an SVG fallback and confirm the `idle` mapping.
4. For Pixi, create the atlas and metadata described in [SPRITESHEET_GUIDE.md](SPRITESHEET_GUIDE.md).
5. Add SHA-256 checksums for every referenced file when publishing a package.
6. Import the package with `Codex Avatar: Import Avatar Package`.
7. Activate it, reload the avatar, and test reduced motion, a state change, and a missing optional runtime.

The extension enforces 128 files maximum, 10 MiB maximum per file, 64 MiB maximum total size, and local-only paths. Deleting an imported package does not delete exports or the built-in avatar.

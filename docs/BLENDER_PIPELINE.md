# Blender Pipeline

Use Blender as an optional asset production tool for SVG line-art export, GLB export, PNG preview, and 2.5D/WebGL avatar scenes. The IDE extension must run even when Blender is not installed.

## Setup

Install Blender locally and either:

- add `blender` to your `PATH`
- set the `BLENDER_PATH` environment variable
- set VS Code setting `codexAvatar.blenderPath`

The extension tests `blender --version` before running exports. Missing Blender shows a setup message and does not affect the SVG fallback runtime.

## Scene Conventions

Prefer these collections:

```txt
Avatar
Rig
Export
Guides
Ignore
```

Use `Avatar` for visible export geometry. Use `Guides` and `Ignore` for non-export helpers. Keep file paths local and relative when possible.

For line-art/SVG work:

- use an orthographic camera
- use flat or stylized materials
- use Grease Pencil SVG export when available
- treat Blender SVG export as line art or reference, not a complete Rive/Live2D rig

For GLB/WebGL work:

- use GLB for optional Three.js/WebGL mode
- keep scene scale consistent
- pack or localize textures
- use shape keys for blink/mouth behavior when targeting a 3D avatar

## Outputs

The command writes local files to:

```txt
.codex-avatar/exports/blender/
```

Supported outputs:

- `<scene>.line-art.svg` for line art when Blender SVG support is available
- `<scene>.webgl.glb` for WebGL/Three.js assets
- `<scene>.preview.png` for PNG preview
- `<scene>.<mode>.manifest.json` for each export

SVG export depends on Blender SVG-capable workflows. If the scene has no Grease Pencil SVG export support, the script returns a readable error instead of silently writing a fake file.

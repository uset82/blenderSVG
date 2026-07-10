# Asset Pipeline

All asset processing is local. Do not upload source images, SVGs, `.blend`, `.riv`, `.glb`, or Live2D files from this pipeline.

Image tracing is for references, icons, silhouettes, and quick shape exploration. Do not use a full poster/image trace as the final animated avatar. Animated characters need clean, named layers or a rigged runtime file.

## Output

The image-to-SVG command writes to `.codex-avatar/exports/svg/`:

- `<name>.raw-trace.svg`
- `<name>.optimized.svg`
- `<name>.manifest.json`

The manifest records the source image, outputs, guidance, and validation warnings.

The optimized SVG is produced locally with a conservative optimizer that removes XML declarations, doctypes, comments, and extra tag whitespace while preserving IDs, paths, and `viewBox`. The pipeline does not require SVGO at runtime, which keeps the packaged extension self-contained.

## Layer IDs

Use SVG group IDs for animation-ready layers. IDs must be stable, lowercase, and slash-separated:

```txt
avatar/root
avatar/head
avatar/eyes/left
avatar/mouth/open
```

Avoid unnamed groups. If a group may move, blink, rotate, glow, or change opacity, name it.

## Humanoid / VTuber-Lite Layers

```txt
avatar/root
avatar/body
avatar/head
avatar/face
avatar/eyes/left
avatar/eyes/right
avatar/pupils/left
avatar/pupils/right
avatar/eyebrows/left
avatar/eyebrows/right
avatar/mouth/closed
avatar/mouth/open
avatar/hair/back
avatar/hair/front
avatar/arm/left/upper
avatar/arm/left/lower
avatar/arm/left/hand
avatar/arm/right/upper
avatar/arm/right/lower
avatar/arm/right/hand
avatar/accessories
avatar/effects
```

## Orb / Pet Assistant Layers

```txt
avatar/root
avatar/core
avatar/face
avatar/eyes/left
avatar/eyes/right
avatar/mouth/closed
avatar/mouth/open
avatar/aura
avatar/particles
avatar/antenna
avatar/accessories
avatar/shadow
```

## Validation Warnings

The validator warns when:

- required layers for the selected profile are missing
- groups do not have IDs
- SVG files are large enough to affect IDE rendering
- auto-tracing creates too many tiny paths

Warnings do not mean the file is unusable. They mean the asset is better treated as reference art until it is cleaned into stable animation layers.

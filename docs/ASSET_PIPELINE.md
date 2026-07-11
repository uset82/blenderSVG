# Asset Pipeline

All asset processing is local. Do not upload source images, SVGs, `.blend`, `.riv`, `.glb`, or Live2D files from this pipeline.

## Image-to-SVG workflow

1. Run `Codex Avatar: Vectorize Image to SVG`.
2. Select a local PNG, JPG, JPEG, or WEBP file.
3. Review the generated preview and warnings.
4. Confirm the save operation.
5. Inspect `.codex-avatar/exports/svg/` for the raw trace, optimized SVG, and manifest.

The command is a local reference-art workflow. It does not upload the input, modify the source image, or create an animated rig automatically. Use [SPRITESHEET_GUIDE.md](SPRITESHEET_GUIDE.md) for animation-ready Pixi art and [AVATAR_PACKAGE_SPEC.md](AVATAR_PACKAGE_SPEC.md) to package a finished fallback.

Image tracing is for references, icons, silhouettes, and quick shape exploration. Do not use a full poster/image trace as the final animated avatar. Animated characters need clean, named layers or a rigged runtime file.

## Output

The image-to-SVG command writes to `.codex-avatar/exports/svg/`:

- `<name>.raw-trace.svg`
- `<name>.optimized.svg`
- `<name>.manifest.json`

The manifest records the source image, outputs, guidance, and validation warnings.

The optimized SVG is produced locally with SVGO configured to preserve IDs and groups, plus a conservative pass that removes declarations, doctypes, comments, and extra tag whitespace while preserving paths and `viewBox`.

The current pipeline decodes PNG/JPG/JPEG locally with Jimp, traces with ImageTracerJS, and uses SVGO with ID and group preservation before sanitizing the result again for the Webview. The command presents the optimized SVG in a preview editor and asks for confirmation before writing output files. The source raster file is never modified. WebP paths remain validated by the input contract, but the current Node decoder reports a clear local error for WebP files that Jimp cannot decode; use PNG or JPG/JPEG for the packaged workflow.

## Preprocessing and safety

`previewImageToSvg` accepts local preprocessing options for grayscale/threshold tracing, binary foreground/background removal, noise reduction, and color quantization. ImageTracerJS produces bounded color layers; complex artwork should still be cleaned into stable named layers before animation.

Every run supports an `AbortSignal`, rejects oversized raster dimensions, and enforces SVG byte and path-count limits. Generated output is never written when preview generation or validation fails.

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

The tracer is not a full-color illustration converter or automatic character-rigging system. Background removal is binary and local, and complex multi-color artwork should be cleaned into named layers manually before animation.

---
name: svg-vector-pipeline
description: Use for local image-to-SVG conversion, conservative SVG optimization, layer naming, manifest generation, and vector asset validation.
---

# SVG Vector Pipeline Engineer

## When to use

Use this skill for `packages/asset-pipeline`, SVG layer standards, image tracing, local SVG optimization, and avatar manifest generation.

## Goals

- Convert simple images to SVG locally.
- Optimize SVG safely.
- Validate animation-ready layer names.
- Warn on giant traces.
- Keep all processing local.

## Workflow

1. Validate input type.
2. Trace or process locally.
3. Optimize SVG.
4. Validate layer groups.
5. Generate manifest entry.
6. Show friendly warnings/errors.

## Done criteria

- Local SVG output exists.
- Optimized SVG exists.
- Warnings are useful.
- No network calls.

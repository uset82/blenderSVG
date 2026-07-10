# Architecture — Codex Avatar Studio

> Phase 0 preflight audit — 2026-07-10
>
> This document records the user-owned baseline before the PixiJS-first implementation plan changes any structural source code.

## Current classification

This workspace is an existing pnpm TypeScript monorepo for a VS Code extension, not an empty repository. It already contains a compiled extension, a React/Vite Webview, shared avatar types, a local image-to-SVG pipeline, and optional-runtime prototypes.

At the start of the audit, the selected working directory (`D:\Proyectos\Blender`) was not a Git repository. The user subsequently authorized initialization. `git init -b main` created the repository, baseline commit `5bad6a2` captured the pre-migration state, and branch `backup/pre-pixi-migration-20260710` now preserves that commit before Phase 1 structural source work.

## Toolchain baseline

| Concern | Baseline |
| --- | --- |
| Package manager | pnpm 11.7.0 (`packageManager` in the root package manifest) |
| Node.js observed | v22.22.0 |
| TypeScript observed | 5.9.3 |
| TypeScript policy already enabled | `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` |
| Workspace layout | `apps/*` and `packages/*` |
| Root verification scripts | `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` |
| Current lint implementation | TypeScript no-emit checking; a formatter/linter is not yet configured |

### Baseline verification evidence

Environment: Windows workspace at `D:\Proyectos\Blender`, Node v22.22.0, pnpm 11.7.0.

| Command | Result |
| --- | --- |
| `pnpm build` | Passed. Vite emitted non-blocking warnings for WebGL-related chunks over 500 kB. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed; it currently runs TypeScript no-emit checking. |
| `pnpm test` | Passed: 36 tests, 0 failures, 0 skipped. The Vite bundle-size warnings repeated but did not fail the command. |

The bundle warnings are a performance finding to address in the later PixiJS/optional-runtime isolation work; they do not invalidate the baseline.

## Existing package topology

```text
apps/
  extension/          VS Code extension host, commands, settings, IDE events, Webview provider
  webview/            React/Vite UI and renderer selection
packages/
  avatar-core/        shared states, runtime types, event mapping, manifest validation helpers
  asset-pipeline/     local Potrace-based image-to-SVG workflow and asset helpers
scripts/
  blender/            optional SVG, GLB, and preview exporters
```

### Extension host baseline

`apps/extension` targets VS Code `^1.96.0`. It currently provides an Activity Bar view, manual state commands, workspace-local asset actions, basic IDE event listeners, settings persistence, a Content Security Policy, and local-resource handling through `webview.asWebviewUri()`.

The current Webview provider uses an executable nonce-bearing inline bootstrap script and unvalidated inbound messages. The corrected plan requires a versioned, schema-validated bridge and no executable inline bootstrap code, so this behavior is retained as baseline only and will be migrated in the appropriate later phases.

### Webview baseline

`apps/webview` uses React 19 and Vite 7. It provides an SVG renderer plus lazy-loaded Rive, Live2D, and Three/WebGL renderer placeholders. It already has theme variables, reduced-motion detection, visibility detection, an error boundary, and a typed-at-compile-time bridge.

The active MVP renderer in the corrected plan is not present: there is no PixiJS dependency, `runtime-pixi` package, spritesheet format, or PixiJS lifecycle implementation.

### Shared core and asset baseline

`packages/avatar-core` defines the required state names and an earlier set of triggers, basic event mappings, runtime fallback selection, manifest validation helpers, reduced-motion helpers, and GPU feature checks. It does **not** yet contain the required deterministic state machine, capabilities model, Zod schemas, protocol versioning, or secure avatar-package validation.

`packages/asset-pipeline` performs local tracing and includes path/metadata tests. It does not yet provide the full sanitization, cancellation, preview, complexity-limiting, or package-validation contract required by the corrected plan.

### Optional-runtime baseline

Rive, Live2D, Three/WebGL/WebGPU, and Blender-related code predates the new plan. It is user-owned baseline code and must be preserved. It is not evidence that optional phases are complete, and it must not be expanded or included in the PixiJS-first MVP bundle.

## Corrected MVP architecture

The authoritative checklist is `docs/PLAN_CHECKLIST.md`. The required non-voice MVP route is:

```text
Phase 0–12: preflight → tooling → core/protocol → state machine → extension → webview
             → SVG fallback → PixiJS → spritesheet behavior → IDE events
             → avatar packages → local vectorization → settings/accessibility
Phase 18–22: security/privacy → performance → testing → CI/release → documentation
```

Phases 13–17 remain unchecked and deferred unless their optional scope is explicitly approved. SVG remains the permanent fallback; PixiJS v8 becomes the only rich runtime required for the MVP.

## Phase 0 decision lock

| Decision | Recorded choice | Status |
| --- | --- | --- |
| Primary IDE target | VS Code `^1.96.0` | Locked from existing extension manifest |
| Compatible IDE support | Best-effort only where the public VS Code Webview API is compatible; formal compatibility testing belongs to Phase 20 | Locked |
| Node policy | Node 22 LTS only (`>=22 <23`) | Locked; enforce in Phase 1 |
| pnpm policy | pnpm 11.7.0, locked by the root `packageManager` field | Locked |
| Formatter/linter | Biome, replacing the current typecheck-as-lint placeholder | Locked; configure in Phase 1 |
| Unit-test framework | Vitest | Locked; configure in Phase 1 |
| Extension integration tests | `@vscode/test-electron` | Locked; configure in Phase 1 |
| AITuber OnAir | Reference-only for the MVP; no source code or assets may be copied/adapted | Locked |
| Raster vectorization dependency | ImageTracerJS 1.2.6 (Unlicense) for the new pipeline; the existing Potrace 2.1.8 dependency is GPL-2.0 and must be removed from the distributable base before release | Locked; migration belongs to Phase 11 after earlier required phases |

## Preservation and migration rules

- No existing source file is to be deleted merely to fit the new design.
- Existing Rive, Live2D, WebGL/WebGPU, and Blender code remains isolated from the base MVP. It can be adapted only in a later optional phase after its license and loading model are verified.
- Prior checkboxes in `docs/PLAN_CHECKLIST_LEGACY.md` are historical notes, not evidence for this checklist.
- The old checklist has been preserved before `docs/PLAN_CHECKLIST.md` was replaced by the corrected authoritative plan.

## Phase 0 gate status

1. Git safety gate resolved: repository `main` and backup branch `backup/pre-pixi-migration-20260710` both descend from the captured baseline.
2. The existing Potrace 2.1.8 GPL-2.0 dependency remains a recorded migration risk. It may remain untouched in the preserved baseline, but it must not be expanded or shipped in the eventual base VSIX; the corrected pipeline will use the permissively licensed ImageTracerJS alternative.

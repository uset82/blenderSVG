# Codex Avatar Studio — Detailed Sequential Implementation Plan

## 0. Mission

Build a local-first animated AI companion for a VS Code-compatible IDE. The assistant must live inside an IDE Webview and react to development activity through a typed avatar state machine.

The first production runtime will use **PixiJS** for 2D WebGL rendering, with a static SVG fallback. The architecture must support optional adapters for **Inochi2D**, **Live2D**, and **VRM/Three.js** without making any of them mandatory for the MVP.

The project must not copy the appearance, personality, artwork, voices, models, or proprietary assets of Grok Ani, Rudi, or any other commercial companion. The goal is to create an original coding companion with comparable presence, responsiveness, and animation quality.

---

# 1. Mandatory Codex Working Rules

Codex must follow these rules before editing any source code.

- [ ] Copy this entire plan into `docs/PLAN_CHECKLIST.md`.
- [ ] Read the complete plan before implementing Phase 0.
- [ ] Work strictly in numerical phase order on the required MVP path, subject only to the explicit post-MVP deferral rule below.
- [ ] Do not jump to a later phase while the current phase has incomplete acceptance criteria.
- [ ] Mark a task `[x]` only after the implementation and its verification command both succeed.
- [ ] Never mark an acceptance criterion complete based only on code inspection.
- [ ] Add a short evidence note under each completed acceptance section, including the command or test used.
- [ ] If blocked, leave the task unchecked and add `BLOCKED:` with the exact reason.
- [ ] Do not delete or replace existing user code unless required and documented.
- [ ] Prefer small, reviewable commits organized by phase.
- [ ] Do not introduce remote API calls in the animation runtime.
- [ ] Keep avatar assets and processing local by default.
- [ ] Do not add third-party artwork, models, voices, or textures without a verified redistribution license.
- [ ] Do not make WebGPU, Live2D, Inochi2D, Blender, or VRM mandatory for the base extension.
- [ ] Preserve a functional SVG fallback at every stage.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Pause or throttle animation when the Webview is hidden.
- [ ] Run formatting, type-checking, tests, and builds before closing each phase.
- [ ] Update this checklist immediately after completing each verified task.
- [ ] Finish one phase completely before continuing to the next phase.

## Required progress format

At the end of every implementation session, Codex must report:

```text
Completed phase:
Completed tasks:
Verification commands:
Files changed:
Open blockers:
Next unchecked task:
```

## 1.1 Implementation Clarifications

These clarifications are part of this plan and take precedence over an older checklist or prior implementation claims.

### Authoritative checklist and existing-code migration

- This plan is the authoritative checklist for the PixiJS-first MVP. Before it replaces an older `docs/PLAN_CHECKLIST.md`, preserve the older checklist as `docs/PLAN_CHECKLIST_LEGACY.md`.
- Audit and preserve existing user code. Existing Rive, WebGL, Live2D, Blender, SVG, and asset-pipeline work may be retained as reference or future optional work, but does not satisfy a task in this plan until it is migrated where needed and verified against this plan's acceptance criteria.
- Do not expand an optional runtime before the SVG and PixiJS MVP is complete. Keep retained optional-runtime code outside the MVP bundle.

### MVP delivery route and optional phases

- The required non-voice MVP route is Phase 0 through Phase 12, followed by Phase 18 through Phase 22.
- Phase 13 is optional unless voice functionality is introduced. Phases 14 through 17 are post-MVP optional adapters and tools.
- A deferred optional phase must remain unchecked and be listed as `DEFERRED:` in the final session report with its reason. Deferral is not completion and does not permit the deferred code to enter the base extension bundle.
- "Strict numerical phase order" means numerical order within the selected required route: complete Phases 0–12 before Phase 18, then complete Phases 18–22 in order. Do not begin a later required phase while an earlier required phase has incomplete acceptance criteria.

### Git prerequisite

- A backup branch is required before structural source changes. If the selected workspace is not a Git repository, leave that task and its acceptance criterion unchecked and record `BLOCKED: No Git repository is available at the selected workspace root.`
- Documentation-only auditing may continue while that prerequisite is blocked. Do not run `git init`, create commits, or create a branch without explicit user authorization or a confirmed repository root.

### Phase 0 decision lock

- Before closing Phase 0, `docs/ARCHITECTURE.md` must record the supported IDE/version floor, Node and pnpm policy, formatter/linter choice, unit and extension-integration test choices, vectorization dependency choice, and whether AITuber OnAir is reference-only or contains specifically attributed adapted code.

### Verification evidence standard

- Each completed task must cite the exact command or a reproducible manual-test procedure, the observed result, the environment where it ran, and the affected files.
- Manual acceptance checks must state their setup, steps, and observed result. Code inspection alone is not evidence.

### Webview bootstrap rule

- "Prevent inline scripts" means prevent executable inline scripts, including bootstrap code. The extension must send initialization data through the versioned typed bridge after `webview:ready`; a CSP nonce must not be used to exempt executable bootstrap code.

---

# 2. Product Scope

## 2.1 MVP

The MVP must provide:

- A VS Code-compatible extension.
- A React and Vite Webview.
- A dockable animated assistant panel.
- A static SVG fallback avatar.
- A PixiJS animated spritesheet avatar.
- Typed IDE-to-avatar events.
- Typed avatar states and triggers.
- Manual commands for testing all avatar states.
- Basic IDE event reactions.
- Local avatar packages and manifests.
- User settings and workspace persistence.
- Reduced-motion and low-performance modes.
- Automated unit and integration tests.
- No required cloud services.

## 2.2 Optional post-MVP runtimes

These must be isolated behind lazy-loaded adapters:

- Inochi2D puppet runtime.
- Live2D compatibility runtime.
- Three.js and VRM 3D runtime.
- WebGPU enhancements.
- Blender export automation.
- Audio-driven lip synchronization.
- Voice and viseme integration.

## 2.3 Explicit non-goals for the MVP

- Full autonomous emotional relationship simulation.
- Adult companion mechanics.
- Hidden psychological engagement loops.
- Remote avatar asset marketplace.
- Automatic professional Live2D rig generation.
- Direct access to private Codex extension internals.
- Mandatory Blender installation.
- Mandatory GPU acceleration.
- Copying another product’s character design.

---

# 3. Architecture

```text
VS Code / Compatible IDE
│
├── Extension Host
│   ├── Commands
│   ├── Public IDE event listeners
│   ├── Settings
│   ├── Workspace persistence
│   ├── Asset validation
│   └── Webview message bridge
│
├── React/Vite Webview
│   ├── Avatar stage
│   ├── Assistant message bubble
│   ├── Settings panel
│   ├── Runtime debug panel
│   └── Accessibility controls
│
├── Avatar Core
│   ├── State machine
│   ├── Event mapping
│   ├── Runtime interface
│   ├── Manifest schema
│   ├── Capability negotiation
│   └── Reduced-motion policy
│
├── Runtime Adapters
│   ├── SVG fallback
│   ├── PixiJS spritesheet
│   ├── Inochi2D optional
│   ├── Live2D optional
│   └── VRM/Three.js optional
│
└── Asset Pipelines
    ├── Image to SVG
    ├── SVG optimization
    ├── Spritesheet validation
    ├── Blender to GLB
    ├── Blender to SVG line art
    └── Avatar package validation
```

---

# 4. Approved Technical Stack

## Base stack

- TypeScript with strict mode.
- pnpm workspaces.
- VS Code Extension API.
- React.
- Vite.
- PixiJS v8.
- Zod for runtime schema validation.
- Vitest for unit tests.
- Playwright or `@vscode/test-electron` for extension integration tests.
- ESLint or Biome.
- Prettier if Biome is not used.

## Optional stack

- Motion for React interface transitions only.
- Three.js and `@pixiv/three-vrm` for 3D.
- Inochi2D runtime for open puppet support.
- Live2D Cubism Web adapter only after licensing review.
- Sharp, Potrace, or ImageTracerJS for image-to-SVG.
- SVGO for SVG optimization.
- Python and Blender Python API for export scripts.

## Upstream references

Use these as references, not as sources of unverified character assets:

```text
AITuber OnAir:
https://github.com/shinshin86/aituber-onair

PixiJS:
https://github.com/pixijs/pixijs

PixiJS skills for coding agents:
https://github.com/pixijs/pixijs-skills

Inochi2D:
https://github.com/Inochi2D/inochi2d

Inochi Creator:
https://github.com/Inochi2D/inochi-creator

Project AIRI:
https://github.com/moeru-ai/airi

TalkingHead:
https://github.com/met4citizen/TalkingHead

Three VRM:
https://github.com/pixiv/three-vrm
```

---

# 5. Required Repository Structure

```text
codex-avatar-studio/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── README.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── docs/
│   ├── PLAN_CHECKLIST.md
│   ├── ARCHITECTURE.md
│   ├── EVENT_PROTOCOL.md
│   ├── AVATAR_PACKAGE_SPEC.md
│   ├── ASSET_PIPELINE.md
│   ├── PERFORMANCE.md
│   ├── PRIVACY_AND_SAFETY.md
│   ├── LICENSING.md
│   └── TROUBLESHOOTING.md
├── apps/
│   ├── extension/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── AvatarWebviewProvider.ts
│   │   │   ├── commands.ts
│   │   │   ├── ideEvents.ts
│   │   │   ├── settings.ts
│   │   │   ├── workspaceStorage.ts
│   │   │   ├── assetRegistry.ts
│   │   │   ├── security.ts
│   │   │   └── messages.ts
│   │   ├── media/
│   │   │   ├── webview/
│   │   │   └── avatars/
│   │   │       └── builtin/
│   │   └── test/
│   └── webview/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles/
│           ├── bridge/
│           ├── components/
│           ├── hooks/
│           ├── state/
│           └── renderers/
├── packages/
│   ├── avatar-core/
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── states.ts
│   │   │   ├── events.ts
│   │   │   ├── stateMachine.ts
│   │   │   ├── runtime.ts
│   │   │   ├── manifest.ts
│   │   │   ├── capabilities.ts
│   │   │   ├── reducedMotion.ts
│   │   │   └── gpuSupport.ts
│   │   └── test/
│   ├── asset-pipeline/
│   │   ├── src/
│   │   │   ├── imageToSvg.ts
│   │   │   ├── optimizeSvg.ts
│   │   │   ├── validateSvg.ts
│   │   │   ├── validateSpritesheet.ts
│   │   │   ├── validateManifest.ts
│   │   │   └── cli.ts
│   │   └── test/
│   └── runtime-pixi/
│       ├── src/
│       │   ├── PixiAvatarRuntime.ts
│       │   ├── PixiStage.ts
│       │   ├── SpriteAnimator.ts
│       │   ├── EffectLayer.ts
│       │   └── textureCache.ts
│       └── test/
├── optional/
│   ├── runtime-inochi2d/
│   ├── runtime-live2d/
│   ├── runtime-vrm/
│   └── blender-tools/
└── scripts/
    ├── copy-webview-build.mjs
    ├── validate-assets.mjs
    ├── package-extension.mjs
    └── blender/
        ├── export_svg.py
        ├── export_glb.py
        └── render_preview.py
```

---

# Phase 0 — Preflight, Repository Audit, and License Gate

## Tasks

- [x] Detect whether the repository is empty, an existing extension, a web application, or a monorepo.
- [x] Record the existing architecture in `docs/ARCHITECTURE.md`.
- [x] Record the current package manager, Node version, TypeScript version, and build commands.
- [x] Preserve the previous `docs/PLAN_CHECKLIST.md` as `docs/PLAN_CHECKLIST_LEGACY.md` before replacing it with this plan.
- [x] Create a backup branch before structural source changes. If no Git repository is available, leave this unchecked and record the exact blocker.
- [x] Create `docs/PLAN_CHECKLIST.md`.
- [x] Create `THIRD_PARTY_NOTICES.md`.
- [x] Create `docs/LICENSING.md`.
- [x] Verify the license of every planned code dependency.
- [x] Verify that no upstream character assets will be copied.
- [x] Record upstream repository URLs, license names, and exact commit SHAs.
- [x] Decide whether AITuber OnAir will be used only as a reference or whether specific MIT-licensed modules will be adapted.
- [x] If code is adapted, document each source file and attribution. (Not applicable: AITuber OnAir is reference-only and no upstream source was adapted.)
- [x] Record the Phase 0 decision lock values in `docs/ARCHITECTURE.md`.
- [x] Add an explicit rule that artwork and model licenses are reviewed separately from code licenses.
- [x] Add `.gitignore` entries for generated previews, caches, Blender exports, and local avatar packages.
- [x] Confirm that the current codebase still builds before modifications.

Git prerequisite resolved: the user authorized repository initialization. `git init -b main` created the repository, commit `5bad6a2` captured the pre-migration baseline, and branch `backup/pre-pixi-migration-20260710` preserves it before Phase 1 structural work.

## Acceptance criteria

- [x] Baseline build succeeds.
- [x] Baseline tests succeed or existing failures are documented.
- [x] License records exist.
- [x] No unlicensed avatar assets have been added.
- [x] Backup branch exists.
- [x] Existing user code has not been deleted.

### Phase 0 evidence — 2026-07-10

- Environment: Windows workspace `D:\Proyectos\Blender`; Node `v22.22.0`; pnpm `11.7.0`; TypeScript `5.9.3`.
- Architecture/tooling audit: `node --version`, `pnpm --version`, `pnpm exec tsc --version`, `pnpm list -r --depth 0 --json`, and source/package inspection. Result recorded in `docs/ARCHITECTURE.md`.
- Baseline build: `pnpm build` passed. Vite reported non-blocking WebGL chunk warnings (`three.webgpu.js` and `WebGLAvatarRenderer.js` over 500 kB); no build failure.
- Baseline static checks: `pnpm typecheck` and `pnpm lint` passed. The audit records that lint is currently a TypeScript no-emit alias rather than a real linter.
- Baseline tests: `pnpm test` passed all 36 tests with 0 failures, skips, cancellations, or todos.
- Final Phase 0 gate: `pnpm ci` completed a clean frozen-lockfile install, then `pnpm run ci` passed build, typecheck, lint, and all 36 tests. The known optional WebGL chunk-size warnings remained non-blocking and are recorded for later isolation/performance work.
- Checklist copy: line-by-line `Compare-Object` verification returned `PLAN_CHECKLIST_CONTENT_MATCHES` immediately after the authoritative plan was copied; this live checklist then began recording progress.
- Preservation/document check: the PowerShell required-path and `.gitignore` assertion returned `PHASE_0_DOCUMENT_AND_PRESERVATION_CHECK_PASSED`. The older checklist remains at `docs/PLAN_CHECKLIST_LEGACY.md`.
- License verification: installed manifest metadata, registry metadata, GitHub repository metadata, and `git ls-remote <repository> HEAD` were recorded in `docs/LICENSING.md` and `THIRD_PARTY_NOTICES.md`. AITuber OnAir is reference-only. Existing `potrace@2.1.8` is GPL-2.0 and is explicitly scheduled for replacement rather than expansion/distribution.
- Asset audit: no new avatar art was added. The active source inventory contains only the existing simple orb SVG/icon; their SHA-256 values and pending final clean-room attestation are recorded in `docs/LICENSING.md`. No upstream character asset, `.riv`, `.glb`, `.vrm`, Live2D model, spritesheet, texture set, or voice asset was added.
- Git safety gate: with user authorization, `git init -b main` succeeded, `git commit -m "chore: capture pre-migration baseline"` created commit `5bad6a2`, and `git branch backup/pre-pixi-migration-20260710` created the required immutable pre-Phase-1 reference.

---

# Phase 1 — Workspace and Tooling Foundation

## Tasks

- [x] Initialize or normalize a pnpm workspace.
- [x] Create the required app and package directories.
- [x] Enable TypeScript strict mode.
- [x] Configure path aliases.
- [x] Configure a single formatter.
- [x] Configure linting.
- [x] Configure Vitest.
- [x] Add root scripts for `dev`, `build`, `typecheck`, `lint`, `test`, and `package`.
- [x] Add a Node engine constraint.
- [x] Add lockfile policy.
- [x] Add workspace dependency boundaries.
- [x] Prevent optional runtimes from entering the base bundle.
- [x] Add a script that copies the Webview build into the extension media folder.
- [x] Add a clean script that does not delete user-created avatar assets.

## Required root scripts

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "package": "node scripts/package-extension.mjs"
  }
}
```

## Acceptance criteria

- [x] `pnpm install` succeeds.
- [x] `pnpm typecheck` succeeds.
- [x] `pnpm lint` succeeds.
- [x] `pnpm test` succeeds.
- [x] `pnpm build` succeeds.
- [x] Optional runtime packages are not included in the MVP bundle.

### Phase 1 evidence — 2026-07-10

- Workspace/toolchain: `package.json` now pins the Node 22/pnpm 11.7.0 policy, defines the required root scripts, and adds Biome 2.5.3 plus Vitest 4.1.10. `.npmrc` records strict engines, exact dependency saves, and one shared workspace lockfile.
- Structure/boundaries: `packages/runtime-pixi` is a TypeScript-only Phase 1 boundary with no PixiJS dependency yet. `optional/*` contains documentation-only deferred adapter directories and is excluded from the pnpm workspace. Existing optional renderer source remains preserved but excluded from the active Webview TypeScript/build graph.
- TypeScript and aliases: strict mode remains enabled in `tsconfig.base.json`; the Webview has a tested `@/*` source alias in both TypeScript and Vite. Clean-checkout typechecking was verified with `pnpm clean` followed by `pnpm typecheck`.
- Formatting/linting: `pnpm format` mechanically applied Biome to the configured source set; `pnpm format:check` and `pnpm lint` pass.
- Tests: `pnpm test` passes 37 tests: 25 Vitest unit tests (core, asset pipeline, and Pixi package scaffold) plus 12 existing extension/Webview smoke tests.
- Build/copy: `pnpm build` writes the Webview to `apps/webview/dist` and `scripts/copy-webview-build.mjs` safely replaces only `apps/extension/media/webview`. The SVG MVP build contains `index.js` (212.76 kB), `index.css`, `index.html`, and a Vite manifest; it contains no Rive, Live2D, Three, WebGL, WebGPU, or GLTF chunks. The Webview smoke test asserts this boundary.
- Clean safety: `pnpm clean` removed only generated directories and returned `CLEAN_PRESERVED_AVATAR_ASSETS` after matching the placeholder avatar SHA-256 before and after cleanup.
- Final quality gate: from a clean workspace, `pnpm run ci` passed formatting, linting, typechecking, all tests, and build. `pnpm run package` also produced `dist/codex-avatar-studio-0.1.0.vsix` with the Webview restricted to the SVG MVP files and `THIRD_PARTY_NOTICES.md` included.

---

# Phase 2 — Avatar Core Types and Protocol

## Tasks

- [x] Create/migrate the `avatar-core` package.
- [x] Define `AvatarRuntimeKind`.
- [x] Define `AvatarState`.
- [x] Define `AvatarTrigger`.
- [x] Define `IdeAssistantEvent`.
- [x] Define `AvatarCapability`.
- [x] Define `AvatarManifest`.
- [x] Define `AvatarRuntimeAdapter`.
- [x] Define typed extension-to-Webview messages.
- [x] Define typed Webview-to-extension messages.
- [x] Add Zod schemas for every message received at runtime.
- [x] Reject unknown message types safely.
- [x] Add protocol versioning.
- [x] Add unit tests for valid and invalid messages.
- [x] Document the protocol in `docs/EVENT_PROTOCOL.md`.

## Required states

```typescript
export type AvatarState =
  | "idle"
  | "welcome"
  | "listening"
  | "thinking"
  | "speaking"
  | "coding"
  | "reviewing"
  | "debugging"
  | "building"
  | "success"
  | "warning"
  | "error"
  | "sleeping";
```

## Required triggers

```typescript
export type AvatarTrigger =
  | "blink"
  | "look-left"
  | "look-right"
  | "nod"
  | "shake"
  | "celebrate"
  | "point"
  | "start-speaking"
  | "stop-speaking"
  | "show-particles"
  | "clear-effects";
```

## Runtime adapter contract

```typescript
export interface AvatarRuntimeAdapter {
  readonly kind: AvatarRuntimeKind;
  readonly capabilities: ReadonlySet<AvatarCapability>;

  initialize(container: HTMLElement, manifest: AvatarManifest): Promise<void>;
  setState(state: AvatarState): Promise<void> | void;
  trigger(trigger: AvatarTrigger): Promise<void> | void;
  setSpeechLevel(level: number): void;
  setVisible(visible: boolean): void;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): Promise<void> | void;
}
```

## Acceptance criteria

- [x] Every message type is serializable.
- [x] Invalid messages are rejected without crashing.
- [x] State and trigger types are shared by the extension and Webview.
- [x] Protocol tests cover all message variants.
- [x] No browser API is called during Node-only unit tests.

### Phase 2 evidence — 2026-07-10

- `packages/avatar-core` now owns versioned runtime kinds, states, triggers, capabilities, manifests, adapters, and the extension/Webview protocol. Compatibility aliases preserve the legacy manifest shape while migration is in progress.
- Zod parsers validate every inbound message and reject unknown types, unsupported protocol versions, malformed payloads, and non-serializable values without throwing across the bridge.
- `docs/EVENT_PROTOCOL.md` documents the message tables, state/trigger vocabulary, parser behavior, and constructor examples.
- Verification: `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (40 tests), and `pnpm build` all pass. Protocol coverage includes all outbound/inbound variants, serialization, invalid-version/type rejection, and malformed pose input.

---

# Phase 3 — Avatar State Machine

## Tasks

- [x] Implement a deterministic avatar state machine.
- [x] Define allowed state transitions.
- [x] Define state priorities.
- [x] Add temporary state durations.
- [x] Add automatic return to idle/previous state.
- [x] Prevent low-priority events from interrupting critical states.
- [x] Allow explicit manual overrides for debugging.
- [x] Add a reduced-motion policy.
- [x] Add a low-performance policy.
- [x] Add unit tests for transitions and interruption rules.
- [x] Add a development-only transition log.

## Required priority example

```text
error > warning > speaking > debugging > building > thinking > coding > idle
```

## Required transition behavior

- `success` returns to `idle` after a configurable duration.
- `error` remains visible longer than `success`.
- `speaking` may interrupt `thinking`.
- `building` must not be interrupted by a simple editor-focus event.
- `sleeping` exits when the user interacts with the IDE.
- repeated diagnostics must be debounced.

## Acceptance criteria

- [x] All states are reachable through typed states/events or explicit manual overrides.
- [x] Invalid transitions do not crash.
- [x] Temporary states return to the correct previous or idle state.
- [x] Priority tests pass.
- [x] Debounce tests pass.
- [x] Reduced-motion mode does not change state semantics.

### Phase 3 evidence — 2026-07-10

- `packages/avatar-core/src/stateMachine.ts` provides deterministic transitions, priority protection, configurable expirations, timeout return, manual/debug overrides, reduced-motion and low-performance policies, sleeping wake-up, and diagnostic debouncing.
- Transition logging is injected through a development-only callback and remains absent unless configured.
- Verification: avatar-core tests pass 17 tests; full typecheck and lint pass. Tests cover priority interruption, building protection, temporary-state return, sleeping wake-up, diagnostic debounce, and reduced-motion expiry behavior.

---

# Phase 4 — VS Code Extension Shell

## Tasks

- [x] Create `apps/extension`.
- [x] Register the extension activation event.
- [x] Create `AvatarWebviewProvider`.
- [x] Register an Activity Bar container.
- [x] Register the assistant Webview view.
- [x] Register `Codex Avatar: Open Assistant`.
- [x] Register `Codex Avatar: Toggle Assistant`.
- [x] Register `Codex Avatar: Reset Assistant`.
- [x] Register `Codex Avatar: Open Settings`.
- [x] Register `Codex Avatar: Show Debug Panel`.
- [x] Register manual commands for every avatar state.
- [x] Register manual commands for important avatar triggers.
- [x] Generate a strict Content Security Policy.
- [x] Use `webview.asWebviewUri()` for all local resources.
- [x] Generate a per-session nonce.
- [x] Prevent executable inline scripts; deliver initialization through the versioned typed bridge after `webview:ready`.
- [x] Restrict network access.
- [x] Add extension disposal cleanup through context/provider lifecycle disposal.
- [x] Add error handling and user-friendly notifications.

## Acceptance criteria

- [x] Extension compiles.
- [x] Extension launches in Extension Development Host.
- [x] Assistant view opens from the Activity Bar.
- [x] Assistant view opens from the Command Palette.
- [x] No CSP errors appear.
- [x] Reloading the Webview does not duplicate event listeners.
- [x] Closing the extension disposes resources.

### Phase 4 evidence — 2026-07-10

- The extension manifest now contributes the Activity Bar view, settings/debug actions, all state preview commands, and important trigger commands with matching activation events.
- Webview HTML uses local `asWebviewUri()` resources, a per-session nonce, no executable inline bootstrap, and a restrictive `default-src 'none'` CSP. Initialization now arrives through the versioned `webview:ready` bridge.
- Verification: extension smoke tests pass 9/9, including manifest activation coverage and compiled CSP checks; formatting and typecheck pass.

---

# Phase 5 — React/Vite Webview

## Tasks

- [x] Create the React and Vite Webview app.
- [x] Create the VS Code API bridge.
- [x] Ensure `acquireVsCodeApi()` is called exactly once.
- [x] Create `App`.
- [x] Create `AvatarPanel`.
- [x] Create `AvatarStage`.
- [x] Create `AssistantBubble`.
- [x] Create `SettingsPanel`.
- [x] Create `StatusDebugPanel`.
- [x] Add an error boundary around avatar runtimes.
- [x] Use VS Code theme variables.
- [x] Support light, dark, and high-contrast themes.
- [x] Add keyboard navigation.
- [x] Add accessible labels.
- [x] Add reduced-motion detection.
- [x] Add visibility detection.
- [x] Send `webview:ready` after initialization.
- [x] Display a friendly fallback when a runtime fails.

## Acceptance criteria

- [x] Webview renders in all VS Code themes.
- [x] Keyboard users can open settings and change runtime.
- [x] The Webview survives extension reload.
- [x] Runtime exceptions are contained by the error boundary.
- [x] `webview:ready` is sent once.
- [x] No remote resources are loaded.

### Phase 5 evidence — 2026-07-10

- The React/Vite Webview has a typed bridge, single API acquisition, stage/bubble/settings/debug components, theme-variable styling, keyboard-accessible controls, reduced-motion and visibility hooks, and a runtime error boundary with a friendly fallback.
- Verification: Webview typecheck passes; Webview smoke tests pass 3/3, including SVG-only output, bridge actions, and no remote API usage.

---

# Phase 6 — Static SVG Fallback Runtime

## Tasks

- [x] Create an original built-in SVG mascot.
- [x] Ensure the SVG contains no untrusted scripts.
- [x] Sanitize imported SVG files.
- [x] Create `SvgAvatarRenderer`.
- [x] Add state-specific CSS classes.
- [x] Add idle breathing.
- [x] Add blinking.
- [x] Add thinking pulse.
- [x] Add coding movement.
- [x] Add speaking mouth pulse.
- [x] Add success glow.
- [x] Add warning pulse.
- [x] Add error shake.
- [x] Disable continuous effects in reduced-motion mode.
- [x] Add runtime fallback selection.

## Acceptance criteria

- [x] The extension works with only the built-in SVG avatar.
- [x] Every required state produces a visible change.
- [x] Reduced-motion mode disables looping animation.
- [x] SVG sanitization tests pass.
- [x] Missing optional assets do not crash the extension.

### Phase 6 evidence — 2026-07-10

- The original inline SVG mascot renders every required state with CSS-driven breathing, blink, thinking/building pulse, coding/speaking motion, success/warning/error feedback, and reduced-motion/visibility pause behavior.
- `sanitizeSvg` now strips scripts, foreign objects, event-handler attributes, external hrefs, and remote/data paint URLs before optimization.
- Verification: asset-pipeline typecheck and tests pass 15/15; Webview SVG-only smoke tests remain green.

---

# Phase 7 — PixiJS Runtime Foundation

## Tasks

- [x] Add PixiJS v8 to `runtime-pixi`.
- [ ] Add or reference the official PixiJS skills for coding agents.
- [x] Create `PixiAvatarRuntime`.
- [x] Create a single PixiJS `Application` per avatar stage.
- [x] Initialize WebGL safely.
- [x] Detect WebGPU without requiring it.
- [x] Add automatic renderer fallback.
- [x] Create a resize observer.
- [x] Cap device pixel ratio.
- [ ] Create a texture cache.
- [x] Destroy textures and application resources on disposal.
- [x] Pause ticker when hidden.
- [x] Resume ticker when visible.
- [x] Add a configurable frame-rate cap.
- [x] Add a debug information surface showing renderer, dimensions, and active state.
- [x] Add unit tests for the adapter contract.

### Phase 7 progress evidence — 2026-07-10

- `packages/runtime-pixi` now depends on PixiJS 8.14 and exports an isolated `PixiAvatarRuntime` implementing the shared adapter contract. It creates one WebGL-preferred application per initialized stage, caps resolution at 2×, maps core states, handles trigger effects, and destroys application resources/canvases cleanly.
- The adapter remains optional and is not imported by the SVG MVP Webview bundle. It now exposes non-required WebGPU detection, WebGL preference, resize observation, visibility-driven ticker pause/resume, 30/60 FPS caps, and a debug information surface.
- Verification: runtime-pixi typecheck, lint, formatting, and Vitest contract test pass.

## Performance rules

- Default target: 30 FPS inside the IDE.
- Optional high-quality target: 60 FPS.
- Hidden Webview target: paused.
- Reduced-motion target: static or event-only animation.
- Maximum default device pixel ratio: 2.

## Acceptance criteria

- [ ] PixiJS initializes without console errors.
- [ ] Runtime disposes cleanly.
- [ ] Reopening the panel does not create duplicate canvases.
- [ ] Hidden panel stops rendering.
- [ ] Renderer fallback works.
- [ ] SVG fallback loads if PixiJS initialization fails.

---

# Phase 8 — Spritesheet Avatar and Codex Pet Behavior

## Tasks

- [ ] Study the AITuber OnAir Pet example.
- [ ] Identify the smallest reusable behavior concepts.
- [x] Do not copy unverified artwork.
- [ ] Create an original placeholder spritesheet.
- [x] Define a spritesheet metadata format.
- [x] Implement spritesheet loading contract.
- [x] Implement named animation clips.
- [x] Map avatar states to animation clips.
- [x] Map triggers to one-shot clips.
- [x] Add clip priorities.
- [x] Add clean clip transitions.
- [x] Add animation completion callbacks.
- [x] Add random idle variation.
- [ ] Add cursor or editor-direction gaze approximation.
- [ ] Add particle layers for success and error.
- [ ] Add a holographic thinking effect.
- [x] Add a low-performance mode without particles.
- [x] Add tests for missing clips and malformed metadata.

### Phase 8 progress evidence — 2026-07-10

- `packages/runtime-pixi/src/spritesheet.ts` defines an original metadata contract, validates frame data, maps every required state and trigger to named clips, and falls back to `idle_loop` when a state clip is missing.
- No upstream character artwork or copied assets were added. Particle layers, gaze, and richer visual effects remain pending on the actual Pixi stage integration.
- `SpriteAnimationController` applies clip priorities, restores the active state after one-shot completion, supports deterministic idle variation, exposes completion callbacks, and suppresses particle clips in low-performance mode.
- Verification: runtime-pixi typecheck, lint, formatting, and 5 Vitest tests pass.

## Required state mapping

```text
idle       -> idle_loop
welcome    -> greet_once
listening  -> listen_loop
thinking   -> think_loop
speaking   -> talk_loop
coding     -> type_loop
reviewing  -> inspect_loop
debugging  -> debug_loop
building   -> scan_loop
success    -> celebrate_once
warning    -> concerned_loop
error      -> error_once
sleeping   -> sleep_loop
```

## Acceptance criteria

- [ ] All required states have a clip or fallback.
- [ ] Missing clips fall back to idle.
- [ ] One-shot clips return to the expected state.
- [ ] Spritesheet validation catches malformed data.
- [ ] No upstream character artwork is present.
- [ ] Animation remains responsive at the configured frame rate.

---

# Phase 9 — IDE Event Bridge

## Tasks

- [ ] Listen to active editor changes.
- [ ] Listen to text document changes with throttling.
- [ ] Listen to document save events.
- [ ] Listen to diagnostics changes.
- [ ] Listen to debug session start.
- [ ] Listen to debug session termination.
- [ ] Listen to task start.
- [ ] Listen to task end.
- [ ] Listen to terminal creation and closure where useful.
- [ ] Listen to workspace trust changes.
- [ ] Map public IDE events to `IdeAssistantEvent`.
- [ ] Map assistant events to avatar states.
- [ ] Add debounce and cooldown rules.
- [ ] Add an idle timer.
- [ ] Add a sleep timer.
- [ ] Add manual state commands for events that cannot be detected reliably.
- [ ] Do not assume access to private Codex internal state.
- [ ] Add optional command hooks that other extensions can invoke.
- [ ] Document integration limits.

## Example event mapping

```text
Editor becomes active        -> welcome or idle
User types                   -> coding
Document saved               -> reviewing
Task starts                  -> building
Task succeeds                -> success
Task fails                   -> error
Debug starts                 -> debugging
Error diagnostic appears     -> warning or error
No interaction for N minutes -> sleeping
Manual "Codex Thinking"      -> thinking
Manual "Codex Speaking"      -> speaking
```

## Acceptance criteria

- [ ] Public IDE events produce the expected avatar states.
- [ ] Rapid typing does not flood the Webview.
- [ ] Repeated diagnostics are debounced.
- [ ] Tasks map exit results correctly.
- [ ] Event listeners are disposed.
- [ ] Unsupported IDE events fail gracefully.

---

# Phase 10 — Avatar Package and Manifest System

## Tasks

- [ ] Define `avatar.manifest.json`.
- [ ] Add manifest versioning.
- [ ] Add runtime preference.
- [ ] Add runtime fallback.
- [ ] Add capability declarations.
- [ ] Add state-to-animation mappings.
- [ ] Add trigger mappings.
- [ ] Add preview image path.
- [ ] Add license metadata.
- [ ] Add author metadata.
- [ ] Add asset checksums.
- [ ] Validate all paths against path traversal.
- [ ] Reject remote URLs by default.
- [ ] Create a local avatar registry.
- [ ] Add import-avatar command.
- [ ] Add remove-avatar command.
- [ ] Add activate-avatar command.
- [ ] Add avatar validation report.
- [ ] Add a built-in example package.
- [ ] Document the format in `docs/AVATAR_PACKAGE_SPEC.md`.

## Example manifest

```json
{
  "schemaVersion": 1,
  "id": "sol-codex-companion",
  "name": "Sol",
  "version": "0.1.0",
  "author": "Local User",
  "license": "Original user-owned assets",
  "preferredRuntime": "pixi",
  "fallbackRuntime": "svg",
  "entrypoints": {
    "pixi": "sprites/avatar.json",
    "svg": "fallback/avatar.svg"
  },
  "capabilities": [
    "state-animation",
    "one-shot-triggers",
    "speech-level",
    "reduced-motion"
  ],
  "states": {
    "idle": "idle_loop",
    "thinking": "think_loop",
    "coding": "type_loop",
    "speaking": "talk_loop",
    "success": "celebrate_once",
    "error": "error_once"
  }
}
```

## Acceptance criteria

- [ ] Valid packages import successfully.
- [ ] Invalid packages produce actionable errors.
- [ ] Path traversal attempts are rejected.
- [ ] Remote entrypoints are rejected by default.
- [ ] Removing an active avatar returns to the built-in avatar.
- [ ] License metadata is visible in settings.

---

# Phase 11 — Image-to-SVG Asset Pipeline

## Tasks

- [ ] Create the `asset-pipeline` package.
- [ ] Add `Codex Avatar: Vectorize Image to SVG`.
- [ ] Support PNG, JPG, and WebP input.
- [ ] Add configurable preprocessing.
- [ ] Add background removal only as an optional local step.
- [ ] Add grayscale and threshold modes.
- [ ] Add color quantization.
- [ ] Add vector tracing.
- [ ] Add SVG optimization with SVGO.
- [ ] Sanitize the final SVG.
- [ ] Add preview before saving.
- [ ] Preserve the original source file.
- [ ] Add output naming rules.
- [ ] Add cancellation support.
- [ ] Add size and complexity limits.
- [ ] Add tests with simple fixtures.
- [ ] Document expected limitations.

## Acceptance criteria

- [ ] A simple raster image converts to valid SVG.
- [ ] Generated SVG opens in the Webview.
- [ ] Original files remain unchanged.
- [ ] Oversized images are rejected or resized safely.
- [ ] Malicious SVG content is removed.
- [ ] Conversion can be cancelled.

---

# Phase 12 — Settings, Persistence, and Accessibility

## Tasks

- [ ] Add extension settings schema.
- [ ] Add active avatar setting.
- [ ] Add runtime preference.
- [ ] Add animation intensity.
- [ ] Add frame-rate setting.
- [ ] Add particle-effects setting.
- [ ] Add reduced-motion override.
- [ ] Add sound and lip-sync settings.
- [ ] Add idle timeout.
- [ ] Add sleep timeout.
- [ ] Add debug overlay setting.
- [ ] Persist global preferences.
- [ ] Persist workspace-specific preferences only when appropriate.
- [ ] Add reset-to-defaults command.
- [ ] Add accessible settings descriptions.
- [ ] Add high-contrast compatibility.
- [ ] Add a no-animation mode.

## Acceptance criteria

- [ ] Settings survive IDE restart.
- [ ] Workspace settings do not leak to unrelated workspaces.
- [ ] Invalid settings fall back to defaults.
- [ ] No-animation mode keeps the assistant functional.
- [ ] High-contrast mode remains usable.
- [ ] Reset command restores defaults.

---

# Phase 13 — Audio-Reactive Mouth and Speech Animation

This phase is optional for the first public MVP but must be implemented before voice assistant functionality.

## Tasks

- [ ] Create an audio-reactive interface independent of any TTS provider.
- [ ] Accept normalized amplitude values from `0` to `1`.
- [ ] Add attack and release smoothing.
- [ ] Map amplitude to mouth-open levels.
- [ ] Add silence detection.
- [ ] Add speaking-start and speaking-stop events.
- [ ] Add a Web Audio API adapter for local playback.
- [ ] Avoid microphone permission unless explicitly requested.
- [ ] Add a mock audio-level generator for testing.
- [ ] Connect speech level to SVG.
- [ ] Connect speech level to PixiJS.
- [ ] Add reduced-motion behavior.
- [ ] Add unit tests for smoothing.

## Acceptance criteria

- [ ] Mock speech produces visible mouth movement.
- [ ] Silence closes the mouth.
- [ ] Audio processing stops when the Webview is hidden.
- [ ] No microphone permission is requested by default.
- [ ] Runtime remains functional without audio.

---

# Phase 14 — Optional Inochi2D Runtime

Do not start this phase until the PixiJS MVP is stable.

## Tasks

- [ ] Reconfirm the runtime and model-format licenses.
- [ ] Create `optional/runtime-inochi2d`.
- [ ] Lazy-load the runtime.
- [ ] Add local model loading.
- [ ] Add model validation.
- [ ] Map avatar states to parameters.
- [ ] Map speech level to mouth-open parameters.
- [ ] Add blinking.
- [ ] Add eye-direction controls.
- [ ] Add idle breathing.
- [ ] Add expression presets.
- [ ] Add runtime disposal.
- [ ] Add fallback to PixiJS or SVG.
- [ ] Add an experimental feature flag.
- [ ] Document supported and unsupported model features.

## Acceptance criteria

- [ ] Base extension bundle does not include Inochi2D.
- [ ] Enabling the feature loads a local test model.
- [ ] Missing or invalid models fall back safely.
- [ ] Mouth and eye parameters respond.
- [ ] Runtime disposes cleanly.
- [ ] License documentation is complete.

---

# Phase 15 — Optional Three.js and VRM Runtime

Do not start this phase until the 2D MVP is stable.

## Tasks

- [ ] Create `optional/runtime-vrm`.
- [ ] Add Three.js.
- [ ] Add `@pixiv/three-vrm`.
- [ ] Lazy-load all 3D dependencies.
- [ ] Load local VRM models.
- [ ] Validate model size.
- [ ] Add a transparent scene.
- [ ] Add camera framing.
- [ ] Add neutral lighting.
- [ ] Add idle animation.
- [ ] Add blinking.
- [ ] Add gaze tracking.
- [ ] Add expression mapping.
- [ ] Add speech-level mouth movement.
- [ ] Add GLB or VRM animation loading.
- [ ] Use WebGL by default.
- [ ] Add experimental WebGPU detection.
- [ ] Add renderer fallback.
- [ ] Pause rendering when hidden.
- [ ] Add aggressive resource disposal.
- [ ] Add a performance quality selector.

## Acceptance criteria

- [ ] Base extension bundle does not include 3D dependencies.
- [ ] A local VRM model loads.
- [ ] WebGL works without WebGPU.
- [ ] Unsupported WebGPU falls back automatically.
- [ ] Model failure returns to the 2D runtime.
- [ ] Hidden panel stops 3D rendering.
- [ ] GPU resources are released after closing the panel.

---

# Phase 16 — Optional Live2D Compatibility

## Tasks

- [ ] Complete a dedicated licensing review.
- [ ] Keep Live2D support optional.
- [ ] Create `optional/runtime-live2d`.
- [ ] Do not bundle proprietary SDK files unless permitted.
- [ ] Add local `model3.json` loading.
- [ ] Validate referenced textures and motions.
- [ ] Add blink parameters.
- [ ] Add breath parameters.
- [ ] Add gaze parameters.
- [ ] Add mouth-open parameters.
- [ ] Map states to expressions and motions.
- [ ] Add runtime failure fallback.
- [ ] Add attribution and commercial-use documentation.
- [ ] Add a feature flag.

## Acceptance criteria

- [ ] Base product works without Live2D.
- [ ] No proprietary SDK files are distributed without permission.
- [ ] Local model loading works in a permitted development setup.
- [ ] Failure falls back to PixiJS or SVG.
- [ ] Licensing documentation clearly explains user responsibilities.

---

# Phase 17 — Blender Export Tools

## Tasks

- [ ] Create `optional/blender-tools`.
- [ ] Add Blender executable path setting.
- [ ] Detect Blender availability.
- [ ] Add a safe process runner.
- [ ] Add timeout and cancellation.
- [ ] Create `export_glb.py`.
- [ ] Create `export_svg.py` for Grease Pencil or line-art output.
- [ ] Create `render_preview.py`.
- [ ] Preserve the original `.blend` file.
- [ ] Write outputs to a dedicated export directory.
- [ ] Capture Blender stdout and stderr.
- [ ] Produce user-friendly errors.
- [ ] Validate generated files.
- [ ] Add `Codex Avatar: Export Blender Scene`.
- [ ] Add `Codex Avatar: Export Blender Line Art`.
- [ ] Add documentation for supported Blender versions.

## Acceptance criteria

- [ ] Missing Blender installation produces a clear message.
- [ ] Export command can be cancelled.
- [ ] Original Blender files remain unchanged.
- [ ] Valid GLB export passes validation.
- [ ] Valid SVG export passes sanitization.
- [ ] Failed processes do not leave locked files.

---

# Phase 18 — Security and Privacy Hardening

## Tasks

- [ ] Review all Webview CSP directives.
- [ ] Reject remote script execution.
- [ ] Sanitize SVG.
- [ ] Validate JSON with Zod.
- [ ] Prevent path traversal.
- [ ] Restrict file access to approved workspace or extension storage paths.
- [ ] Add maximum asset sizes.
- [ ] Add maximum texture dimensions.
- [ ] Add maximum spritesheet frame counts.
- [ ] Add safe subprocess argument handling.
- [ ] Do not use shell interpolation for Blender commands.
- [ ] Add workspace-trust checks.
- [ ] Document all local data storage.
- [ ] Add a clear-cache command.
- [ ] Add a delete-imported-avatar command.
- [ ] Add security tests for malformed packages.

## Acceptance criteria

- [ ] Security test fixtures are rejected.
- [ ] Workspace trust restrictions work.
- [ ] No remote code is executed.
- [ ] Asset paths cannot escape approved directories.
- [ ] Clearing cache removes generated data only.
- [ ] Privacy documentation matches implementation.

---

# Phase 19 — Performance and Stability

## Tasks

- [ ] Add Webview visibility pause.
- [ ] Add frame-rate cap.
- [ ] Add texture cache limits.
- [ ] Add texture eviction.
- [ ] Add runtime memory diagnostics in development.
- [ ] Add low-quality mode.
- [ ] Add particle disable option.
- [ ] Add maximum canvas dimensions.
- [ ] Add delayed optional-runtime loading.
- [ ] Add runtime initialization timeout.
- [ ] Add crash recovery to SVG fallback.
- [ ] Test repeated open and close cycles.
- [ ] Test repeated avatar switching.
- [ ] Test extension reload.
- [ ] Document performance budgets.

## Target budgets

- Webview idle CPU: as close to zero as practical when hidden.
- Default visible animation: 30 FPS.
- Webview base JavaScript bundle: keep minimal.
- Optional 3D runtime: separate lazy chunk.
- Avatar switch: no IDE restart.
- Runtime failure: automatic fallback, no extension crash.

## Acceptance criteria

- [ ] Twenty open/close cycles do not create duplicate canvases.
- [ ] Twenty avatar switches do not continuously increase memory.
- [ ] Hidden Webview stops animation.
- [ ] Low-quality mode visibly reduces work.
- [ ] Runtime timeout falls back to SVG.
- [ ] Performance documentation contains measured results.

---

# Phase 20 — Testing

## Unit tests

- [ ] State machine transitions.
- [ ] State priority.
- [ ] Event debounce.
- [ ] Message schemas.
- [ ] Manifest validation.
- [ ] Path validation.
- [ ] SVG sanitization.
- [ ] Spritesheet validation.
- [ ] Audio-level smoothing.
- [ ] Runtime fallback selection.
- [ ] Settings defaults.
- [ ] Workspace persistence.

## Integration tests

- [ ] Extension activation.
- [ ] Webview opening.
- [ ] Extension-to-Webview message.
- [ ] Webview-to-extension message.
- [ ] Command registration.
- [ ] Manual state command.
- [ ] File-save event reaction.
- [ ] Diagnostic event reaction.
- [ ] Task start and finish reaction.
- [ ] Avatar import.
- [ ] Invalid avatar rejection.
- [ ] Runtime failure fallback.
- [ ] Extension deactivation cleanup.

## Manual test matrix

- [ ] Windows.
- [ ] macOS, when available.
- [ ] Linux, when available.
- [ ] VS Code stable.
- [ ] At least one VS Code-compatible editor, when extension compatibility permits.
- [ ] Light theme.
- [ ] Dark theme.
- [ ] High-contrast theme.
- [ ] Reduced motion.
- [ ] Low-performance mode.
- [ ] No GPU acceleration scenario where testable.

## Acceptance criteria

- [ ] Unit test suite passes.
- [ ] Integration test suite passes.
- [ ] Manual smoke test passes on the primary development platform.
- [ ] Known platform limitations are documented.
- [ ] No critical unhandled exceptions remain.

---

# Phase 21 — CI, Packaging, and Release

## Tasks

- [ ] Add CI for install, lint, type-check, test, and build.
- [ ] Pin or control Node and pnpm versions.
- [ ] Add dependency caching.
- [ ] Add extension packaging.
- [ ] Validate package contents.
- [ ] Exclude research clones and development-only assets.
- [ ] Exclude optional proprietary SDK files.
- [ ] Add versioning policy.
- [ ] Add changelog.
- [ ] Add release checklist.
- [ ] Add license and third-party notices to the package.
- [ ] Add a clean-room built-in avatar.
- [ ] Create a pre-release VSIX.
- [ ] Install the VSIX in a clean profile.
- [ ] Run final smoke tests.

## Acceptance criteria

- [ ] CI passes on the main branch.
- [ ] VSIX builds.
- [ ] VSIX installs in a clean VS Code profile.
- [ ] Assistant opens without development files.
- [ ] Built-in SVG and PixiJS avatars work.
- [ ] Package contains all required notices.
- [ ] Package contains no unlicensed assets.

---

# Phase 22 — Documentation

## Tasks

- [ ] Write user installation instructions.
- [ ] Write developer setup instructions.
- [ ] Write avatar package creation instructions.
- [ ] Write spritesheet creation instructions.
- [ ] Write image-to-SVG instructions.
- [ ] Write Blender export instructions.
- [ ] Write runtime adapter instructions.
- [ ] Write troubleshooting instructions.
- [ ] Write performance recommendations.
- [ ] Write privacy documentation.
- [ ] Write licensing documentation.
- [ ] Add screenshots or original demo recordings.
- [ ] Add architecture diagrams.
- [ ] Add examples without copyrighted third-party characters.

## Acceptance criteria

- [ ] A new developer can build the project from the README.
- [ ] A user can import an avatar package without reading source code.
- [ ] A developer can create a new runtime adapter from the documentation.
- [ ] Licensing limitations are understandable.
- [ ] All documented commands match actual scripts.

---

# 6. Definition of MVP Complete

The MVP is complete only when every item below is checked.

- [ ] Extension installs and activates.
- [ ] Assistant panel opens.
- [ ] React Webview loads.
- [ ] Strict CSP is active.
- [ ] Built-in SVG fallback works.
- [ ] Built-in original PixiJS spritesheet avatar works.
- [ ] State machine works.
- [ ] Manual state commands work.
- [ ] File save changes the avatar state.
- [ ] Diagnostics change the avatar state.
- [ ] Task start and completion change the avatar state.
- [ ] Avatar package validation works.
- [ ] Local avatar import works.
- [ ] Reduced-motion mode works.
- [ ] Hidden Webview pauses rendering.
- [ ] Invalid runtime falls back safely.
- [ ] Tests pass.
- [ ] CI passes.
- [ ] VSIX installs in a clean profile.
- [ ] No unlicensed character assets are included.
- [ ] Documentation is complete.

---

# 7. Recommended Commit Sequence

Codex should use one focused commit per completed phase.

```text
chore: document baseline and licensing
chore: initialize workspace tooling
feat(core): add avatar protocol and schemas
feat(core): add avatar state machine
feat(extension): add assistant webview shell
feat(webview): add React interface
feat(svg): add fallback avatar runtime
feat(pixi): add PixiJS runtime
feat(pet): add spritesheet behavior
feat(events): connect public IDE events
feat(assets): add avatar package format
feat(vector): add image-to-SVG pipeline
feat(settings): add persistence and accessibility
feat(audio): add speech-level animation
feat(inochi): add optional Inochi2D adapter
feat(vrm): add optional VRM adapter
feat(live2d): add optional Live2D compatibility
feat(blender): add local export tools
security: harden assets and webview
perf: add runtime budgets and cleanup
test: complete integration coverage
ci: package release candidate
docs: complete user and developer guides
```

---

# 8. Final Instruction to Codex

Begin with Phase 0.

Do not implement Inochi2D, Live2D, VRM, WebGPU enhancements, voice, or Blender integration before the SVG and PixiJS MVP passes all acceptance criteria.

After each completed task:

1. Run the relevant verification.
2. Mark the checkbox `[x]`.
3. Record evidence.
4. Commit the completed phase.
5. Continue to the next unchecked task in the same phase.
6. Move to the next phase only when every acceptance criterion in the current phase is checked.

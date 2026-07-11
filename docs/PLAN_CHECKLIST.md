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
- [x] Add or reference the official PixiJS skills for coding agents.
- [x] Create `PixiAvatarRuntime`.
- [x] Create a single PixiJS `Application` per avatar stage.
- [x] Initialize WebGL safely.
- [x] Detect WebGPU without requiring it.
- [x] Add automatic renderer fallback.
- [x] Create a resize observer.
- [x] Cap device pixel ratio.
- [x] Create a texture cache.
- [x] Destroy textures and application resources on disposal.
- [x] Pause ticker when hidden.
- [x] Resume ticker when visible.
- [x] Add a configurable frame-rate cap.
- [x] Add a debug information surface showing renderer, dimensions, and active state.
- [x] Add unit tests for the adapter contract.

### Phase 7 progress evidence — 2026-07-10

- `packages/runtime-pixi` now depends on PixiJS 8.14 and exports an isolated `PixiAvatarRuntime` implementing the shared adapter contract. It creates one WebGL-preferred application per initialized stage, caps resolution at 2×, maps core states, handles trigger effects, and destroys application resources/canvases cleanly.
- The adapter is lazy-loaded by `apps/webview/src/renderers/PixiAvatarRenderer.tsx` only when the PixiJS setting is selected. It forwards state, trigger, speech-level, reduced-motion, and visibility updates, and switches to the SVG renderer if loading or initialization fails.
- The runtime exposes non-required WebGPU detection, WebGL-first initialization with WebGPU fallback when available, resize observation, visibility-driven ticker pause/resume, 30/60 FPS caps, and a debug information surface.
- `packages/runtime-pixi/src/textureCache.ts` adds a local texture cache with trimmed source keys, concurrent-load deduplication, injected loading/destruction hooks, stale-load invalidation, and explicit cleanup. `PixiAvatarRuntime` clears the cache during disposal and disposes an existing application before reinitialization.
- `skills.md` references the official PixiJS skills repository as coding-agent reference material only; it is not bundled as a runtime dependency.
- Verification: `pnpm --filter @codex-avatar-studio/runtime-pixi typecheck`, `pnpm --filter @codex-avatar-studio/runtime-pixi lint`, `pnpm --filter @codex-avatar-studio/runtime-pixi test`, `pnpm --filter @codex-avatar-studio/webview test`, and `pnpm run ci` pass. Runtime-Pixi tests: 14 passed; Webview smoke tests: 3 passed. The lifecycle tests cover disposal, reinitialization, visibility events, WebGPU fallback selection, and failed initialization cleanup.
- Manual browser smoke: served `apps/webview/dist` at `http://127.0.0.1:4173/?runtime=pixi` in the Codex in-app browser. Observed one Pixi canvas, no loading placeholder after initialization, no console errors, and one canvas after a page reload.
- Manual fallback smoke: served the same build on a fresh origin with the Pixi lazy entry withheld. Observed one SVG avatar, no Pixi canvas, no loading placeholder, and no console errors; the generated chunk was restored and the normal Webview smoke suite passed afterward.

## Performance rules

- Default target: 30 FPS inside the IDE.
- Optional high-quality target: 60 FPS.
- Hidden Webview target: paused.
- Reduced-motion target: static or event-only animation.
- Maximum default device pixel ratio: 2.

## Acceptance criteria

- [x] PixiJS initializes without console errors.
- [x] Runtime disposes cleanly.
- [x] Reopening the panel does not create duplicate canvases.
- [x] Hidden panel stops rendering.
- [x] Renderer fallback works.
- [x] SVG fallback loads if PixiJS initialization fails.

---

# Phase 8 — Spritesheet Avatar and Codex Pet Behavior

## Tasks

- [x] Study the AITuber OnAir Pet example.
- [x] Identify the smallest reusable behavior concepts.
- [x] Do not copy unverified artwork.
- [x] Create an original placeholder spritesheet.
- [x] Define a spritesheet metadata format.
- [x] Implement spritesheet loading contract.
- [x] Implement named animation clips.
- [x] Map avatar states to animation clips.
- [x] Map triggers to one-shot clips.
- [x] Add clip priorities.
- [x] Add clean clip transitions.
- [x] Add animation completion callbacks.
- [x] Add random idle variation.
- [x] Add cursor or editor-direction gaze approximation.
- [x] Add particle layers for success and error.
- [x] Add a holographic thinking effect.
- [x] Add a low-performance mode without particles.
- [x] Add tests for missing clips and malformed metadata.

### Phase 8 progress evidence — 2026-07-10

- Reference study: reviewed the AITuber OnAir Pet example README and `PetStage.tsx` at `https://github.com/shinshin86/aituber-onair/tree/main/packages/core/examples/react-pet-app`. The reference describes a local pet manifest plus spritesheet, state-row animation, audio-level reactions, and runtime pet replacement; its implementation adds weighted thinking actions, speaking action sequencing, keyword-driven mood reactions, and small movement physics.
- Reusable concepts selected for this project: manifest-driven atlas metadata; deterministic state-to-clip mapping; bounded weighted idle/thinking variation; one-shot and looped clips; optional gaze/effects layers; and local-only asset replacement. No upstream artwork, code, or asset files were copied.
- Original placeholder asset: `apps/extension/media/avatars/pixi/placeholder-spritesheet.svg` is a clean-room 4×4 atlas of geometric orb frames, paired with 23 state/trigger clips in `placeholder-spritesheet.json`. The extension asset test confirms the pairing, required clip set, internal-only references, and absence of scripts or remote URLs.
- Pixi behavior: `PixiAvatarRuntime.setPoseInput` applies bounded cursor-direction gaze offsets; thinking draws a reduced-motion-aware holographic ring; success/error states and the particle trigger draw local effect dots; low-performance mode suppresses effect work. The Webview forwards cursor pose and intensity policy into the runtime.
- `packages/runtime-pixi/src/spritesheet.ts` defines an original metadata contract, validates frame data, maps every required state and trigger to named clips, and falls back to `idle_loop` when a state clip is missing.
- No upstream character artwork or copied assets were added. The runtime now loads the original local atlas through the Pixi stage, while SVG remains the failure fallback.
- `SpriteAnimationController` applies clip priorities, restores the active state after one-shot completion, supports deterministic idle variation, exposes completion callbacks, and suppresses particle clips in low-performance mode.
- Verification: runtime-pixi typecheck, lint, formatting, and 16 Vitest tests pass; extension asset smoke tests pass 10/10; full `pnpm run ci` passes.

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

- [x] All required states have a clip or fallback.
- [x] Missing clips fall back to idle.
- [x] One-shot clips return to the expected state.
- [x] Spritesheet validation catches malformed data.
- [x] No upstream character artwork is present.
- [x] Animation remains responsive at the configured frame rate.

### Phase 8 acceptance evidence — 2026-07-10

- Required state and trigger coverage is asserted by `apps/extension/test/pixi-assets.test.mjs` (23 named clips) and `packages/runtime-pixi/test/spritesheet.test.ts` (state mapping plus idle fallback).
- One-shot restoration, priorities, deterministic idle variation, and low-performance particle suppression are covered by `packages/runtime-pixi/test/animationController.test.ts`; malformed metadata is rejected by `packages/runtime-pixi/test/spritesheet.test.ts`.
- Clean-room asset checks confirm the original geometric atlas has no scripts, remote references, or upstream character artwork.
- `packages/runtime-pixi/test/runtimeLifecycle.test.ts` verifies local metadata/image loading and ticker-driven frame advancement at the configured FPS; `pnpm run ci` passes all formatting, lint, typecheck, test, and build stages.

---

# Phase 9 — IDE Event Bridge

## Tasks

- [x] Listen to active editor changes.
- [x] Listen to text document changes with throttling.
- [x] Listen to document save events.
- [x] Listen to diagnostics changes.
- [x] Listen to debug session start.
- [x] Listen to debug session termination.
- [x] Listen to task start.
- [x] Listen to task end.
- [x] Listen to terminal creation and closure where useful.
- [x] Listen to workspace trust changes.
- [x] Map public IDE events to `IdeAssistantEvent`.
- [x] Map assistant events to avatar states.
- [x] Add debounce and cooldown rules.
- [x] Add an idle timer.
- [x] Add a sleep timer.
- [x] Add manual state commands for events that cannot be detected reliably.
- [x] Do not assume access to private Codex internal state.
- [x] Add optional command hooks that other extensions can invoke.
- [x] Document integration limits.

### Phase 9 progress evidence — 2026-07-11

- `apps/extension/src/ideEvents.ts` now listens to public VS Code editor, document, save, diagnostics, debug, task, terminal, and workspace-trust events. Task process exit codes map to success/error, and optional event surfaces are guarded.
- Rapid document changes use a trailing throttle; diagnostics use a trailing debounce; activity resets an idle-to-sleep timer; manual state commands and the validated `codexAvatar.emitEvent` hook remain available for events that cannot be observed directly.
- `docs/IDE_EVENT_BRIDGE.md` documents the public-only boundary, optional hook, throttling, and integration limits. No private Codex state is read.
- Verification: `apps/extension/test/ideEvents.test.ts` passes 2/2 tests covering typing throttling, diagnostics debounce, task failure mapping, terminal/trust mapping, sleep behavior, graceful diagnostics failure, and listener disposal. Extension typecheck and tests pass.

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

- [x] Public IDE events produce the expected avatar states.
- [x] Rapid typing does not flood the Webview.
- [x] Repeated diagnostics are debounced.
- [x] Tasks map exit results correctly.
- [x] Event listeners are disposed.
- [x] Unsupported IDE events fail gracefully.

### Phase 9 acceptance evidence — 2026-07-11

- `pnpm --workspace-root exec vitest run apps/extension/test/ideEvents.test.ts` verifies the public event mappings, throttling, debounce, task exit-code mapping, optional diagnostics failure handling, sleep transition, and disposal.
- `pnpm --filter codex-avatar-studio-extension typecheck` and `pnpm --filter codex-avatar-studio-extension test` pass, including extension manifest/compiled-command smoke checks and the event bridge suite.

---

# Phase 10 — Avatar Package and Manifest System

## Tasks

- [x] Define `avatar.manifest.json`.
- [x] Add manifest versioning.
- [x] Add runtime preference.
- [x] Add runtime fallback.
- [x] Add capability declarations.
- [x] Add state-to-animation mappings.
- [x] Add trigger mappings.
- [x] Add preview image path.
- [x] Add license metadata.
- [x] Add author metadata.
- [x] Add asset checksums.
- [x] Validate all paths against path traversal.
- [x] Reject remote URLs by default.
- [x] Create a local avatar registry.
- [x] Add import-avatar command.
- [x] Add remove-avatar command.
- [x] Add activate-avatar command.
- [x] Add avatar validation report.
- [x] Add a built-in example package.
- [x] Document the format in `docs/AVATAR_PACKAGE_SPEC.md`.

### Phase 10 progress evidence — 2026-07-11

- `packages/avatar-core/src/manifest.ts` defines the versioned manifest schema, runtime preference/fallback, capabilities, state/trigger maps, author/license metadata, preview path, and SHA-256 checksum format.
- `apps/extension/src/avatarPackages.ts` validates local packages, checks referenced files and checksums, rejects traversal/absolute/remote paths, rejects symlink escapes, and maintains a workspace-local registry under `.codex-avatar/`.
- Import, remove, and activate commands are contributed by the extension. Active package paths are converted to approved Webview URIs; failures reload the built-in SVG/Pixi manifest.
- The asset manager displays name, author, license, runtime paths, and validation status. `docs/AVATAR_PACKAGE_SPEC.md` documents the format and integration rules.
- `apps/extension/media/avatars/avatar.manifest.json` is the built-in versioned example package for the original geometric avatar.
- Verification: `apps/extension/test/avatar-packages.test.mjs` passes package import/activation/removal, built-in validation, traversal/remote rejection, and checksum mismatch tests; extension/Webview smoke tests and full `pnpm run ci` pass.

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

- [x] Valid packages import successfully.
- [x] Invalid packages produce actionable errors.
- [x] Path traversal attempts are rejected.
- [x] Remote entrypoints are rejected by default.
- [x] Removing an active avatar returns to the built-in avatar.
- [x] License metadata is visible in settings.

### Phase 10 acceptance evidence — 2026-07-11

- `pnpm --filter codex-avatar-studio-extension test` verifies valid import, activation, removal-to-built-in behavior, malformed package errors, traversal/remote rejection, checksum mismatch handling, and contributed command wiring.
- `pnpm --filter @codex-avatar-studio/webview test` verifies the built asset manager bundle includes license metadata and the manifest bridge remains local-only.
- `pnpm run ci` passes formatting, lint, typecheck, tests, and builds.

---

# Phase 11 — Image-to-SVG Asset Pipeline

## Tasks

- [x] Create the `asset-pipeline` package.
- [x] Add `Codex Avatar: Vectorize Image to SVG`.
- [x] Support PNG, JPG, and WebP input.
- [x] Add configurable preprocessing.
- [x] Add background removal only as an optional local step.
- [x] Add grayscale and threshold modes.
- [x] Add color quantization.
- [x] Add vector tracing.
- [x] Add SVG optimization with SVGO.
- [x] Sanitize the final SVG.
- [x] Add preview before saving.
- [x] Preserve the original source file.
- [x] Add output naming rules.
- [x] Add cancellation support.
- [x] Add size and complexity limits.
- [x] Add tests with simple fixtures.
- [x] Document expected limitations.

### Phase 11 progress evidence — 2026-07-11

- The local asset pipeline accepts PNG, JPG/JPEG, and WebP metadata, applies configurable threshold/noise/background options, records grayscale and quantization limitations, traces with Potrace, optimizes with SVGO while preserving IDs/groups, and sanitizes before and after optimization.
- `previewImageToSvg` generates an in-memory optimized SVG and `savePreviewedImageToSvg` writes only after confirmation. The extension command opens the preview in an editor before saving. Source images remain untouched.
- Abort signals are checked before, during, and after tracing. Raster dimensions and generated SVG byte/path limits reject unsafe work before output writes.
- Verification: asset-pipeline tests pass 17/17, including preview/save, source preservation, cancellation, oversized input rejection, SVG sanitization, and simple raster conversion. Full CI is green.

## Acceptance criteria

- [x] A simple raster image converts to valid SVG.
- [x] Generated SVG opens in the Webview.
- [x] Original files remain unchanged.
- [x] Oversized images are rejected or resized safely.
- [x] Malicious SVG content is removed.
- [x] Conversion can be cancelled.

### Phase 11 acceptance evidence — 2026-07-11

- `pnpm --filter @codex-avatar-studio/asset-pipeline test` covers raster conversion, preview-before-save, source preservation, cancellation, output safety limits, and sanitization.
- `pnpm --filter @codex-avatar-studio/webview test` confirms the generated Webview bundle remains loadable and local-only; `pnpm run ci` passes all formatting, lint, typecheck, test, and build stages.

---

# Phase 12 — Settings, Persistence, and Accessibility

## Tasks

- [x] Add extension settings schema.
- [x] Add active avatar setting.
- [x] Add runtime preference.
- [x] Add animation intensity.
- [x] Add frame-rate setting.
- [x] Add particle-effects setting.
- [x] Add reduced-motion override.
- [x] Add sound and lip-sync settings.
- [x] Add idle timeout.
- [x] Add sleep timeout.
- [x] Add debug overlay setting.
- [x] Persist global preferences.
- [x] Persist workspace-specific preferences only when appropriate.
- [x] Add reset-to-defaults command.
- [x] Add accessible settings descriptions.
- [x] Add high-contrast compatibility.
- [x] Add a no-animation mode.

### Phase 12 progress evidence — 2026-07-11

- Extension settings now validate and persist runtime, active avatar, intensity, frame rate, particles, reduced motion, sound/lip-sync flags, idle/sleep timeouts, debug overlay, and no-animation mode. Invalid persisted values fall back to safe defaults; updates are global because these preferences are user-level, while avatar package files remain workspace-local.
- Pixi receives frame-rate, particle, lip-sync, and no-animation policy. SVG mouth movement respects the lip-sync flag. No-animation keeps the assistant rendered while suppressing continuous effects.
- Settings descriptions are explicit, reset-to-defaults remains available, and the Webview includes keyboard-visible controls plus forced-colors styling.
- Verification: `apps/extension/test/settings.test.ts` passes invalid-value fallback and global persistence checks; Pixi tests pass particle suppression; Webview smoke verifies no-animation wiring and high-contrast CSS; full CI is green.

## Acceptance criteria

- [x] Settings survive IDE restart.
- [x] Workspace settings do not leak to unrelated workspaces.
- [x] Invalid settings fall back to defaults.
- [x] No-animation mode keeps the assistant functional.
- [x] High-contrast mode remains usable.
- [x] Reset command restores defaults.

### Phase 12 acceptance evidence — 2026-07-11

- `pnpm --filter codex-avatar-studio-extension test` covers settings fallback, bounded timing persistence, reset/contributed command wiring, and extension compilation.
- `pnpm --filter @codex-avatar-studio/webview test` verifies no-animation settings and forced-colors CSS in the built Webview.
- `pnpm run ci` passes formatting, lint, typecheck, tests, and builds.

---

# Phase 13 — Audio-Reactive Mouth and Speech Animation

This phase is optional for the first public MVP but must be implemented before voice assistant functionality.

## Tasks

- [x] Create an audio-reactive interface independent of any TTS provider.
- [x] Accept normalized amplitude values from `0` to `1`.
- [x] Add attack and release smoothing.
- [x] Map amplitude to mouth-open levels.
- [x] Add silence detection.
- [x] Add speaking-start and speaking-stop events.
- [x] Add a Web Audio API adapter for local playback.
- [x] Avoid microphone permission unless explicitly requested.
- [x] Add a mock audio-level generator for testing.
- [x] Connect speech level to SVG.
- [x] Connect speech level to PixiJS.
- [x] Add reduced-motion behavior.
- [x] Add unit tests for smoothing.

### Phase 13 progress evidence — 2026-07-11

- `packages/avatar-core/src/audio.ts` exposes a TTS-independent normalized amplitude interface with attack/release smoothing, silence thresholding, speaking start/stop callbacks, reset behavior, and a deterministic mock generator.
- `apps/webview/src/audio/webAudioLevelAdapter.ts` analyzes local media-element playback only. It never calls microphone APIs and provides visibility observation that suspends/resumes processing when the Webview is hidden.
- `useAvatarBehavior` consumes normalized external audio/speech levels, emits a smoothed mouth level to SVG and Pixi, and preserves text-only behavior as a fallback when no audio level is supplied. No-animation mode closes the mouth.
- Pixi now renders a dedicated mouth layer and scales it from the smoothed speech level; SVG uses the same `mouthOpen` signal.
- Verification: avatar-core audio tests pass 19/19; Pixi tests pass 17/17; Webview source smoke rejects microphone/network APIs; full CI is green.

## Acceptance criteria

- [x] Mock speech produces visible mouth movement.
- [x] Silence closes the mouth.
- [x] Audio processing stops when the Webview is hidden.
- [x] No microphone permission is requested by default.
- [x] Runtime remains functional without audio.

### Phase 13 acceptance evidence — 2026-07-11

- `pnpm --filter @codex-avatar-studio/avatar-core test` covers attack/release smoothing, normalized clamping, speaking transitions, and mock levels.
- `pnpm --filter @codex-avatar-studio/runtime-pixi test` verifies the Pixi mouth layer responds to speech level without breaking the runtime contract.
- `pnpm --filter @codex-avatar-studio/webview test` verifies the Webview bundle and rejects microphone/network APIs; `pnpm run ci` passes all stages.

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

- [x] Review all Webview CSP directives.
- [x] Reject remote script execution.
- [x] Sanitize SVG.
- [x] Validate JSON with Zod.
- [x] Prevent path traversal.
- [x] Restrict file access to approved workspace or extension storage paths.
- [x] Add maximum asset sizes.
- [x] Add maximum texture dimensions.
- [x] Add maximum spritesheet frame counts.
- [x] Add safe subprocess argument handling.
- [x] Do not use shell interpolation for Blender commands.
- [x] Add workspace-trust checks.
- [x] Document all local data storage.
- [x] Add a clear-cache command.
- [x] Add a delete-imported-avatar command.
- [x] Add security tests for malformed packages.

### Phase 18 progress evidence — 2026-07-11

- Webview CSP is nonce-based and local-resource-only: `default-src 'none'`, no remote script sources, no embedded objects, no forms, and only VS Code resource URIs for scripts, styles, images, and connections.
- Imported packages are bounded to 128 regular files, 10 MiB per file, and 64 MiB total. Symbolic links, unsafe SVG content, traversal, remote paths, forged registry paths, and checksum failures are rejected.
- Pixi metadata rejects remote image paths, frames beyond 4096, excessive clip references, and textures larger than 4096×4096. Shared avatar manifests continue to use the Zod schema in `packages/avatar-core`.
- Workspace-mutating commands require `vscode.workspace.isTrusted`. Blender scenes stay inside the workspace, subprocess arguments remain separate, and `shell: false` is explicit.
- `Codex Avatar: Clear Generated Cache` removes only `.codex-avatar/cache/` and `.codex-avatar/previews/`; `Codex Avatar: Delete Imported Avatar Package` removes selected imported packages. Privacy and storage behavior is documented in `docs/SECURITY_PRIVACY.md`.
- Verification fixtures cover oversized and unsafe packages, forged registries, workspace boundaries, CSP, command wiring, and non-shell Blender execution.

## Acceptance criteria

- [x] Security test fixtures are rejected.
- [x] Workspace trust restrictions work.
- [x] No remote code is executed.
- [x] Asset paths cannot escape approved directories.
- [x] Clearing cache removes generated data only.
- [x] Privacy documentation matches implementation.

### Phase 18 acceptance evidence — 2026-07-11

- `apps/extension/test/avatar-packages.test.mjs` rejects traversal, remote entrypoints, unsafe SVG, oversized files, bad checksums, and forged registry paths while proving cache clearing preserves exports.
- `packages/runtime-pixi/test/spritesheet.test.ts` covers local-only metadata and texture-dimension bounds; `apps/extension/test/blender-plan.test.mjs` covers workspace input boundaries and `shell: false`.
- `apps/extension/test/extension-smoke.test.mjs` verifies trust-gated commands and strict CSP markers. `pnpm run ci` is the required final verification for formatting, lint, typecheck, tests, and builds.

---

# Phase 19 — Performance and Stability

## Tasks

- [x] Add Webview visibility pause.
- [x] Add frame-rate cap.
- [x] Add texture cache limits.
- [x] Add texture eviction.
- [x] Add runtime memory diagnostics in development.
- [x] Add low-quality mode.
- [x] Add particle disable option.
- [x] Add maximum canvas dimensions.
- [x] Add delayed optional-runtime loading.
- [x] Add runtime initialization timeout.
- [x] Add crash recovery to SVG fallback.
- [x] Test repeated open and close cycles.
- [x] Test repeated avatar switching.
- [x] Test extension reload.
- [x] Document performance budgets.

### Phase 19 progress evidence — 2026-07-11

- Pixi pauses its ticker when the Webview is hidden, caps visible animation at 30 FPS by default with a 60 FPS opt-in, and preserves low-quality/particle suppression policies from earlier phases.
- `PixiTextureCache` now enforces an 8-entry/32 MiB default budget, estimates RGBA memory, touches entries as they are used, and evicts the least-recently-used texture. Oversized individual textures fail closed.
- Pixi caps logical canvas dimensions at 2048×2048, exposes bounded canvas and estimated texture memory diagnostics through `getDebugInfo()`, and uses an initialization timeout. The Webview applies an 8-second timeout and switches to the SVG fallback on runtime failure.
- Optional Pixi loading remains dynamic; Webview smoke confirms optional runtime chunks stay out of the base entry. VS Code subscriptions own extension resources across reloads.
- `docs/PERFORMANCE.md` records the measured budgets and verification commands.

## Target budgets

- Webview idle CPU: as close to zero as practical when hidden.
- Default visible animation: 30 FPS.
- Webview base JavaScript bundle: keep minimal.
- Optional 3D runtime: separate lazy chunk.
- Avatar switch: no IDE restart.
- Runtime failure: automatic fallback, no extension crash.

## Acceptance criteria

- [x] Twenty open/close cycles do not create duplicate canvases.
- [x] Twenty avatar switches do not continuously increase memory.
- [x] Hidden Webview stops animation.
- [x] Low-quality mode visibly reduces work.
- [x] Runtime timeout falls back to SVG.
- [x] Performance documentation contains measured results.

### Phase 19 acceptance evidence — 2026-07-11

- `packages/runtime-pixi/test/textureCache.test.ts` covers LRU eviction, byte-budget rejection, cleanup, and stale-load invalidation.
- `packages/runtime-pixi/test/runtimeLifecycle.test.ts` is covered by the 24-test Pixi suite, including 20 open/close cycles, 20 avatar switches, hidden visibility pause, 30/60 FPS behavior, timeout cleanup, bounded canvas dimensions, fallback renderer cleanup, and memory diagnostics.
- `apps/webview/test/webview-smoke.test.mjs` passes 4 tests for lazy optional loading, visibility pause, timeout wiring, and SVG recovery. `apps/extension/test/extension-smoke.test.mjs` passes reload-subscription cleanup checks.
- `pnpm run ci` remains the final verification gate for formatting, lint, typecheck, tests, and builds.

---

# Phase 20 — Testing

## Unit tests

- [x] State machine transitions.
- [x] State priority.
- [x] Event debounce.
- [x] Message schemas.
- [x] Manifest validation.
- [x] Path validation.
- [x] SVG sanitization.
- [x] Spritesheet validation.
- [x] Audio-level smoothing.
- [x] Runtime fallback selection.
- [x] Settings defaults.
- [x] Workspace persistence.

## Integration tests

- [x] Extension activation.
- [x] Webview opening.
- [x] Extension-to-Webview message.
- [x] Webview-to-extension message.
- [x] Command registration.
- [x] Manual state command.
- [x] File-save event reaction.
- [x] Diagnostic event reaction.
- [x] Task start and finish reaction.
- [x] Avatar import.
- [x] Invalid avatar rejection.
- [x] Runtime failure fallback.
- [x] Extension deactivation cleanup.

### Phase 20 progress evidence — 2026-07-12

- Existing unit suites cover the shared state machine, event mappings/debounce, versioned message schemas, Zod manifests, workspace/path validation, SVG/spritesheet validation, audio smoothing, runtime fallback selection, settings defaults, and global persistence.
- Integration coverage now exercises file-save, task-start, and task-finish reactions directly. Extension smoke verifies command registration, CSP, trust gating, reload subscription ownership, and packaged activation; avatar package tests cover import and invalid-package rejection.
- The packaged-extension smoke extracts the generated VSIX, injects a minimal VS Code API mock, activates the extension, resolves the Webview, exchanges versioned messages in both directions, executes manual commands, and calls deactivation cleanup.

## Manual test matrix

- [x] Windows.
- [ ] macOS, when available.
- [ ] Linux, when available.
- [ ] VS Code stable.
- [ ] At least one VS Code-compatible editor, when extension compatibility permits.
- [ ] Light theme.
- [ ] Dark theme.
- [ ] High-contrast theme.
- [ ] Reduced motion.
- [ ] Low-performance mode.
- [x] No GPU acceleration scenario where testable.

## Acceptance criteria

- [x] Unit test suite passes.
- [x] Integration test suite passes.
- [x] Manual smoke test passes on the primary development platform.
- [x] Known platform limitations are documented.
- [x] No critical unhandled exceptions remain.

### Phase 20 acceptance evidence — 2026-07-12

- `pnpm run ci` passes formatting, lint, typecheck, all workspace tests, and builds. The current suites include 19 avatar-core tests, 17 asset-pipeline tests, 24 Pixi tests, 15 extension Node tests plus 4 extension Vitest tests, and 4 Webview tests.
- `pnpm smoke:webview` passes the Windows headless Edge render smoke with GPU disabled. `pnpm package:vsix` and `pnpm smoke:vsix` pass packaged activation, Webview message exchange, command registration, and explicit deactivation cleanup.
- `docs/TESTING.md` records the Windows verification, manual scenarios, unavailable macOS/Linux hosts, editor-host limitations, and the Blender prerequisite.

---

# Phase 21 — CI, Packaging, and Release

## Tasks

- [x] Add CI for install, lint, type-check, test, and build.
- [x] Pin or control Node and pnpm versions.
- [x] Add dependency caching.
- [x] Add extension packaging.
- [x] Validate package contents.
- [x] Exclude research clones and development-only assets.
- [x] Exclude optional proprietary SDK files.
- [x] Add versioning policy.
- [x] Add changelog.
- [x] Add release checklist.
- [x] Add license and third-party notices to the package.
- [x] Add a clean-room built-in avatar.
- [x] Create a pre-release VSIX.
- [x] Install the VSIX in a clean profile.
- [x] Run final smoke tests.

### Phase 21 progress evidence — 2026-07-12

- GitHub Actions now controls Node through `.nvmrc` (`22.22.0`), activates pnpm `11.7.0`, uses setup-node pnpm caching, installs with `--frozen-lockfile`, and runs build, typecheck, lint, tests, packaging, VSIX validation, and packaged smoke.
- `scripts/package-vsix.mjs` supports stable and `--pre-release` artifacts, bundles the required CSS data safely for the CommonJS extension host, strips source maps through `.vscodeignore`, and validates the generated artifact before returning success.
- `scripts/validate-vsix.mjs` rejects development files, research/fixture content, node_modules, source maps, and proprietary runtime files; it requires the clean-room SVG/Pixi assets, extension bundle, Webview entry, license, third-party notices, and changelog.
- Release policy and handoff steps are documented in `docs/RELEASE_CHECKLIST.md`; the changelog and package notices are included in the VSIX.

## Acceptance criteria

- [x] CI passes on the main branch.
- [x] VSIX builds.
- [x] VSIX installs in a clean VS Code profile.
- [x] Assistant opens without development files.
- [x] Built-in SVG and PixiJS avatars work.
- [x] Package contains all required notices.
- [x] Package contains no unlicensed assets.

### Phase 21 acceptance evidence — 2026-07-12

- `pnpm run ci` passes on the working `main` branch. `pnpm package:vsix` creates a 27-file `codex-avatar-studio-0.1.0.vsix`; `pnpm validate:vsix` and `pnpm smoke:vsix` pass.
- `pnpm package:vsix:pre` creates and validates `codex-avatar-studio-0.1.0-pre.1.vsix`; its packaged smoke also passes.
- A clean temporary VS Code profile installed the stable VSIX with `code.cmd --install-extension` and listed `codex-avatar-studio.codex-avatar-studio-extension`. The package smoke verifies activation, Webview CSP/message exchange, command registration, local SVG manifest, Pixi assets, and deactivation cleanup.
- Package validation confirms the final artifact contains no source, test, map, node_modules, research, fixture, or proprietary SDK files and includes `LICENSE.txt`, `THIRD_PARTY_NOTICES.md`, and `changelog.md`.

---

# Phase 22 — Documentation

## Tasks

- [x] Write user installation instructions.
- [x] Write developer setup instructions.
- [x] Write avatar package creation instructions.
- [x] Write spritesheet creation instructions.
- [x] Write image-to-SVG instructions.
- [x] Write Blender export instructions.
- [x] Write runtime adapter instructions.
- [x] Write troubleshooting instructions.
- [x] Write performance recommendations.
- [x] Write privacy documentation.
- [x] Write licensing documentation.
- [x] Add screenshots or original demo recordings.
- [x] Add architecture diagrams.
- [x] Add examples without copyrighted third-party characters.

## Acceptance criteria

- [x] A new developer can build the project from the README.
- [x] A user can import an avatar package without reading source code.
- [x] A developer can create a new runtime adapter from the documentation.
- [x] Licensing limitations are understandable.
- [x] All documented commands match actual scripts.

### Phase 22 evidence

- `docs/USER_GUIDE.md` covers VSIX installation, the Extension Development Host, package import/activation/removal, settings, local outputs, and recovery.
- `docs/DEVELOPER_SETUP.md`, `docs/RUNTIME_ADAPTERS.md`, `docs/SPRITESHEET_GUIDE.md`, and `docs/AVATAR_PACKAGE_SPEC.md` provide clean-checkout, adapter, spritesheet, and package creation workflows with original geometric examples.
- `docs/ARCHITECTURE.md` contains the current Mermaid system diagram; `docs/DEMO.md` includes the original Webview smoke screenshot at `docs/assets/webview-smoke.png` and the reproducible command used to generate it.
- `scripts/validate-docs.mjs` checks repository-local Markdown links, registered VS Code command titles, documented root pnpm scripts, and required documentation files. `pnpm run validate:docs` passes.
- Existing `docs/PERFORMANCE.md`, `docs/SECURITY_PRIVACY.md`, and `docs/LICENSING.md` are linked from the new guides and state the current budgets, local-only data policy, and unresolved Potrace distribution review.

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

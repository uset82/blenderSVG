# Codex Avatar Studio — Full Codex-Ready Implementation Plan

## Project summary

Build a VS Code/Codex-compatible animated assistant that lives inside the IDE. The assistant supports:

- SVG/static mascot fallback.
- Rive/WebGL2 vector animation as the main MVP runtime.
- Image → SVG conversion tools.
- Blender → SVG/GLB export tools.
- VTuber-lite expression states: idle, listening, thinking, speaking, coding, reviewing, error, success, sleep.
- Optional Live2D adapter for richer 2D face/VTuber behavior.
- Optional Three.js WebGL/WebGPU 3D hero/avatar mode.

The goal is to create an original coding companion inspired by the feeling of animated AI companions like Ani/Rudi, but not copying their character design, behavior, identity, or relationship mechanics. This assistant must stay productivity-focused, safe, professional, and useful inside the IDE.

---

# 0. Instructions for Codex

Codex must implement this project phase-by-phase.

Rules:

- Work in small, reviewable commits or patches.
- Do not skip phases unless the user explicitly instructs you to.
- After each task is finished, mark its checkbox from `[ ]` to `[x]` in `docs/PLAN_CHECKLIST.md`.
- After each phase is finished, add a short implementation note under that phase.
- Do not mark a phase complete unless all acceptance criteria pass.
- Do not create final production artwork. Create placeholder assets and asset slots.
- Do not depend on private APIs from the Codex IDE extension unless officially available.
- The assistant must work even without Rive, Live2D, Blender, or WebGPU assets installed.
- The extension must not make external network calls.
- All user-generated assets must remain local unless the user explicitly exports/shares them.

Primary engineering principle:

```txt
Do not force everything through one SVG.
Use separate runtime adapters:
- SVG fallback for simple/static display.
- Rive for animated 2D vector MVP.
- Blender/GLB + Three.js for 3D/WebGL/WebGPU mode.
- Live2D for advanced VTuber-lite face rigging later.
```

---

# 1. Recommended architecture

## 1.1 Runtime strategy

```txt
MVP runtime:          SVG fallback + Rive WebGL2
Animation logic:      Typed assistant state machine
IDE shell:            VS Code Extension API + Webview
Webview app:          React + Vite + TypeScript
Asset processing:     Node scripts + optional Blender Python sidecar
Image to SVG:         Potrace plus conservative local optimization, with manual layer cleanup for production rigs
Blender to SVG/GLB:   Blender Python scripts
Live2D:               Optional adapter after MVP
WebGPU:               Optional progressive enhancement, never required
```

## 1.2 High-level system diagram

```txt
codex-avatar-studio
│
├── VS Code Extension Host
│   ├── commands
│   ├── settings
│   ├── webview provider
│   ├── IDE event listeners
│   ├── asset pipeline runner
│   └── local file access
│
├── Webview Avatar UI
│   ├── React/Vite UI
│   ├── avatar runtime adapters
│   ├── state machine bridge
│   ├── speech bubble
│   ├── settings panel
│   └── SVG/Rive/Live2D/WebGL renderers
│
├── Avatar Core Package
│   ├── types
│   ├── state mapping
│   ├── runtime interface
│   ├── event bridge
│   └── manifest loader
│
├── Asset Pipeline
│   ├── image-to-svg
│   ├── svg cleanup
│   ├── blender-to-svg
│   ├── blender-to-glb
│   ├── validation
│   └── manifest generation
│
└── Local Avatar Workspace
    ├── .codex-avatar/assets
    ├── .codex-avatar/exports
    ├── .codex-avatar/manifests
    └── .codex-avatar/cache
```

---

# 2. Final repo structure to create

Codex should create this structure unless the existing repo requires a different package layout.

```txt
codex-avatar-studio/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── docs/
│   ├── PLAN_CHECKLIST.md
│   ├── ARCHITECTURE.md
│   ├── ASSET_PIPELINE.md
│   ├── BLENDER_PIPELINE.md
│   ├── LIVE2D_PIPELINE.md
│   ├── WEBGPU_NOTES.md
│   └── PRIVACY_AND_SAFETY.md
│
├── apps/
│   ├── extension/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── AvatarWebviewProvider.ts
│   │   │   ├── commands.ts
│   │   │   ├── settings.ts
│   │   │   ├── ideEvents.ts
│   │   │   ├── assetPipeline.ts
│   │   │   ├── blenderRunner.ts
│   │   │   └── workspaceStorage.ts
│   │   ├── media/
│   │   │   ├── webview/
│   │   │   └── avatars/
│   │   │       ├── svg/
│   │   │       │   └── placeholder-avatar.svg
│   │   │       ├── rive/
│   │   │       ├── live2d/
│   │   │       └── glb/
│   │   └── test/
│   │       └── extension.test.ts
│   │
│   └── webview/
│       ├── package.json
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles.css
│           ├── bridge/
│           │   ├── vscodeApi.ts
│           │   ├── messages.ts
│           │   └── useExtensionBridge.ts
│           ├── components/
│           │   ├── AvatarPanel.tsx
│           │   ├── AvatarStage.tsx
│           │   ├── AssistantBubble.tsx
│           │   ├── SettingsPanel.tsx
│           │   └── StatusDebugPanel.tsx
│           └── renderers/
│               ├── SvgAvatarRenderer.tsx
│               ├── RiveAvatarRenderer.tsx
│               ├── Live2DAvatarRenderer.tsx
│               ├── WebGLAvatarRenderer.tsx
│               └── RuntimeBoundary.tsx
│
├── packages/
│   ├── avatar-core/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── states.ts
│   │   │   ├── events.ts
│   │   │   ├── runtime.ts
│   │   │   ├── manifest.ts
│   │   │   ├── reducedMotion.ts
│   │   │   └── gpuSupport.ts
│   │   └── test/
│   │       ├── states.test.ts
│   │       └── manifest.test.ts
│   │
│   └── asset-pipeline/
│       ├── package.json
│       ├── src/
│       │   ├── imageToSvg.ts
│       │   ├── optimizeSvg.ts
│       │   ├── validateSvgLayers.ts
│       │   ├── manifestGenerator.ts
│       │   ├── paths.ts
│       │   └── cli.ts
│       └── test/
│           └── assetPipeline.test.ts
│
├── scripts/
│   ├── blender/
│   │   ├── export_svg.py
│   │   ├── export_glb.py
│   │   └── render_turntable.py
│   └── dev/
│       ├── copy-webview-build.mjs
│       └── validate-extension-assets.mjs
│
└── examples/
    ├── avatars/
    │   ├── placeholder-avatar.svg
    │   └── avatar.manifest.json
    └── blender/
        └── README.md
```

---

# 3. Core TypeScript model

Codex should create these types in `packages/avatar-core/src/types.ts`.

```ts
export type AvatarRuntime = "svg" | "rive" | "live2d" | "webgl" | "webgpu";

export type AvatarCharacter =
  | "default"
  | "coder-orb"
  | "hologram-pet"
  | "live2d-assistant"
  | "custom";

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

export type AvatarTrigger =
  | "blink"
  | "wave"
  | "nod"
  | "shakeHead"
  | "celebrate"
  | "confused"
  | "point"
  | "sleep"
  | "wake"
  | "pulse";

export type IdeAssistantEvent =
  | "extension_ready"
  | "active_editor_changed"
  | "file_saved"
  | "diagnostics_changed"
  | "terminal_started"
  | "terminal_finished"
  | "task_started"
  | "task_finished"
  | "debug_started"
  | "debug_stopped"
  | "codex_task_started"
  | "codex_task_thinking"
  | "codex_task_streaming"
  | "codex_task_finished"
  | "codex_task_failed"
  | "user_message_started"
  | "user_message_sent"
  | "assistant_message_started"
  | "assistant_message_streaming"
  | "assistant_message_finished";

export type AvatarMood =
  | "neutral"
  | "focused"
  | "curious"
  | "happy"
  | "concerned"
  | "confused"
  | "sleepy";

export type AvatarMessage = {
  id: string;
  text: string;
  tone?: AvatarMood;
  createdAt: number;
  ttlMs?: number;
};

export type AvatarPoseInput = {
  cursorX?: number;
  cursorY?: number;
  mouthOpen?: number;
  scrollProgress?: number;
  audioLevel?: number;
};

export type AvatarConfig = {
  enabled: boolean;
  runtime: AvatarRuntime;
  character: AvatarCharacter;
  reducedMotion: boolean;
  showSpeechBubble: boolean;
  intensity: "low" | "medium" | "high";
  position: "bottom-right" | "bottom-left" | "side-panel" | "activity-bar-view";
};
```

Create runtime interface in `packages/avatar-core/src/runtime.ts`:

```ts
import type { AvatarPoseInput, AvatarState, AvatarTrigger } from "./types";

export type AvatarRuntimeAdapter = {
  id: string;
  mount: (element: HTMLElement) => Promise<void> | void;
  unmount: () => Promise<void> | void;
  setState: (state: AvatarState) => void;
  trigger: (trigger: AvatarTrigger) => void;
  setPoseInput: (input: AvatarPoseInput) => void;
  setMessage?: (text: string | null) => void;
};
```

Create event mapping in `packages/avatar-core/src/events.ts`:

```ts
import type { AvatarState, AvatarTrigger, IdeAssistantEvent } from "./types";

export const eventToAvatarState: Record<IdeAssistantEvent, AvatarState> = {
  extension_ready: "welcome",
  active_editor_changed: "idle",
  file_saved: "success",
  diagnostics_changed: "reviewing",
  terminal_started: "building",
  terminal_finished: "idle",
  task_started: "thinking",
  task_finished: "success",
  debug_started: "debugging",
  debug_stopped: "idle",
  codex_task_started: "thinking",
  codex_task_thinking: "thinking",
  codex_task_streaming: "speaking",
  codex_task_finished: "success",
  codex_task_failed: "error",
  user_message_started: "listening",
  user_message_sent: "thinking",
  assistant_message_started: "speaking",
  assistant_message_streaming: "speaking",
  assistant_message_finished: "idle",
};

export const eventToAvatarTrigger: Partial<Record<IdeAssistantEvent, AvatarTrigger>> = {
  extension_ready: "wave",
  file_saved: "nod",
  task_finished: "celebrate",
  codex_task_finished: "celebrate",
  codex_task_failed: "confused",
};
```

---

# 4. Avatar manifest format

Create `examples/avatars/avatar.manifest.json` and support user manifests in `.codex-avatar/manifests/`.

```json
{
  "version": "0.1.0",
  "id": "default-coder-orb",
  "name": "Default Coder Orb",
  "runtimePriority": ["rive", "svg", "webgl", "live2d"],
  "assets": {
    "svg": "avatars/svg/placeholder-avatar.svg",
    "rive": "avatars/rive/default-coder-orb.riv",
    "glb": "avatars/glb/default-coder-orb.glb",
    "live2d": "avatars/live2d/default/model.model3.json"
  },
  "rive": {
    "stateMachine": "CodexAssistant",
    "inputs": {
      "state": "state",
      "cursorX": "cursorX",
      "cursorY": "cursorY",
      "mouthOpen": "mouthOpen",
      "scrollProgress": "scrollProgress",
      "wave": "wave",
      "celebrate": "celebrate",
      "confused": "confused"
    }
  },
  "states": [
    "idle",
    "welcome",
    "listening",
    "thinking",
    "speaking",
    "coding",
    "reviewing",
    "debugging",
    "building",
    "success",
    "warning",
    "error",
    "sleeping"
  ]
}
```

---

# 5. Full implementation phases

## Phase 0 — Repository preparation and plan file

Goal: prepare the repo so Codex can safely implement the project.

- [ ] Create `docs/PLAN_CHECKLIST.md` and paste this plan into it.
- [ ] Detect current package manager: `pnpm`, `npm`, `yarn`, or `bun`.
- [ ] Detect current app structure: existing VS Code extension, web app, monorepo, or empty repo.
- [ ] If repo is empty, initialize the monorepo structure shown above.
- [ ] If repo already exists, adapt paths without destroying existing source.
- [ ] Add `.gitignore` entries for generated local avatar assets:
  - [ ] `.codex-avatar/cache/`
  - [ ] `.codex-avatar/exports/`
  - [ ] `*.blend1`
  - [ ] large generated videos/renders.
- [ ] Add `README.md` with project summary.
- [ ] Add `docs/ARCHITECTURE.md` with system overview.
- [ ] Add `docs/PRIVACY_AND_SAFETY.md` explaining that all asset processing is local.

Acceptance criteria:

- [ ] Project installs dependencies successfully.
- [ ] `docs/PLAN_CHECKLIST.md` exists.
- [ ] Existing user code is not removed.
- [ ] README explains the purpose of Codex Avatar Studio.

---

## Phase 1 — VS Code/Codex IDE extension shell

Goal: create a VS Code-compatible extension that can host the assistant UI in a Webview.

Tasks:

- [ ] Create `apps/extension/package.json`.
- [ ] Add extension contribution points:
  - [ ] Activity bar view: `codexAvatar.assistantView`.
  - [ ] Command: `Codex Avatar: Open Assistant`.
  - [ ] Command: `Codex Avatar: Toggle Assistant`.
  - [ ] Command: `Codex Avatar: Set State`.
  - [ ] Command: `Codex Avatar: Vectorize Image to SVG`.
  - [ ] Command: `Codex Avatar: Export Blender Scene`.
  - [ ] Command: `Codex Avatar: Open Settings`.
- [ ] Implement `src/extension.ts` with activation/deactivation.
- [ ] Implement `src/AvatarWebviewProvider.ts`.
- [ ] Use `webview.asWebviewUri()` for all local webview assets.
- [ ] Add strict Content Security Policy for webview.
- [ ] Add message passing from extension host to webview.
- [ ] Add message passing from webview back to extension host.
- [ ] Add placeholder HTML that shows “Codex Avatar Studio loaded”.
- [ ] Ensure extension activates without a workspace folder.

Minimum extension settings:

```json
{
  "codexAvatar.enabled": true,
  "codexAvatar.runtime": "svg",
  "codexAvatar.position": "activity-bar-view",
  "codexAvatar.character": "default",
  "codexAvatar.animationIntensity": "medium",
  "codexAvatar.respectReducedMotion": true,
  "codexAvatar.blenderPath": "",
  "codexAvatar.assetWorkspace": ".codex-avatar"
}
```

Acceptance criteria:

- [ ] Extension compiles.
- [ ] Extension launches in Extension Development Host.
- [ ] Assistant view appears in VS Code/Cursor/Windsurf-compatible environment.
- [ ] No webview security errors appear in the developer console.
- [ ] The extension can send a test message to the webview.
- [ ] The webview can send a test message to the extension.

---

## Phase 2 — Webview React/Vite UI foundation

Goal: create the UI app rendered inside the extension Webview.

Tasks:

- [ ] Create `apps/webview` with Vite + React + TypeScript.
- [ ] Add build script that outputs to `apps/extension/media/webview`.
- [ ] Create `App.tsx`.
- [ ] Create `AvatarPanel.tsx`.
- [ ] Create `AvatarStage.tsx`.
- [ ] Create `AssistantBubble.tsx`.
- [ ] Create `SettingsPanel.tsx`.
- [ ] Create `StatusDebugPanel.tsx` for development only.
- [ ] Implement `bridge/vscodeApi.ts` using `acquireVsCodeApi()` safely.
- [ ] Implement `bridge/messages.ts` with typed message contracts.
- [ ] Implement `bridge/useExtensionBridge.ts`.
- [ ] Add CSS variables that respect VS Code theme colors.
- [ ] Add responsive layout for side panel and floating mode.
- [ ] Add `prefers-reduced-motion` CSS fallback.

Message contract:

```ts
export type ExtensionToWebviewMessage =
  | { type: "avatar:setState"; state: AvatarState }
  | { type: "avatar:trigger"; trigger: AvatarTrigger }
  | { type: "avatar:setMessage"; text: string | null }
  | { type: "avatar:setPoseInput"; input: AvatarPoseInput }
  | { type: "settings:update"; config: Partial<AvatarConfig> }
  | { type: "assets:manifestLoaded"; manifest: AvatarManifest }
  | { type: "debug:event"; event: string; payload?: unknown };

export type WebviewToExtensionMessage =
  | { type: "webview:ready" }
  | { type: "command:toggleAssistant" }
  | { type: "command:vectorizeImage" }
  | { type: "command:exportBlender" }
  | { type: "settings:update"; config: Partial<AvatarConfig> }
  | { type: "debug:log"; message: string; payload?: unknown };
```

Acceptance criteria:

- [ ] Webview build is copied into extension media.
- [ ] Webview renders in extension.
- [ ] Webview uses VS Code theme colors.
- [ ] `webview:ready` message is received by extension host.
- [ ] Extension can update the UI state by sending messages.
- [ ] No external network calls are made by the webview.

---

## Phase 3 — Avatar core package

Goal: create the reusable state and runtime logic.

Tasks:

- [ ] Create `packages/avatar-core`.
- [ ] Add `types.ts` from this plan.
- [ ] Add `events.ts` from this plan.
- [ ] Add `states.ts` with numeric state mapping for Rive/Live2D.
- [ ] Add `runtime.ts` with runtime adapter interface.
- [ ] Add `manifest.ts` with manifest validation.
- [ ] Add `reducedMotion.ts` utility.
- [ ] Add `gpuSupport.ts` utility:
  - [ ] `supportsWebGL2()`.
  - [ ] `supportsWebGPU()`.
  - [ ] `getPreferredGpuRuntime()`.
- [ ] Add unit tests for event-to-state mapping.
- [ ] Add unit tests for manifest parsing.

Acceptance criteria:

- [ ] Package builds independently.
- [ ] Types are exported from one index file.
- [ ] Event mapping test passes.
- [ ] Manifest validation rejects missing asset IDs.
- [ ] No browser-only code runs during Node tests unless guarded.

---

## Phase 4 — SVG fallback renderer

Goal: ensure the assistant always works even with no Rive/Live2D/GLB assets.

Tasks:

- [ ] Create `SvgAvatarRenderer.tsx`.
- [ ] Add placeholder SVG asset at `apps/extension/media/avatars/svg/placeholder-avatar.svg`.
- [ ] Render SVG fallback inside `AvatarStage`.
- [ ] Support visual changes via `data-avatar-state` attributes.
- [ ] Add CSS animations for:
  - [ ] idle breathing.
  - [ ] blinking.
  - [ ] thinking pulse.
  - [ ] speaking mouth pulse.
  - [ ] success glow.
  - [ ] error shake.
  - [ ] sleeping dim.
- [ ] Disable continuous animation when `prefers-reduced-motion: reduce` is active.
- [ ] Add fallback speech bubble.
- [ ] Make avatar decorative by default with `aria-hidden="true"`.
- [ ] Allow accessible label when assistant messages are enabled.

Acceptance criteria:

- [ ] Assistant appears with only SVG runtime enabled.
- [ ] State changes are visible in fallback mode.
- [ ] Reduced motion disables breathing/blinking loops.
- [ ] Avatar does not block editor clicks when in floating mode.
- [ ] Placeholder asset is lightweight and local.

---

## Phase 5 — IDE event integration

Goal: make the avatar react to real coding activity.

Tasks:

- [ ] Implement `src/ideEvents.ts` in extension.
- [ ] Listen to active editor changes.
- [ ] Listen to file save events.
- [ ] Listen to diagnostics changes.
- [ ] Listen to debug session start/stop.
- [ ] Listen to VS Code task start/end where available.
- [ ] Add manual commands to simulate Codex-like states:
  - [ ] `Codex Avatar: Start Thinking`.
  - [ ] `Codex Avatar: Start Speaking`.
  - [ ] `Codex Avatar: Mark Success`.
  - [ ] `Codex Avatar: Mark Error`.
- [ ] Add debouncing so diagnostics do not spam animations.
- [ ] Add idle timer after success/error states.
- [ ] Add status debug view for current state.
- [ ] Do not assume access to private state from another extension.

Important limitation:

```txt
The extension may not be able to read private internal state from the official Codex extension.
Use generic IDE events and explicit user commands first.
If official Codex extension events/API become available, add a separate adapter later.
```

Acceptance criteria:

- [ ] Saving a file triggers success/nod.
- [ ] Diagnostics changes trigger reviewing/warning/error based on severity.
- [ ] Debug start triggers debugging.
- [ ] Debug stop returns to idle.
- [ ] Manual commands update avatar state.
- [ ] Event handling remains stable when no workspace is open.

---

## Phase 6 — Rive runtime adapter

Goal: support animated vector avatars with Rive.

Tasks:

- [ ] Add dependency: `@rive-app/react-webgl2`.
- [ ] Create `RiveAvatarRenderer.tsx`.
- [ ] Load `.riv` file from manifest.
- [ ] If `.riv` is missing or fails, fall back to SVG renderer.
- [ ] Use Rive state machine name from manifest.
- [ ] Map `AvatarState` to numeric Rive input.
- [ ] Map `AvatarTrigger` to Rive trigger inputs.
- [ ] Map pose input to Rive inputs:
  - [ ] `cursorX`.
  - [ ] `cursorY`.
  - [ ] `mouthOpen`.
  - [ ] `scrollProgress`.
- [ ] Add `RuntimeBoundary.tsx` so runtime crashes do not break the whole webview.
- [ ] Add development message if Rive file is missing.

Expected Rive state machine:

```txt
State machine name: CodexAssistant

Inputs:
- state: number
- cursorX: number
- cursorY: number
- mouthOpen: number
- scrollProgress: number
- isSpeaking: boolean
- isThinking: boolean
- wave: trigger
- celebrate: trigger
- confused: trigger
- point: trigger
```

State mapping:

```ts
export const RIVE_STATE_NUMBERS = {
  idle: 0,
  welcome: 1,
  listening: 2,
  thinking: 3,
  speaking: 4,
  coding: 5,
  reviewing: 6,
  debugging: 7,
  building: 8,
  success: 9,
  warning: 10,
  error: 11,
  sleeping: 12,
} as const;
```

Rive animations to create later:

```txt
idle_loop
blink_random
breath_loop
look_cursor
welcome_wave
listen_idle
think_loop
speak_mouth_loop
coding_focus_loop
reviewing_scan_loop
debugging_loop
building_loop
success_celebrate
warning_attention
error_confused
sleep_loop
```

Acceptance criteria:

- [ ] Webview works with Rive runtime installed.
- [ ] Missing `.riv` file does not crash assistant.
- [ ] State changes are sent to Rive input.
- [ ] Triggers fire correctly.
- [ ] SVG fallback still works.
- [ ] Rive runtime is only loaded when selected/enabled.

---

## Phase 7 — Image → SVG asset pipeline

Goal: allow the user to convert selected images into SVG assets from the IDE.

Tasks:

- [ ] Create `packages/asset-pipeline`.
- [ ] Implement `imageToSvg.ts`.
- [ ] Implement `optimizeSvg.ts` using a conservative local optimizer.
- [ ] Implement `validateSvgLayers.ts`.
- [ ] Implement `manifestGenerator.ts`.
- [ ] Add extension command: `Codex Avatar: Vectorize Image to SVG`.
- [ ] Let user select PNG/JPG/WebP from workspace.
- [ ] Export results to `.codex-avatar/exports/svg/`.
- [ ] Create output naming convention:
  - [ ] `<original-name>.raw-trace.svg`.
  - [ ] `<original-name>.optimized.svg`.
  - [ ] `<original-name>.manifest.json`.
- [ ] Add warning that full-image auto-trace is not production-ready for rigged characters.
- [ ] Add command to open exported SVG in editor.
- [ ] Add command to copy exported SVG path.

Pipeline design:

```txt
Input image
  -> validate file type
  -> optional grayscale/threshold preprocessing
  -> bitmap tracing
  -> SVG cleanup with local optimizer
  -> layer/group validation
  -> write output files
  -> generate manifest entry
```

Production guidance to write into `docs/ASSET_PIPELINE.md`:

```txt
Do not use a full poster/image trace as the final animated avatar.
Use image tracing for icons, emblems, silhouettes, and reference shapes.
For animated characters, redraw as clean layered SVG with separate moving parts.
```

Acceptance criteria:

- [ ] Command appears in VS Code command palette.
- [ ] User can select an image.
- [ ] SVG output is created locally.
- [ ] Local SVG optimization runs.
- [ ] Generated SVG can be previewed.
- [ ] Pipeline errors are shown as friendly messages.
- [ ] No external services are used.

---

## Phase 8 — SVG layer standard for rigging

Goal: define a strict layer naming system for future Rive/Live2D rigging.

Tasks:

- [ ] Add `docs/ASSET_PIPELINE.md` layer standard.
- [ ] Add `validateSvgLayers.ts` rules.
- [ ] Validate required groups for humanoid assistant.
- [ ] Validate required groups for pet/orb assistant.
- [ ] Add warnings for unnamed groups.
- [ ] Add warnings for too many tiny paths.
- [ ] Add warnings for very large SVG files.
- [ ] Add `scripts/dev/validate-extension-assets.mjs`.

Humanoid/VTuber-lite layer standard:

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

Orb/pet assistant layer standard:

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

Acceptance criteria:

- [ ] Validator accepts a correct sample SVG.
- [ ] Validator warns on missing moving parts.
- [ ] Validator reports SVG size.
- [ ] Documentation tells designers how to prepare assets.

---

## Phase 9 — Blender → SVG and Blender → GLB pipeline

Goal: allow Blender scenes to become either vector line-art SVG or WebGL-ready GLB assets.

Tasks:

- [ ] Add `scripts/blender/export_svg.py`.
- [ ] Add `scripts/blender/export_glb.py`.
- [ ] Add `scripts/blender/render_turntable.py`.
- [ ] Add extension setting `codexAvatar.blenderPath`.
- [ ] Add Blender path auto-detection for common locations.
- [ ] Add extension command: `Codex Avatar: Export Blender Scene`.
- [ ] User selects `.blend` file.
- [ ] User chooses export target:
  - [ ] SVG line-art.
  - [ ] GLB WebGL asset.
  - [ ] PNG preview.
- [ ] Extension runs Blender in background with `child_process.spawn`.
- [ ] Show progress/status in VS Code output channel.
- [ ] Export to `.codex-avatar/exports/blender/`.
- [ ] Add timeout and cancellation support.
- [ ] Add friendly error if Blender is not installed.

Blender SVG export mode:

```txt
.blend scene
  -> set camera
  -> use Grease Pencil / line-art export strategy
  -> export SVG
  -> optimize with local optimizer
  -> save manifest
```

Blender GLB export mode:

```txt
.blend scene
  -> validate scene scale
  -> pack or reference textures
  -> export GLB
  -> create preview screenshot
  -> save manifest
```

`docs/BLENDER_PIPELINE.md` must explain:

```txt
Use Blender for 2.5D/3D hero scenes and GLB avatars.
Use SVG export for line-art, icons, and stylized outlines.
Do not rely on Blender SVG export as the only method for Live2D/Rive character rigging.
For animation-ready 2D characters, clean layer design is more important than automatic tracing.
```

Acceptance criteria:

- [ ] Command detects missing Blender and shows setup instructions.
- [ ] Blender runner can spawn a test `--version` command.
- [ ] `.blend` selection works.
- [ ] SVG export path is created or meaningful error is shown.
- [ ] GLB export path is created or meaningful error is shown.
- [ ] Output files are local and manifest entries are created.

---

## Phase 10 — VTuber-lite behavior layer

Goal: make the assistant feel alive without requiring full Live2D face tracking.

Tasks:

- [ ] Add `AssistantBubble.tsx`.
- [ ] Add contextual messages for events.
- [ ] Add idle timer.
- [ ] Add typing/speaking simulation.
- [ ] Add text-stream mouth estimation.
- [ ] Add cursor tracking inside webview.
- [ ] Add focus mode that reduces animation intensity.
- [ ] Add sleep mode after inactivity.
- [ ] Add wake trigger on user interaction.
- [ ] Add state transition smoothing.
- [ ] Add user setting to mute/hide messages.

Text-based mouth estimator:

```ts
export function estimateMouthOpenFromText(textChunk: string): number {
  const vowels = textChunk.match(/[aeiouáéíóúäöüAEIOUÁÉÍÓÚÄÖÜ]/g)?.length ?? 0;
  const punctuation = textChunk.match(/[.!?]/g)?.length ?? 0;
  const raw = Math.min(1, vowels / 8);
  return punctuation > 0 ? Math.max(0.15, raw * 0.5) : raw;
}
```

Suggested messages:

```ts
export const avatarMessages = {
  welcome: "Ready to build.",
  thinking: "Analyzing the code…",
  speaking: "I found a possible path.",
  reviewing: "Checking diagnostics.",
  debugging: "Following the error trail.",
  building: "Running the task.",
  success: "Clean move. That worked.",
  warning: "Something needs attention.",
  error: "There is a break point in the flow.",
  sleeping: "I’ll stay quiet until needed."
} as const;
```

Acceptance criteria:

- [ ] Avatar enters sleep after configured inactivity period.
- [ ] Avatar wakes on command/user interaction.
- [ ] Speaking state animates mouth input without audio.
- [ ] User can disable speech bubbles.
- [ ] Reduced-motion mode still shows state changes without continuous animation.

---

## Phase 11 — WebGL / WebGPU 3D mode

Goal: support a future 3D assistant or Blender GLB hero scene.

Tasks:

- [ ] Add optional dependencies behind feature flag:
  - [ ] `three`.
  - [ ] `@types/three`.
  - [ ] optional React Three Fiber only if needed by webview architecture.
- [ ] Create `WebGLAvatarRenderer.tsx`.
- [ ] Load GLB asset from manifest.
- [ ] Add WebGL2 support detection.
- [ ] Add WebGPU support detection.
- [ ] Default to WebGL-compatible rendering.
- [ ] Use WebGPU only if available and enabled.
- [ ] Add static SVG fallback for unsupported devices.
- [ ] Add basic 3D placeholder scene:
  - [ ] orthographic camera.
  - [ ] simple floating orb.
  - [ ] idle rotation.
  - [ ] success pulse.
  - [ ] error shake.
- [ ] Do not block main IDE thread.
- [ ] Pause animation when webview hidden.

Acceptance criteria:

- [ ] WebGL renderer loads only when selected.
- [ ] Unsupported WebGL/WebGPU falls back to SVG.
- [ ] No crash if GLB asset is missing.
- [ ] 3D placeholder responds to at least idle/thinking/success/error.
- [ ] Performance remains acceptable inside VS Code webview.

---

## Phase 12 — Live2D adapter

Goal: prepare optional advanced VTuber-lite mode using Live2D Cubism assets.

Tasks:

- [ ] Add `docs/LIVE2D_PIPELINE.md`.
- [ ] Create `Live2DAvatarRenderer.tsx` placeholder.
- [ ] Define expected Live2D folder structure:

```txt
avatars/live2d/<avatar-id>/
├── model.model3.json
├── model.moc3
├── textures/
├── motions/
├── expressions/
└── physics3.json
```

- [ ] Add manifest fields for Live2D model path.
- [ ] Add runtime adapter interface for Live2D.
- [ ] Map avatar states to Live2D expressions/motions.
- [ ] Map pose input to Live2D parameters:
  - [ ] `ParamAngleX`.
  - [ ] `ParamAngleY`.
  - [ ] `ParamAngleZ`.
  - [ ] `ParamEyeLOpen`.
  - [ ] `ParamEyeROpen`.
  - [ ] `ParamEyeBallX`.
  - [ ] `ParamEyeBallY`.
  - [ ] `ParamMouthOpenY`.
  - [ ] `ParamMouthForm`.
  - [ ] `ParamBodyAngleX`.
  - [ ] `ParamBreath`.
- [ ] If SDK is not installed/configured, renderer must show “Live2D runtime unavailable” and fall back.
- [ ] Keep Live2D optional.

Acceptance criteria:

- [ ] App compiles without Live2D assets.
- [ ] Live2D mode can be selected but gracefully falls back if runtime/assets missing.
- [ ] Documentation explains how to prepare PSD/Cubism assets.
- [ ] Manifest supports `model.model3.json` path.

---

## Phase 13 — Settings, preferences, and persistence

Goal: allow the user to control the assistant.

Tasks:

- [ ] Add settings UI in webview.
- [ ] Add extension configuration bindings.
- [ ] Persist selected runtime.
- [ ] Persist selected avatar.
- [ ] Persist position.
- [ ] Persist animation intensity.
- [ ] Persist reduced-motion preference.
- [ ] Persist speech bubble preference.
- [ ] Add reset-to-default command.
- [ ] Add export settings command.
- [ ] Add import settings command.

Settings UI options:

```txt
Enabled: true/false
Runtime: SVG / Rive / WebGL / WebGPU / Live2D
Character: Default / Custom
Position: Activity Bar / Bottom Right / Bottom Left / Side Panel
Animation intensity: Low / Medium / High
Speech bubble: On / Off
Reduced motion: System / Always / Never
Blender path: file path
Asset workspace: .codex-avatar
```

Acceptance criteria:

- [ ] Settings changes update avatar without restart when possible.
- [ ] Settings persist after VS Code reload.
- [ ] Invalid runtime setting falls back to SVG.
- [ ] Reset command works.

---

## Phase 14 — Asset manager UI

Goal: let user manage custom avatar files.

Tasks:

- [ ] Add `Avatar Asset Manager` section in webview.
- [ ] Show loaded manifest.
- [ ] Show current runtime and asset path.
- [ ] Show missing assets warnings.
- [ ] Add button: “Open Avatar Assets Folder”.
- [ ] Add button: “Validate Avatar Manifest”.
- [ ] Add button: “Vectorize Image”.
- [ ] Add button: “Export Blender Scene”.
- [ ] Add button: “Reload Avatar”.
- [ ] Add manifest generation from selected assets.

Acceptance criteria:

- [ ] User can open local assets folder.
- [ ] User can validate manifest.
- [ ] Missing files are listed clearly.
- [ ] Reloading avatar does not require full extension restart.

---

## Phase 15 — Testing and quality gates

Goal: make the project stable enough to build on.

Tasks:

- [ ] Add root scripts:
  - [ ] `typecheck`.
  - [ ] `lint`.
  - [ ] `test`.
  - [ ] `build`.
  - [ ] `dev:extension`.
  - [ ] `build:webview`.
- [ ] Add TypeScript strict mode.
- [ ] Add tests for avatar-core.
- [ ] Add tests for event mapping.
- [ ] Add tests for manifest validation.
- [ ] Add tests for asset pipeline where possible.
- [ ] Add webview smoke test.
- [ ] Add extension activation test.
- [ ] Add manual QA checklist.
- [ ] Add CI workflow if repository uses GitHub.

Manual QA checklist:

```txt
[ ] Extension launches.
[ ] Avatar panel opens.
[ ] SVG fallback visible.
[ ] State command changes avatar.
[ ] Missing Rive asset does not crash.
[ ] Image to SVG command creates output.
[ ] Blender command handles missing Blender gracefully.
[ ] Reduced motion works.
[ ] No external requests are made.
[ ] Theme colors work in light/dark mode.
[ ] Webview reload does not lose settings.
```

Acceptance criteria:

- [ ] `typecheck` passes.
- [ ] `lint` passes.
- [ ] `test` passes.
- [ ] `build` passes.
- [ ] Extension starts in development host.

---

## Phase 16 — Performance and safety hardening

Goal: avoid distracting or heavy behavior inside the IDE.

Tasks:

- [ ] Lazy-load Rive renderer.
- [ ] Lazy-load WebGL renderer.
- [ ] Lazy-load Live2D renderer.
- [ ] Keep SVG fallback always available.
- [ ] Pause animation when webview loses visibility.
- [ ] Throttle cursor tracking.
- [ ] Debounce diagnostics events.
- [ ] Limit speech bubble frequency.
- [ ] Add “focus mode” where avatar is mostly still.
- [ ] Prevent pointer blocking over editor.
- [ ] Add content security policy.
- [ ] Confirm no network calls.
- [ ] Sanitize file paths shown in UI.
- [ ] Add file size warnings:
  - [ ] SVG over 100 KB.
  - [ ] Rive over 1 MB.
  - [ ] GLB over 5 MB.
  - [ ] texture over 2 MB.

Acceptance criteria:

- [ ] Avatar does not noticeably slow the editor.
- [ ] Hidden webview pauses animation.
- [ ] Focus mode reduces motion.
- [ ] No unsafe scripts are allowed in webview.
- [ ] Large assets show warnings.

---

## Phase 17 — Packaging and release

Goal: package the extension for local install and future marketplace release.

Tasks:

- [ ] Add extension icon placeholder.
- [ ] Add extension display name.
- [ ] Add marketplace-safe description.
- [ ] Add license file.
- [ ] Add changelog.
- [ ] Add `vsce` packaging script if appropriate.
- [ ] Add `README` usage instructions.
- [ ] Add screenshots/gifs placeholders.
- [ ] Add local `.vsix` build command.
- [ ] Test install from `.vsix`.

Acceptance criteria:

- [ ] `.vsix` package builds.
- [ ] Extension installs locally.
- [ ] Extension runs after install.
- [ ] README explains all commands.

---

# 6. Codex implementation prompt for Phase 0 and Phase 1

Paste this as the first instruction to Codex:

```txt
You are implementing Codex Avatar Studio.

Goal:
Create a VS Code/Codex-compatible animated assistant foundation. Start with the extension shell, webview, SVG fallback, typed avatar state machine, and local-only asset pipeline stubs.

Important rules:
- Implement phase by phase from docs/PLAN_CHECKLIST.md.
- After finishing each task, mark its checkbox from [ ] to [x].
- Do not create final artwork.
- Do not copy Grok/Ani/Rudi designs.
- Do not require WebGPU.
- Do not require Live2D in MVP.
- Do not crash if no Rive/Live2D/GLB assets exist.
- No external network calls.
- Respect reduced motion.
- Keep the architecture modular with SVG, Rive, Live2D, WebGL, and WebGPU as runtime adapters.

First deliverable:
1. Create or update docs/PLAN_CHECKLIST.md with this checklist.
2. Create the VS Code extension shell.
3. Create the React/Vite webview shell.
4. Implement typed extension-webview messaging.
5. Show a local SVG placeholder avatar.
6. Add commands to set avatar state.
7. Make typecheck/build pass.

Acceptance:
- Extension launches in Extension Development Host.
- Avatar view opens.
- Placeholder SVG appears.
- Command can switch state from idle to thinking to speaking to success to error.
- No real .riv/.glb/.model3.json file is required.
```

---

# 7. MVP completion definition

MVP is complete when:

- [ ] VS Code extension opens an avatar panel.
- [ ] SVG fallback avatar appears.
- [ ] Avatar responds to manual commands.
- [ ] Avatar responds to basic IDE events.
- [ ] Rive runtime is integrated and falls back gracefully.
- [ ] Image-to-SVG command creates local SVG output.
- [ ] Blender command exists and handles missing Blender gracefully.
- [ ] Settings persist.
- [ ] Reduced motion works.
- [ ] Build/typecheck/test pass.

---

# 8. Future advanced ideas

After MVP, consider:

- [ ] Real Rive character with expressive state machine.
- [ ] Live2D assistant with face parameters and lip-sync.
- [ ] Three.js hologram assistant using GLB from Blender.
- [ ] Shader-based “thinking aura”.
- [ ] Code-diagnostic particles that move toward error lines.
- [ ] Voice input listening state.
- [ ] Local TTS output and audio amplitude mouth motion.
- [ ] Theme-aware avatar skins.
- [ ] Workspace-specific avatar memory.
- [ ] Safe personality packs focused on productivity.

---

# 9. Non-goals

Do not implement these in MVP:

- [ ] Full AI chat model inside the extension.
- [ ] Cloud storage.
- [ ] External asset upload.
- [ ] Adult/romantic companion behavior.
- [ ] Private Codex extension API hooks.
- [ ] Mandatory WebGPU.
- [ ] Mandatory Live2D.
- [ ] Full production art pipeline.
- [ ] Marketplace release before local `.vsix` works.

# Codex Avatar Studio — GitHub + Codex IDE Master Plan

> Project: **Codex Avatar Studio**  
> Goal: turn a Codex/VS Code-compatible IDE into a living animated assistant environment using SVG fallback, Rive/WebGL2, Blender SVG/GLB export, optional Live2D VTuber-lite mode, and optional WebGL/WebGPU rendering.  
> Primary instruction: Codex must implement this project phase by phase, mark checkboxes after each task, and never assume final artwork exists.

---

## 0. What this package adds

This package adds the missing **agent operating system** for the project:

```txt
AGENTS.md                         -> repository-wide Codex behavior and expert roles
agents.md                         -> lowercase pointer for humans; official file is AGENTS.md
SKILLS.md                         -> human index of available project skills
skills.md                         -> lowercase pointer for humans
.agents/skills/*/SKILL.md         -> actual Codex skills discovered by Codex
.github/ISSUE_TEMPLATE/*          -> GitHub issue forms for phases, design, Blender, bugs
.github/PULL_REQUEST_TEMPLATE.md  -> PR checklist for Codex-generated work
docs/GITHUB_PROJECT_SETUP.md      -> project board, labels, milestones, issues
docs/CODEX_IDE_PROMPT.md          -> paste-ready prompts for Codex IDE and @GitHub usage
docs/PLAN_CHECKLIST.md            -> master checkable implementation plan
scripts/github/*                  -> helper scripts for creating labels/issues/project structure
```

Important distinction:

```txt
AGENTS.md is official Codex instruction context.
SKILLS.md is a human-readable index.
Actual Codex skills live in .agents/skills/<skill-name>/SKILL.md.
```

---

## 1. Product definition

Create an original **IDE-native VTuber-lite coding assistant**. The assistant lives inside a VS Code/Codex-compatible IDE and responds to coding activity.

### 1.1 Core capabilities

- [ ] Show a static SVG fallback avatar when no advanced runtime exists.
- [ ] Show a Rive/WebGL2 animated avatar when `.riv` files exist.
- [ ] React to IDE states: idle, typing, thinking, reviewing, debugging, building, success, warning, error, sleeping.
- [ ] Convert images to SVG locally for reference/icon work.
- [ ] Export Blender scenes to SVG line art, GLB, and PNG previews.
- [ ] Support optional Live2D for richer face/mouth/eye/breath behavior.
- [ ] Support optional Three.js WebGL/WebGPU 3D mode.
- [ ] Keep WebGL/SVG as stable fallback; WebGPU must never be required.
- [ ] Keep all processing local by default.
- [ ] Avoid copying Grok/Ani/Rudi designs, names, adult companion mechanics, or identity.

### 1.2 Product sentence

**Codex Avatar Studio is a VS Code/Codex-compatible animated assistant system that combines SVG, Rive, Blender, Live2D, and WebGL/WebGPU into a modular avatar engine for coding, debugging, explaining, and creative technical work.**

---

## 2. Technical stack

### 2.1 Required stack

```txt
IDE extension:        VS Code Extension API
Language:             TypeScript
Webview:              React + Vite + TypeScript
2D fallback:          SVG + CSS animation
2D runtime:           Rive WebGL2 runtime
State management:     typed state machine, lightweight store
Asset processing:     Node.js scripts + optional Python sidecar
SVG optimization:     Conservative local optimizer
Blender automation:   Blender Python scripts
Build tooling:        pnpm preferred, npm acceptable if existing project uses npm
Testing:              TypeScript checks, lint, unit tests, extension smoke test
```

### 2.2 Optional stack

```txt
3D/WebGL:             Three.js
WebGPU:               progressive enhancement only
Live2D:               Cubism SDK for Web adapter later
Image tracing:        Potrace/ImageTracer-style local pipeline
Packaging:            VSIX
GitHub project:       issues, labels, milestones, project board, PR templates
```

---

## 3. Repository structure to create

```txt
codex-avatar-studio/
├── AGENTS.md
├── agents.md
├── SKILLS.md
├── skills.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── .agents/
│   └── skills/
│       ├── vscode-extension-architect/SKILL.md
│       ├── webview-avatar-designer/SKILL.md
│       ├── svg-vector-pipeline/SKILL.md
│       ├── blender-technical-artist/SKILL.md
│       ├── rive-animation-engineer/SKILL.md
│       ├── live2d-vtuber-rigger/SKILL.md
│       ├── webgl-webgpu-renderer/SKILL.md
│       ├── github-project-manager/SKILL.md
│       └── qa-release-engineer/SKILL.md
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── phase-task.yml
│   │   ├── design-review.yml
│   │   ├── blender-asset-pipeline.yml
│   │   ├── runtime-integration.yml
│   │   ├── bug-report.yml
│   │   └── config.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/
│   ├── PLAN_CHECKLIST.md
│   ├── GITHUB_PROJECT_SETUP.md
│   ├── CODEX_IDE_PROMPT.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN_SYSTEM.md
│   ├── ASSET_PIPELINE.md
│   ├── BLENDER_PIPELINE.md
│   ├── LIVE2D_PIPELINE.md
│   ├── WEBGL_WEBGPU_PIPELINE.md
│   ├── RIVE_PIPELINE.md
│   ├── SECURITY_PRIVACY.md
│   └── QA_RELEASE.md
│
├── apps/
│   ├── extension/AGENTS.md
│   └── webview/AGENTS.md
│
├── packages/
│   └── asset-pipeline/AGENTS.md
│
├── scripts/
│   ├── github/
│   │   ├── create-codex-avatar-project.sh
│   │   ├── github-labels.json
│   │   └── github-issues.json
│   └── blender/AGENTS.md
│
└── assets/avatar-placeholders/
```

---

## 4. Expert-agent behavior model

Codex should behave like a coordinated team of specialists. These are not separate humans; they are repository instructions and skills that guide Codex to apply the right mindset for the workstream.

### 4.1 Expert roles

- [ ] **Chief Product Architect**: keeps the concept coherent, avoids overbuilding, protects MVP scope.
- [ ] **VS Code Extension Developer**: builds reliable commands, settings, Webview, event bridge, packaging.
- [ ] **Frontend Motion Designer**: designs a calm, expressive, theme-aware avatar UI.
- [ ] **SVG Vector Engineer**: builds clean vector pipeline and layer naming standard.
- [ ] **Blender Technical Artist**: writes Blender Python exporters and GLB/SVG rules.
- [ ] **Rive Animation Engineer**: maps state machine inputs to avatar behaviors.
- [ ] **Live2D Rigger**: defines optional Cubism parameters and folder conventions.
- [ ] **WebGL/WebGPU Engineer**: adds progressive 3D renderer with safe fallback.
- [ ] **GitHub Project Manager**: creates issues, labels, milestones, and project fields.
- [ ] **QA/Release Engineer**: enforces tests, no-crash fallback, performance, privacy.

### 4.2 Global behavior rules

- [ ] Before changing code, inspect existing files and detect stack/package manager.
- [ ] Prefer existing repo conventions over introducing new ones.
- [ ] Do not delete user code unless explicitly requested.
- [ ] Make small, reviewable patches.
- [ ] Update `docs/PLAN_CHECKLIST.md` after each completed task.
- [ ] Keep all placeholder art original and minimal.
- [ ] Never copy Grok Ani/Rudi visual designs or names.
- [ ] Never make WebGPU required.
- [ ] Never make Blender required for the extension to run.
- [ ] Never make Live2D required for the MVP.
- [ ] All advanced runtimes must fall back to SVG.
- [ ] Run typecheck/lint/tests after implementation.

---

# 5. Markable implementation phases

## Phase 0 — GitHub repository preparation

### Goal
Create the GitHub-ready scaffolding so Codex knows exactly how to work.

```md
- [ ] Select target repo: `OWNER/REPO`.
- [ ] Create branch: `feat/codex-avatar-studio-foundation`.
- [x] Add root `AGENTS.md`.
- [x] Add lowercase pointer `agents.md`.
- [x] Add root `SKILLS.md`.
- [x] Add lowercase pointer `skills.md`.
- [x] Add `.agents/skills/*/SKILL.md` directories.
- [x] Add `.github/ISSUE_TEMPLATE/*`.
- [x] Add `.github/PULL_REQUEST_TEMPLATE.md`.
- [x] Add `docs/GITHUB_PROJECT_SETUP.md`.
- [x] Add `docs/CODEX_IDE_PROMPT.md`.
- [x] Add `docs/PLAN_CHECKLIST.md`.
- [x] Add `scripts/github/create-codex-avatar-project.sh`.
- [x] Add `scripts/github/github-labels.json`.
- [x] Add `scripts/github/github-issues.json`.
```

Acceptance:

```md
- [x] Codex can summarize active instructions from `AGENTS.md`.
- [x] `/skills` or `$` skill mention shows the repo skills.
- [x] GitHub issue templates appear in the repository.
- [x] PR template appears in new pull requests.
- [x] Project setup documentation includes labels, milestones, and board fields.
```

---

## Phase 1 — Monorepo / project shell

```md
- [x] Detect if the repository is empty or existing.
- [x] Detect package manager: pnpm, npm, yarn, bun.
- [ ] If empty, initialize TypeScript monorepo.
- [x] If existing, preserve current structure and integrate under `apps/`, `packages/`, `docs/`.
- [x] Create root `package.json` scripts.
- [x] Create `pnpm-workspace.yaml` if pnpm is selected.
- [x] Create `tsconfig.base.json`.
- [x] Create `README.md` with project summary.
- [x] Create `.gitignore` entries for generated exports/cache.
```

Acceptance:

```md
- [x] Install works.
- [x] TypeScript config loads.
- [x] No existing files are removed.
- [x] README explains the architecture in one page.
```

---

## Phase 2 — VS Code/Codex extension shell

```md
- [x] Create `apps/extension/package.json`.
- [x] Create `apps/extension/src/extension.ts`.
- [x] Register extension activation.
- [x] Register command: `Codex Avatar: Open Assistant`.
- [x] Register command: `Codex Avatar: Toggle Assistant`.
- [x] Register command: `Codex Avatar: Set State`.
- [x] Register command: `Codex Avatar: Vectorize Image to SVG`.
- [x] Register command: `Codex Avatar: Export Blender Scene`.
- [x] Register activity bar view: `codexAvatar.assistantView`.
- [x] Add strict Webview CSP.
- [x] Use `webview.asWebviewUri()` for local assets.
- [x] Create extension-to-webview messaging.
- [x] Create webview-to-extension messaging.
```

Acceptance:

```md
- [ ] Extension launches in Extension Development Host.
- [x] Avatar panel opens.
- [x] Webview shows placeholder HTML.
- [x] No CSP errors.
- [x] Commands appear in Command Palette.
```

---

## Phase 3 — Webview UI foundation

```md
- [x] Create `apps/webview` with React + Vite + TypeScript.
- [x] Build output into `apps/extension/media/webview`.
- [x] Create `App.tsx`.
- [x] Create `AvatarPanel.tsx`.
- [x] Create `AvatarStage.tsx`.
- [x] Create `AssistantBubble.tsx`.
- [x] Create `SettingsPanel.tsx`.
- [x] Create `StatusDebugPanel.tsx`.
- [x] Use VS Code CSS theme variables.
- [x] Respect `prefers-reduced-motion`.
- [x] Add webview bridge types.
```

Acceptance:

```md
- [x] Webview renders inside extension.
- [x] Webview sends `webview:ready`.
- [x] Extension can update avatar state.
- [x] UI supports light/dark themes.
```

---

## Phase 4 — Avatar core package

```md
- [x] Create `packages/avatar-core`.
- [x] Define `AvatarState`.
- [x] Define `AvatarTrigger`.
- [x] Define `AvatarRuntime`.
- [x] Define `IdeAssistantEvent`.
- [x] Define `AvatarManifest`.
- [x] Define runtime adapter interface.
- [x] Create event-to-state mapping.
- [x] Create runtime fallback resolver.
- [x] Create reduced-motion helper.
- [x] Create GPU support helper.
```

Required states:

```ts
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

Acceptance:

```md
- [x] avatar-core builds.
- [x] Event mapping tests pass.
- [x] Runtime fallback resolver works.
- [x] Browser-only APIs are guarded.
```

---

## Phase 5 — SVG fallback runtime

```md
- [x] Create `SvgAvatarRenderer.tsx`.
- [x] Add placeholder SVG avatar asset.
- [x] Add CSS animation states.
- [x] Add idle breathing.
- [x] Add blinking.
- [x] Add thinking pulse.
- [x] Add speaking mouth pulse.
- [x] Add success glow.
- [x] Add warning/error motion.
- [x] Disable looping animation under reduced motion.
```

Acceptance:

```md
- [x] Assistant works with only SVG runtime.
- [x] State changes are visually visible.
- [x] Reduced motion disables continuous movement.
- [x] Avatar does not block editor clicks.
```

---

## Phase 6 — IDE events

```md
- [x] Create `ideEvents.ts`.
- [x] Listen to active editor changes.
- [x] Listen to file save.
- [x] Listen to diagnostics changes.
- [x] Listen to debug session start/stop.
- [x] Listen to tasks where available.
- [x] Debounce diagnostics.
- [x] Return to idle after success/error.
- [x] Add manual state commands for testing.
```

Acceptance:

```md
- [x] File save triggers success/nod.
- [x] Diagnostics trigger warning/error.
- [x] Debug start triggers debugging.
- [x] Debug stop returns to idle.
- [x] Manual commands change state.
```

---

## Phase 7 — Rive runtime

```md
- [x] Add Rive dependency.
- [x] Create `RiveAvatarRenderer.tsx`.
- [x] Load `.riv` from avatar manifest.
- [x] Fall back to SVG if `.riv` is missing.
- [x] Support state machine name from manifest.
- [x] Map `AvatarState` to Rive numeric input.
- [x] Map triggers to Rive trigger inputs.
- [x] Map cursor tracking to Rive inputs.
- [x] Map mouth-open value to Rive input.
- [x] Add runtime error boundary.
```

Expected Rive state machine:

```txt
State machine: CodexAssistant
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

Acceptance:

```md
- [x] Missing `.riv` does not crash.
- [x] SVG fallback still works.
- [x] State changes reach Rive.
- [x] Triggers fire correctly.
```

---

## Phase 8 — Image to SVG pipeline

```md
- [x] Create `packages/asset-pipeline`.
- [x] Create `imageToSvg.ts`.
- [x] Create `optimizeSvg.ts`.
- [x] Create `validateSvgLayers.ts`.
- [x] Create `manifestGenerator.ts`.
- [x] Add `Codex Avatar: Vectorize Image to SVG` command.
- [x] Let user select PNG/JPG/WebP.
- [x] Export to `.codex-avatar/exports/svg/`.
- [x] Create raw trace SVG.
- [x] Create optimized SVG.
- [x] Create manifest entry.
- [x] Show friendly errors.
```

Rule:

```txt
Image tracing is for references/icons/silhouettes. Animated characters must be clean layered vector art or a rigged runtime file.
```

Acceptance:

```md
- [x] Command appears.
- [x] User can select an image.
- [x] Local SVG output is created.
- [x] No external service is used.
```

---

## Phase 9 — SVG layer standard

```md
- [x] Document layer naming in `docs/ASSET_PIPELINE.md`.
- [x] Validate required groups.
- [x] Warn on unnamed groups.
- [x] Warn on huge SVG files.
- [x] Warn on too many tiny paths.
```

Required humanoid/VTuber-lite layers:

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

Acceptance:

```md
- [x] Valid sample SVG passes.
- [x] Missing moving parts are reported.
- [x] Documentation is clear for designers.
```

---

## Phase 10 — Blender technical artist pipeline

```md
- [x] Add `scripts/blender/export_svg.py`.
- [x] Add `scripts/blender/export_glb.py`.
- [x] Add `scripts/blender/render_turntable.py`.
- [x] Add setting `codexAvatar.blenderPath`.
- [x] Auto-detect Blender path when possible.
- [x] Add command: `Codex Avatar: Export Blender Scene`.
- [x] Let user select `.blend` file.
- [x] Let user choose SVG line-art export.
- [x] Let user choose GLB export.
- [x] Let user choose PNG preview.
- [x] Run Blender with `child_process.spawn`.
- [x] Log output to VS Code Output Channel.
- [x] Export to `.codex-avatar/exports/blender/`.
- [x] Handle missing Blender gracefully.
```

Blender design rules:

```txt
- Use orthographic camera for SVG/line-art output.
- Use named collections: Avatar, Rig, Export, Guides, Ignore.
- Use flat materials for stylized output.
- Use Grease Pencil/Line Art for SVG export when possible.
- Use GLB for WebGL/Three.js mode.
- Use shape keys for blink/mouth in GLB mode.
- Keep file paths relative and local.
```

Acceptance:

```md
- [x] Missing Blender shows setup message.
- [x] `blender --version` test works when path is valid.
- [x] `.blend` file can be selected.
- [x] SVG/GLB export succeeds or gives clear error.
- [x] Manifest entry is created.
```

---

## Phase 11 — VTuber-lite behavior

```md
- [x] Add contextual messages.
- [x] Add speech bubble.
- [x] Add idle timer.
- [x] Add sleep mode.
- [x] Add wake trigger.
- [x] Add cursor tracking.
- [x] Add text-based mouth-open estimate.
- [x] Add focus mode.
- [x] Add animation intensity setting.
- [x] Add speech bubble setting.
```

Behavior mapping:

```txt
Typing             -> subtle look/coding state
Assistant thinking -> thinking state
Assistant speaking -> mouthOpen + speaking state
Error diagnostics  -> warning/error
Tests pass         -> success
Debug session      -> debugging
Idle for long time -> sleeping
```

Acceptance:

```md
- [x] Avatar sleeps after inactivity.
- [x] Avatar wakes on interaction.
- [x] Speaking state animates mouth input.
- [x] User can disable speech bubbles.
- [x] Reduced-motion remains calm.
```

---

## Phase 12 — WebGL/WebGPU mode

```md
- [x] Add optional Three.js dependency behind feature flag.
- [x] Create `WebGLAvatarRenderer.tsx`.
- [x] Load GLB from manifest.
- [x] Detect WebGL2 support.
- [x] Detect WebGPU support.
- [x] Default to WebGL-compatible rendering.
- [x] Use WebGPU only when supported and enabled.
- [x] Fall back to SVG when unsupported.
- [x] Add placeholder 3D orb/mascot.
- [x] Pause animation when webview hidden.
```

Acceptance:

```md
- [x] WebGL renderer loads only when selected.
- [x] Missing GLB does not crash.
- [x] Unsupported GPU mode falls back to SVG.
- [x] Placeholder responds to states.
```

---

## Phase 13 — Live2D adapter

```md
- [x] Create `docs/LIVE2D_PIPELINE.md`.
- [x] Create `Live2DAvatarRenderer.tsx` placeholder.
- [x] Define expected Live2D folder structure.
- [x] Add manifest field for `model.model3.json`.
- [x] Map states to motions/expressions.
- [x] Map mouthOpen to `ParamMouthOpenY`.
- [x] Map cursor to `ParamAngleX` / `ParamAngleY`.
- [x] Map breathing to `ParamBreath`.
- [x] Fall back when assets/runtime are missing.
```

Expected folder:

```txt
avatars/live2d/<avatar-id>/
├── model.model3.json
├── model.moc3
├── textures/
├── motions/
├── expressions/
└── physics3.json
```

Acceptance:

```md
- [x] App compiles without Live2D assets.
- [x] Live2D mode gracefully falls back.
- [x] Documentation explains PSD/Cubism preparation.
```

---

## Phase 14 — Settings and persistence

```md
- [x] Add settings UI.
- [x] Persist enabled/disabled.
- [x] Persist selected runtime.
- [x] Persist selected avatar.
- [x] Persist panel position.
- [x] Persist animation intensity.
- [x] Persist reduced-motion override.
- [x] Persist speech bubble setting.
- [x] Add reset-to-default command.
```

Acceptance:

```md
- [x] Settings update without restart when possible.
- [x] Settings persist after reload.
- [x] Invalid runtime falls back to SVG.
```

---

## Phase 15 — Asset manager UI

```md
- [x] Add Avatar Asset Manager panel.
- [x] Show loaded manifest.
- [x] Show current runtime.
- [x] Show missing asset warnings.
- [x] Add Open Avatar Assets Folder button.
- [x] Add Validate Manifest button.
- [x] Add Vectorize Image button.
- [x] Add Export Blender Scene button.
- [x] Add Reload Avatar button.
```

Acceptance:

```md
- [x] User can open assets folder.
- [x] User can validate manifest.
- [x] Missing files are listed clearly.
- [x] Avatar reloads without extension restart.
```

---

## Phase 16 — Testing and quality gates

```md
- [x] Add typecheck script.
- [x] Add lint script.
- [x] Add unit test script.
- [x] Add build script.
- [x] Add avatar-core tests.
- [x] Add manifest validation tests.
- [x] Add extension activation test.
- [x] Add webview smoke test.
- [x] Add asset pipeline test.
- [x] Add Blender runner dry-run test.
- [x] Add manual QA checklist.
```

Acceptance:

```md
- [x] typecheck passes.
- [x] lint passes.
- [x] tests pass.
- [x] build passes.
- [ ] extension launches in development host.
```

---

## Phase 17 — Performance and privacy hardening

```md
- [x] Lazy-load Rive renderer.
- [x] Lazy-load WebGL renderer.
- [x] Lazy-load Live2D renderer.
- [x] Keep SVG fallback always available.
- [x] Pause animation when hidden.
- [x] Throttle cursor tracking.
- [x] Debounce diagnostics.
- [x] Limit speech bubble frequency.
- [x] Prevent pointer blocking over editor.
- [x] Confirm no network calls.
- [x] Add file size warnings.
- [x] Keep generated user assets local.
```

Acceptance:

```md
- [x] Avatar does not slow the editor.
- [x] Focus mode reduces motion.
- [x] Hidden webview pauses animation.
- [x] Large assets show warnings.
- [x] No external network calls exist.
```

---

## Phase 18 — Packaging and GitHub release workflow

```md
- [x] Add extension icon placeholder.
- [x] Add extension display name.
- [x] Add license.
- [x] Add changelog.
- [x] Add VSIX packaging script.
- [x] Add GitHub Actions CI.
- [x] Add README usage instructions.
- [x] Build local `.vsix`.
- [x] Test local `.vsix` install.
- [x] Create release checklist.
```

Acceptance:

```md
- [x] `.vsix` builds.
- [x] Extension installs locally.
- [x] Extension runs after install.
- [ ] CI passes on PR.
```

---

# 6. GitHub project board plan

## 6.1 Project title

```txt
Codex Avatar Studio — IDE VTuber-lite Assistant
```

## 6.2 Project views

Create these GitHub Project views:

```txt
1. Roadmap by Phase
   Group by Phase
   Sort by Priority

2. Kanban by Status
   Columns: Backlog, Ready, In Progress, In Review, Done, Blocked

3. Workstream Board
   Group by Workstream

4. Design + Asset Pipeline
   Filter: label:workstream:design OR label:workstream:blender OR label:workstream:svg

5. Runtime Engineering
   Filter: label:workstream:runtime OR label:workstream:rive OR label:workstream:live2d OR label:workstream:webgl

6. QA / Release
   Filter: label:qa OR label:release OR label:security
```

## 6.3 Project fields

```txt
Status:
- Backlog
- Ready
- In Progress
- In Review
- Done
- Blocked

Phase:
- 0 GitHub + Agents
- 1 Repo shell
- 2 Extension shell
- 3 Webview UI
- 4 Avatar core
- 5 SVG fallback
- 6 IDE events
- 7 Rive runtime
- 8 Image-to-SVG
- 9 SVG layer standard
- 10 Blender pipeline
- 11 VTuber-lite behavior
- 12 WebGL/WebGPU
- 13 Live2D adapter
- 14 Settings
- 15 Asset manager
- 16 Testing
- 17 Hardening
- 18 Packaging

Workstream:
- architecture
- github
- codex-agents
- extension
- webview
- avatar-core
- svg
- rive
- blender
- live2d
- webgl-webgpu
- ux-design
- qa
- release

Priority:
- P0 critical
- P1 important
- P2 useful
- P3 later

Risk:
- low
- medium
- high
```

## 6.4 Labels

```txt
phase:0 ... phase:18
workstream:github
workstream:agents
workstream:extension
workstream:webview
workstream:avatar-core
workstream:svg
workstream:rive
workstream:blender
workstream:live2d
workstream:webgl-webgpu
workstream:qa
priority:P0
priority:P1
priority:P2
priority:P3
status:blocked
status:ready
codex-ready
design-review
needs-assets
security
performance
release
```

## 6.5 Milestones

```txt
M0 — GitHub + Codex operating system
M1 — MVP IDE extension shell
M2 — SVG fallback + Rive runtime
M3 — Asset conversion pipeline
M4 — Blender + WebGL/WebGPU pipeline
M5 — Live2D optional VTuber-lite adapter
M6 — Settings, QA, packaging
```

---

# 7. @GitHub + Codex IDE instructions

Use this prompt inside Codex IDE when the repo is open:

```txt
@GitHub Use the current repository as the target repo.

Implement Codex Avatar Studio Phase 0 only.

Add the repository operating system for Codex:
- AGENTS.md
- agents.md pointer
- SKILLS.md
- skills.md pointer
- .agents/skills/*/SKILL.md
- .github/ISSUE_TEMPLATE/*
- .github/PULL_REQUEST_TEMPLATE.md
- docs/GITHUB_PROJECT_SETUP.md
- docs/CODEX_IDE_PROMPT.md
- docs/PLAN_CHECKLIST.md
- scripts/github/create-codex-avatar-project.sh
- scripts/github/github-labels.json
- scripts/github/github-issues.json

Rules:
- Do not implement runtime code yet.
- Do not install dependencies yet.
- Do not delete existing files.
- Mark Phase 0 checkboxes in docs/PLAN_CHECKLIST.md after implementation.
- Create a PR titled: "Phase 0: Codex Avatar Studio project operating system".
```

---

# 8. MVP definition of done

```md
- [x] GitHub repo contains AGENTS.md and .agents/skills.
- [x] GitHub issue templates exist.
- [x] GitHub Project plan exists in docs.
- [x] VS Code extension opens avatar panel.
- [x] SVG fallback avatar appears.
- [x] Avatar responds to manual commands.
- [x] Avatar responds to basic IDE events.
- [x] Rive adapter exists and falls back gracefully.
- [x] Image-to-SVG command creates local output.
- [x] Blender command exists and handles missing Blender gracefully.
- [x] Settings persist.
- [x] Reduced motion works.
- [x] No external network calls.
- [x] typecheck/lint/test/build pass.
```


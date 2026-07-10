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
- [ ] Add root `AGENTS.md`.
- [ ] Add lowercase pointer `agents.md`.
- [ ] Add root `SKILLS.md`.
- [ ] Add lowercase pointer `skills.md`.
- [ ] Add `.agents/skills/*/SKILL.md` directories.
- [ ] Add `.github/ISSUE_TEMPLATE/*`.
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md`.
- [ ] Add `docs/GITHUB_PROJECT_SETUP.md`.
- [ ] Add `docs/CODEX_IDE_PROMPT.md`.
- [ ] Add `docs/PLAN_CHECKLIST.md`.
- [ ] Add `scripts/github/create-codex-avatar-project.sh`.
- [ ] Add `scripts/github/github-labels.json`.
- [ ] Add `scripts/github/github-issues.json`.
```

Acceptance:

```md
- [ ] Codex can summarize active instructions from `AGENTS.md`.
- [ ] `/skills` or `$` skill mention shows the repo skills.
- [ ] GitHub issue templates appear in the repository.
- [ ] PR template appears in new pull requests.
- [ ] Project setup documentation includes labels, milestones, and board fields.
```

---

## Phase 1 — Monorepo / project shell

```md
- [ ] Detect if the repository is empty or existing.
- [ ] Detect package manager: pnpm, npm, yarn, bun.
- [ ] If empty, initialize TypeScript monorepo.
- [ ] If existing, preserve current structure and integrate under `apps/`, `packages/`, `docs/`.
- [ ] Create root `package.json` scripts.
- [ ] Create `pnpm-workspace.yaml` if pnpm is selected.
- [ ] Create `tsconfig.base.json`.
- [ ] Create `README.md` with project summary.
- [ ] Create `.gitignore` entries for generated exports/cache.
```

Acceptance:

```md
- [ ] Install works.
- [ ] TypeScript config loads.
- [ ] No existing files are removed.
- [ ] README explains the architecture in one page.
```

---

## Phase 2 — VS Code/Codex extension shell

```md
- [ ] Create `apps/extension/package.json`.
- [ ] Create `apps/extension/src/extension.ts`.
- [ ] Register extension activation.
- [ ] Register command: `Codex Avatar: Open Assistant`.
- [ ] Register command: `Codex Avatar: Toggle Assistant`.
- [ ] Register command: `Codex Avatar: Set State`.
- [ ] Register command: `Codex Avatar: Vectorize Image to SVG`.
- [ ] Register command: `Codex Avatar: Export Blender Scene`.
- [ ] Register activity bar view: `codexAvatar.assistantView`.
- [ ] Add strict Webview CSP.
- [ ] Use `webview.asWebviewUri()` for local assets.
- [ ] Create extension-to-webview messaging.
- [ ] Create webview-to-extension messaging.
```

Acceptance:

```md
- [ ] Extension launches in Extension Development Host.
- [ ] Avatar panel opens.
- [ ] Webview shows placeholder HTML.
- [ ] No CSP errors.
- [ ] Commands appear in Command Palette.
```

---

## Phase 3 — Webview UI foundation

```md
- [ ] Create `apps/webview` with React + Vite + TypeScript.
- [ ] Build output into `apps/extension/media/webview`.
- [ ] Create `App.tsx`.
- [ ] Create `AvatarPanel.tsx`.
- [ ] Create `AvatarStage.tsx`.
- [ ] Create `AssistantBubble.tsx`.
- [ ] Create `SettingsPanel.tsx`.
- [ ] Create `StatusDebugPanel.tsx`.
- [ ] Use VS Code CSS theme variables.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Add webview bridge types.
```

Acceptance:

```md
- [ ] Webview renders inside extension.
- [ ] Webview sends `webview:ready`.
- [ ] Extension can update avatar state.
- [ ] UI supports light/dark themes.
```

---

## Phase 4 — Avatar core package

```md
- [ ] Create `packages/avatar-core`.
- [ ] Define `AvatarState`.
- [ ] Define `AvatarTrigger`.
- [ ] Define `AvatarRuntime`.
- [ ] Define `IdeAssistantEvent`.
- [ ] Define `AvatarManifest`.
- [ ] Define runtime adapter interface.
- [ ] Create event-to-state mapping.
- [ ] Create runtime fallback resolver.
- [ ] Create reduced-motion helper.
- [ ] Create GPU support helper.
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
- [ ] avatar-core builds.
- [ ] Event mapping tests pass.
- [ ] Runtime fallback resolver works.
- [ ] Browser-only APIs are guarded.
```

---

## Phase 5 — SVG fallback runtime

```md
- [ ] Create `SvgAvatarRenderer.tsx`.
- [ ] Add placeholder SVG avatar asset.
- [ ] Add CSS animation states.
- [ ] Add idle breathing.
- [ ] Add blinking.
- [ ] Add thinking pulse.
- [ ] Add speaking mouth pulse.
- [ ] Add success glow.
- [ ] Add warning/error motion.
- [ ] Disable looping animation under reduced motion.
```

Acceptance:

```md
- [ ] Assistant works with only SVG runtime.
- [ ] State changes are visually visible.
- [ ] Reduced motion disables continuous movement.
- [ ] Avatar does not block editor clicks.
```

---

## Phase 6 — IDE events

```md
- [ ] Create `ideEvents.ts`.
- [ ] Listen to active editor changes.
- [ ] Listen to file save.
- [ ] Listen to diagnostics changes.
- [ ] Listen to debug session start/stop.
- [ ] Listen to tasks where available.
- [ ] Debounce diagnostics.
- [ ] Return to idle after success/error.
- [ ] Add manual state commands for testing.
```

Acceptance:

```md
- [ ] File save triggers success/nod.
- [ ] Diagnostics trigger warning/error.
- [ ] Debug start triggers debugging.
- [ ] Debug stop returns to idle.
- [ ] Manual commands change state.
```

---

## Phase 7 — Rive runtime

```md
- [ ] Add Rive dependency.
- [ ] Create `RiveAvatarRenderer.tsx`.
- [ ] Load `.riv` from avatar manifest.
- [ ] Fall back to SVG if `.riv` is missing.
- [ ] Support state machine name from manifest.
- [ ] Map `AvatarState` to Rive numeric input.
- [ ] Map triggers to Rive trigger inputs.
- [ ] Map cursor tracking to Rive inputs.
- [ ] Map mouth-open value to Rive input.
- [ ] Add runtime error boundary.
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
- [ ] Missing `.riv` does not crash.
- [ ] SVG fallback still works.
- [ ] State changes reach Rive.
- [ ] Triggers fire correctly.
```

---

## Phase 8 — Image to SVG pipeline

```md
- [ ] Create `packages/asset-pipeline`.
- [ ] Create `imageToSvg.ts`.
- [ ] Create `optimizeSvg.ts`.
- [ ] Create `validateSvgLayers.ts`.
- [ ] Create `manifestGenerator.ts`.
- [ ] Add `Codex Avatar: Vectorize Image to SVG` command.
- [ ] Let user select PNG/JPG/WebP.
- [ ] Export to `.codex-avatar/exports/svg/`.
- [ ] Create raw trace SVG.
- [ ] Create optimized SVG.
- [ ] Create manifest entry.
- [ ] Show friendly errors.
```

Rule:

```txt
Image tracing is for references/icons/silhouettes. Animated characters must be clean layered vector art or a rigged runtime file.
```

Acceptance:

```md
- [ ] Command appears.
- [ ] User can select an image.
- [ ] Local SVG output is created.
- [ ] No external service is used.
```

---

## Phase 9 — SVG layer standard

```md
- [ ] Document layer naming in `docs/ASSET_PIPELINE.md`.
- [ ] Validate required groups.
- [ ] Warn on unnamed groups.
- [ ] Warn on huge SVG files.
- [ ] Warn on too many tiny paths.
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
- [ ] Valid sample SVG passes.
- [ ] Missing moving parts are reported.
- [ ] Documentation is clear for designers.
```

---

## Phase 10 — Blender technical artist pipeline

```md
- [ ] Add `scripts/blender/export_svg.py`.
- [ ] Add `scripts/blender/export_glb.py`.
- [ ] Add `scripts/blender/render_turntable.py`.
- [ ] Add setting `codexAvatar.blenderPath`.
- [ ] Auto-detect Blender path when possible.
- [ ] Add command: `Codex Avatar: Export Blender Scene`.
- [ ] Let user select `.blend` file.
- [ ] Let user choose SVG line-art export.
- [ ] Let user choose GLB export.
- [ ] Let user choose PNG preview.
- [ ] Run Blender with `child_process.spawn`.
- [ ] Log output to VS Code Output Channel.
- [ ] Export to `.codex-avatar/exports/blender/`.
- [ ] Handle missing Blender gracefully.
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
- [ ] Missing Blender shows setup message.
- [ ] `blender --version` test works when path is valid.
- [ ] `.blend` file can be selected.
- [ ] SVG/GLB export succeeds or gives clear error.
- [ ] Manifest entry is created.
```

---

## Phase 11 — VTuber-lite behavior

```md
- [ ] Add contextual messages.
- [ ] Add speech bubble.
- [ ] Add idle timer.
- [ ] Add sleep mode.
- [ ] Add wake trigger.
- [ ] Add cursor tracking.
- [ ] Add text-based mouth-open estimate.
- [ ] Add focus mode.
- [ ] Add animation intensity setting.
- [ ] Add speech bubble setting.
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
- [ ] Avatar sleeps after inactivity.
- [ ] Avatar wakes on interaction.
- [ ] Speaking state animates mouth input.
- [ ] User can disable speech bubbles.
- [ ] Reduced-motion remains calm.
```

---

## Phase 12 — WebGL/WebGPU mode

```md
- [ ] Add optional Three.js dependency behind feature flag.
- [ ] Create `WebGLAvatarRenderer.tsx`.
- [ ] Load GLB from manifest.
- [ ] Detect WebGL2 support.
- [ ] Detect WebGPU support.
- [ ] Default to WebGL-compatible rendering.
- [ ] Use WebGPU only when supported and enabled.
- [ ] Fall back to SVG when unsupported.
- [ ] Add placeholder 3D orb/mascot.
- [ ] Pause animation when webview hidden.
```

Acceptance:

```md
- [ ] WebGL renderer loads only when selected.
- [ ] Missing GLB does not crash.
- [ ] Unsupported GPU mode falls back to SVG.
- [ ] Placeholder responds to states.
```

---

## Phase 13 — Live2D adapter

```md
- [ ] Create `docs/LIVE2D_PIPELINE.md`.
- [ ] Create `Live2DAvatarRenderer.tsx` placeholder.
- [ ] Define expected Live2D folder structure.
- [ ] Add manifest field for `model.model3.json`.
- [ ] Map states to motions/expressions.
- [ ] Map mouthOpen to `ParamMouthOpenY`.
- [ ] Map cursor to `ParamAngleX` / `ParamAngleY`.
- [ ] Map breathing to `ParamBreath`.
- [ ] Fall back when assets/runtime are missing.
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
- [ ] App compiles without Live2D assets.
- [ ] Live2D mode gracefully falls back.
- [ ] Documentation explains PSD/Cubism preparation.
```

---

## Phase 14 — Settings and persistence

```md
- [ ] Add settings UI.
- [ ] Persist enabled/disabled.
- [ ] Persist selected runtime.
- [ ] Persist selected avatar.
- [ ] Persist panel position.
- [ ] Persist animation intensity.
- [ ] Persist reduced-motion override.
- [ ] Persist speech bubble setting.
- [ ] Add reset-to-default command.
```

Acceptance:

```md
- [ ] Settings update without restart when possible.
- [ ] Settings persist after reload.
- [ ] Invalid runtime falls back to SVG.
```

---

## Phase 15 — Asset manager UI

```md
- [ ] Add Avatar Asset Manager panel.
- [ ] Show loaded manifest.
- [ ] Show current runtime.
- [ ] Show missing asset warnings.
- [ ] Add Open Avatar Assets Folder button.
- [ ] Add Validate Manifest button.
- [ ] Add Vectorize Image button.
- [ ] Add Export Blender Scene button.
- [ ] Add Reload Avatar button.
```

Acceptance:

```md
- [ ] User can open assets folder.
- [ ] User can validate manifest.
- [ ] Missing files are listed clearly.
- [ ] Avatar reloads without extension restart.
```

---

## Phase 16 — Testing and quality gates

```md
- [ ] Add typecheck script.
- [ ] Add lint script.
- [ ] Add unit test script.
- [ ] Add build script.
- [ ] Add avatar-core tests.
- [ ] Add manifest validation tests.
- [ ] Add extension activation test.
- [ ] Add webview smoke test.
- [ ] Add asset pipeline test.
- [ ] Add Blender runner dry-run test.
- [ ] Add manual QA checklist.
```

Acceptance:

```md
- [ ] typecheck passes.
- [ ] lint passes.
- [ ] tests pass.
- [ ] build passes.
- [ ] extension launches in development host.
```

---

## Phase 17 — Performance and privacy hardening

```md
- [ ] Lazy-load Rive renderer.
- [ ] Lazy-load WebGL renderer.
- [ ] Lazy-load Live2D renderer.
- [ ] Keep SVG fallback always available.
- [ ] Pause animation when hidden.
- [ ] Throttle cursor tracking.
- [ ] Debounce diagnostics.
- [ ] Limit speech bubble frequency.
- [ ] Prevent pointer blocking over editor.
- [ ] Confirm no network calls.
- [ ] Add file size warnings.
- [ ] Keep generated user assets local.
```

Acceptance:

```md
- [ ] Avatar does not slow the editor.
- [ ] Focus mode reduces motion.
- [ ] Hidden webview pauses animation.
- [ ] Large assets show warnings.
- [ ] No external network calls exist.
```

---

## Phase 18 — Packaging and GitHub release workflow

```md
- [ ] Add extension icon placeholder.
- [ ] Add extension display name.
- [ ] Add license.
- [ ] Add changelog.
- [ ] Add VSIX packaging script.
- [ ] Add GitHub Actions CI.
- [ ] Add README usage instructions.
- [ ] Build local `.vsix`.
- [ ] Test local `.vsix` install.
- [ ] Create release checklist.
```

Acceptance:

```md
- [ ] `.vsix` builds.
- [ ] Extension installs locally.
- [ ] Extension runs after install.
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
- [ ] GitHub repo contains AGENTS.md and .agents/skills.
- [ ] GitHub issue templates exist.
- [ ] GitHub Project plan exists in docs.
- [ ] VS Code extension opens avatar panel.
- [ ] SVG fallback avatar appears.
- [ ] Avatar responds to manual commands.
- [ ] Avatar responds to basic IDE events.
- [ ] Rive adapter exists and falls back gracefully.
- [ ] Image-to-SVG command creates local output.
- [ ] Blender command exists and handles missing Blender gracefully.
- [ ] Settings persist.
- [ ] Reduced motion works.
- [ ] No external network calls.
- [ ] typecheck/lint/test/build pass.
```

# Codex IDE Prompts

## Session reset / post-MVP prompt

Use this when starting a **new** Codex chat after the MVP is closed. Paste the whole block.

```txt
$qa-release-engineer
Reset and continue from a clean post-MVP state.

Read first:
- AGENTS.md
- docs/PLAN_CHECKLIST.md (Current status block at the top, then section 8)
- docs/LICENSING.md
- docs/RELEASE_CHECKLIST.md
- docs/CODEX_IDE_PROMPT.md

Hard stop rules:
- Do NOT begin at Phase 0.
- Do NOT reopen the GPL Potrace / ImageTracer migration.
- Do NOT create a todo list to audit/migrate the tracer again.
- Do NOT install ts-webp or add Sharp unless the user explicitly asks.
- Optional Phases 14–17 stay DEFERRED until the user names one.

Verified already (do not redo):
- MVP definition checklist is complete.
- Image-to-SVG uses imagetracerjs + jimp (no potrace).
- Publication notices/asset attestation committed (validate:notices).
- Working tree should be clean on main at docs(release): refresh notices… (c586e83) or later.

First actions only:
1. Run `git status` and `git log -3 --oneline`.
2. Report current status in the required progress format with:
   Open blockers: none
   Next unchecked task: none (MVP complete; await explicit next request)
3. Stop and wait for the user’s next concrete task.

If the user has not given a new task, end the session after the status report.
```

## Phase 0 prompt

```txt
@GitHub Use the current repository as the target repo.

Implement Codex Avatar Studio Phase 0 only.

Add:
- AGENTS.md
- agents.md
- SKILLS.md
- skills.md
- .agents/skills/*/SKILL.md
- .github/ISSUE_TEMPLATE/*
- .github/PULL_REQUEST_TEMPLATE.md
- docs/GITHUB_PROJECT_SETUP.md
- docs/CODEX_IDE_PROMPT.md
- docs/PLAN_CHECKLIST.md
- scripts/github/create-codex-avatar-project.sh
- scripts/github/github-labels.json
- scripts/github/github-issues.json

Do not implement runtime code yet.
Do not install dependencies yet.
Do not delete existing files.
Mark completed checkboxes in docs/PLAN_CHECKLIST.md.
Open a PR titled: Phase 0: Codex Avatar Studio project operating system.
```

## Phase 1 + 2 prompt

```txt
$vscode-extension-architect
@GitHub Start Phase 1 and Phase 2 for Codex Avatar Studio.

Read AGENTS.md, SKILLS.md, and docs/PLAN_CHECKLIST.md first.
Detect package manager and existing repo structure.
Create or adapt the monorepo and VS Code extension shell.
Register commands and placeholder Webview.
Do not delete existing user code.
Mark checkboxes only after acceptance criteria pass.
Open a PR when finished.
```

## Blender prompt

```txt
$blender-technical-artist
@GitHub Implement Phase 10 Blender export pipeline.

Add Blender path detection, export_svg.py, export_glb.py, render_turntable.py, and extension command wiring.
Blender must be optional.
Missing Blender must show a friendly message.
Generated files must go to .codex-avatar/exports/blender.
Update docs/BLENDER_PIPELINE.md and docs/PLAN_CHECKLIST.md.
```

## Rive prompt

```txt
$rive-animation-engineer
@GitHub Implement Phase 7 Rive runtime adapter.

Rive must load lazily from manifest.
If .riv is missing or load fails, fall back to SVG.
Map AvatarState to Rive input state:number.
Map triggers: wave, celebrate, confused, point.
Update docs/RIVE_PIPELINE.md and docs/PLAN_CHECKLIST.md.
```

## QA prompt

```txt
$qa-release-engineer
@GitHub Stabilize Codex Avatar Studio.

Run typecheck, lint, tests, and build.
Verify missing Rive/Blender/Live2D/GLB assets do not crash.
Verify no external network calls.
Verify reduced-motion behavior.
Update docs/QA_RELEASE.md and docs/PLAN_CHECKLIST.md.
```

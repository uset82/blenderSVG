# Repository agent skills

Coding agents working in this repository use the skills in `.agents/skills/<skill-name>/SKILL.md`. Use a skill when a task matches its workstream. Studio visual work also uses the WebDesigner suite described in the plan (`docs/PLAN_CHECKLIST.md`).

| Skill | Use for |
| --- | --- |
| `vscode-extension-architect` | VS Code commands, activation, settings, Webview providers, CSP, and IDE event integration. |
| `webview-avatar-designer` | The avatar sidebar Webview: stage, assistant bubble, settings, reduced motion, and theme-aware UX. |
| `svg-vector-pipeline` | Local image-to-SVG conversion, conservative SVG optimization, layer naming, manifest generation, and vector validation. |
| `blender-technical-artist` | Blender Python automation, SVG line-art export, GLB export, PNG previews, rig conventions, and Blender-to-WebGL assets. |
| `blender-modeling` | Clean Blender topology, transforms, naming, and real-time modeling practices. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-materials` | glTF-safe Principled materials, texture budgets, and material validation. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-animation` | Actions, F-curves, loops, shape keys, NLA, and glTF-compatible animation. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `blender-export` | GLB export, skin/morph constraints, and real-time asset budgets. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `animation-quality-gate` | Contact-sheet, silhouette, loop, flicker, and export-truth review. Pinned from `roble3/cc-blender-skill@11016c9`. |
| `rigging-animation` | Armature hierarchy, weights, deformation, corrective shapes, and rig validation. Pinned from `omer-metin/skills-for-antigravity@e8dcf4e`. |
| `blender-motion-state-inspection` | Blender motion-state, frame-range, contact, and axis inspection. Pinned from `affaan-m/everything-claude-code@ed38744`. |
| `webgl-webgpu-renderer` | Optional Three.js GLB rendering, WebGL2/WebGPU detection, 3D avatar mode, and progressive GPU fallback. |
| Official PixiJS skills | PixiJS runtime and animation reference material: [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills). Reference only; never bundled as a runtime dependency. |
| `github-project-manager` | GitHub labels, milestones, issue templates, project fields, and PR workflow. |
| `qa-release-engineer` | Typecheck, lint, tests, no-crash fallbacks, performance, privacy, CI, VSIX packaging, and release readiness. |

The Rive and Live2D skills were removed on 2026-09-23 because those runtimes are in the deferred backlog. They remain in Git history.

These skills are development guidance only and are never copied into the VSIX. Their source pins and licenses are recorded in `THIRD_PARTY_NOTICES.md`.

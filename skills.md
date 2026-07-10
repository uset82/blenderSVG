# SKILLS.md

Codex Avatar Studio uses repository skills in `.agents/skills/<skill-name>/SKILL.md`.
Use these skills when a task matches the listed workstream.

| Skill | Use For |
| --- | --- |
| `vscode-extension-architect` | VS Code commands, activation, settings, Webview providers, CSP, and IDE event integration. |
| `webview-avatar-designer` | React/Vite Webview UI, avatar stage, assistant bubble, settings, reduced motion, and theme-aware UX. |
| `svg-vector-pipeline` | Local image-to-SVG conversion, conservative SVG optimization, layer naming, manifest generation, and vector validation. |
| `blender-technical-artist` | Blender Python automation, SVG line-art export, GLB export, PNG previews, rig conventions, and Blender-to-WebGL assets. |
| `rive-animation-engineer` | Rive runtime integration, state machine inputs, avatar state mapping, triggers, and SVG fallback behavior. |
| `live2d-vtuber-rigger` | Optional Live2D model3 manifests, mouth/eye/breath parameters, and VTuber-lite fallback behavior. |
| `webgl-webgpu-renderer` | Optional Three.js GLB rendering, WebGL2/WebGPU detection, 3D avatar mode, and progressive GPU fallback. |
| Official PixiJS skills | PixiJS runtime and animation reference material: [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills). Reference only; never bundled as a runtime dependency. |
| `github-project-manager` | GitHub labels, milestones, issue templates, project fields, project board documentation, and PR workflow. |
| `qa-release-engineer` | Typecheck, lint, tests, no-crash fallbacks, performance, privacy, CI, VSIX packaging, and release readiness. |

`skills.md` is a lowercase pointer for humans. The actual skill instructions live in `.agents/skills`.

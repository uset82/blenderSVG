# Security and Privacy

Codex Avatar Studio processes avatar assets locally. It does not upload images, `.blend`, `.riv`, `.moc3`, `.glb`, SVG files, IDE events, or audio levels, and it does not include telemetry or remote runtime downloads.

## Local data

- VS Code settings are stored by VS Code in the extension configuration scope. They contain preferences such as runtime, animation, accessibility, and the configured asset workspace path.
- The workspace-local `.codex-avatar/avatar-registry.json` records imported package ids and the active package.
- `.codex-avatar/avatars/` contains imported avatar packages. The package validator rejects traversal, symbolic links, remote paths, malformed manifests, unsafe SVG content, oversized files, and oversized packages.
- `.codex-avatar/exports/` contains user-requested SVG, Blender, GLB, and PNG outputs. The clear-cache command intentionally preserves these exports and imported avatars.
- `.codex-avatar/cache/` and `.codex-avatar/previews/` contain generated intermediate data and are the only directories removed by the clear-cache command.
- Extension-bundled files under `apps/extension/media/` are read-only packaged resources.

## Runtime and process boundaries

- The Webview uses a nonce-based CSP with `default-src 'none'`, local VS Code resource URIs only, no remote script source, no embedded objects, and no forms.
- Avatar package JSON is validated with the shared Zod manifest schema. Pixi metadata has bounded local-path, frame-count, clip, and texture-dimension validation.
- SVG output is sanitized before optimization and imported SVG files containing executable or remote content are rejected.
- Blender is launched only after workspace trust is confirmed, with `spawn(command, args, { shell: false })`. Input scenes and generated outputs are constrained to the workspace.
- Optional lip-sync analyzes local media playback through Web Audio. Microphone access is not requested.

Use `Codex Avatar: Delete Imported Avatar Package` to remove an imported avatar. Use `Codex Avatar: Clear Generated Cache` to remove generated cache/previews without deleting packages or exports.

# Troubleshooting

## The assistant panel is empty

Run `Codex Avatar: Open Assistant`, then `Codex Avatar: Reload Avatar`. Check that the workspace is trusted and that the extension is enabled. In a development host, open **Help → Toggle Developer Tools** and inspect the console for a CSP or missing-resource error.

## Pixi fails or the avatar returns to SVG

This is the expected safe fallback when WebGL/WebGPU is unavailable, the local spritesheet is invalid, or initialization exceeds eight seconds in the Webview. Confirm that the manifest entrypoint and `image` path are local and that the image fits the frame grid. Set `codexAvatar.runtime` to `svg` to keep the assistant available while repairing the package.

## An avatar package is rejected

Check these common causes:

- `avatar.manifest.json` is missing or has `schemaVersion` other than `1`.
- A state, trigger, or runtime name is not in the shared contract.
- A referenced file is missing, absolute, remote, or contains `..` traversal.
- The package contains a symlink escaping its root, unsafe SVG content, a bad checksum, or exceeds the package limits.
- Pixi metadata exceeds 4096 texture dimensions, 4096 frames, or 16,384 clip references.

Open the manifest as JSON, fix the reported path, and import again. Remove a broken copy with `Codex Avatar: Delete Imported Avatar Package` before retrying the same id.

## Generated SVG is missing or looks too complex

Use `Codex Avatar: Vectorize Image to SVG` with a local PNG, JPG, JPEG, or WEBP. Confirm the preview before saving. The trace is monochrome and intended for reference shapes; clean the output into named layers for animation. See [ASSET_PIPELINE.md](ASSET_PIPELINE.md).

## Blender export fails

Blender is optional. Set `codexAvatar.blenderPath`, put `blender` on `PATH`, or set `BLENDER_PATH`, then verify `blender --version`. The workspace must be trusted. Export is written to `.codex-avatar/exports/blender/` and never replaces the source `.blend` file. See [BLENDER_PIPELINE.md](BLENDER_PIPELINE.md).

## Tests fail locally

Use Node 22.22.0 and pnpm 11.7.0, run `pnpm install --frozen-lockfile`, and retry `pnpm run ci`. `pnpm smoke:webview` needs Microsoft Edge; `pnpm smoke:vsix` is a clean extraction/runtime smoke and does not install an extension into the active editor.

For a real isolated install, run `pnpm run smoke:clean-profile` after packaging. That script uses the VS Code **CLI shim** (`…/bin/code.cmd` on Windows, or `code` on PATH) with temporary `--extensions-dir` and `--user-data-dir` folders.

Do **not** invoke `Code.exe` directly for `--install-extension`. The GUI binary can leave the shell hung for minutes while VS Code stays open. If a command is stuck after using `Code.exe`, cancel the shell job; leave your normal VS Code session alone (it uses `%APPDATA%\Code`, not the temp profile dirs).

## Performance or motion concerns

Set frame rate to 30, animation intensity to Low, enable Focus Mode, enable reduced motion, or set `noAnimation`. Hidden Webviews pause the Pixi ticker. `Codex Avatar: Clear Generated Cache` removes generated intermediates but preserves imported packages and exports. See [PERFORMANCE.md](PERFORMANCE.md).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.argv[2] ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));

if (!existsSync(vsixPath)) throw new Error(`VSIX does not exist: ${vsixPath}`);

const entries = execFileSync("tar", ["-tf", vsixPath], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);
const entrySet = new Set(entries);

for (const required of [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/package.json",
  "extension/dist/extension.js",
  "extension/media/webview/index.html",
  "extension/media/webview/index.js",
  "extension/media/webview/index.css",
  "extension/media/avatars/avatar.manifest.json",
  "extension/media/avatars/svg/placeholder-avatar.svg",
  "extension/media/avatars/pixi/placeholder-spritesheet.svg",
  "extension/media/avatars/pixi/placeholder-spritesheet.json",
  "extension/LICENSE.txt",
  "extension/THIRD_PARTY_NOTICES.md",
  "extension/changelog.md"
]) {
  assert.ok(entrySet.has(required), `VSIX contains ${required}`);
}

const forbiddenPatterns = [
  /(^|\/)src\//i,
  /(^|\/)test\//i,
  /(^|\/)node_modules\//i,
  /(^|\/)AGENTS\.md$/i,
  /\.(?:ts|tsx|map|tsbuildinfo)$/i,
  /(^|\/)(?:research|fixtures|optional-sdk)\//i,
  /\.(?:moc3|model3\.json|cubism)$/i
];
for (const entry of entries) {
  assert.equal(
    forbiddenPatterns.some((pattern) => pattern.test(entry)),
    false,
    `VSIX excludes development or proprietary asset ${entry}`
  );
}

assert.ok(
  entries.some((entry) => entry.endsWith("/placeholder-avatar.svg")),
  "VSIX contains the clean-room SVG fallback"
);
assert.ok(
  entries.some((entry) => entry.endsWith("/placeholder-spritesheet.svg")),
  "VSIX contains the clean-room Pixi avatar"
);

console.log(`VSIX contents validated: ${path.basename(vsixPath)} (${entries.length} files)`);

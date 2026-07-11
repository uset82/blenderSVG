import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const webviewRoot = fileURLToPath(new URL("..", import.meta.url));
const webviewOutput = path.resolve(webviewRoot, "..", "extension", "media", "webview");

test("webview build emits the SVG base entry and keeps other runtimes lazy", async () => {
  const files = await readdir(webviewOutput);

  assert.ok(files.includes("index.html"), "index.html is emitted");
  assert.ok(files.includes("index.js"), "index.js is emitted");
  assert.ok(files.includes("index.css"), "index.css is emitted");
  const deferredRuntimeChunks = files.filter((fileName) =>
    /rive|live2d|gltf|three|WebGLAvatarRenderer|WebGPUAvatarRenderer/i.test(fileName)
  );
  assert.deepEqual(deferredRuntimeChunks, [], "deferred optional runtime chunks stay out of the Webview bundle");
});

test("webview bundle includes asset manager bridge actions", async () => {
  const html = await readFile(path.join(webviewOutput, "index.html"), "utf8");
  const script = await readFile(path.join(webviewOutput, "index.js"), "utf8");
  const styles = await readFile(path.join(webviewOutput, "index.css"), "utf8");

  assert.ok(html.includes('<div id="root"></div>'), "React root is present");
  assert.ok(styles.includes(".asset-manager-panel"), "asset manager styles are bundled");
  assert.match(styles, /pointer-events:\s*none/, "avatar surfaces do not capture pointer input");

  for (const command of [
    "command:openAssetsFolder",
    "command:reloadAvatar",
    "command:vectorizeImage",
    "command:exportBlender"
  ]) {
    assert.ok(script.includes(command), `${command} is wired into the bundle`);
  }

  assert.ok(script.includes("assets:manifestLoaded"), "manifest reload message is handled");
  assert.ok(script.includes("License"), "license metadata is visible in the asset manager");
  assert.ok(script.includes("noAnimation"), "no-animation setting is wired into the Webview");
  assert.match(styles, /forced-colors:\s*active/, "high-contrast styles are bundled");
});

test("webview source does not call remote network APIs", async () => {
  const sourceFiles = await readSourceFiles(path.join(webviewRoot, "src"));
  const bannedTokens = ["fetch(", "new WebSocket", "XMLHttpRequest", "EventSource", "navigator.sendBeacon"];

  for (const filePath of sourceFiles) {
    const source = await readFile(filePath, "utf8");
    for (const token of bannedTokens) {
      assert.equal(source.includes(token), false, `${path.relative(webviewRoot, filePath)} uses ${token}`);
    }
  }
});

async function readSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readSourceFiles(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

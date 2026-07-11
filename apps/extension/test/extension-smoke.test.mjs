import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(extensionRoot, relativePath), "utf8"));
}

test("extension manifest activates every contributed command", async () => {
  const manifest = await readJson("package.json");
  const contributedCommands = manifest.contributes.commands.map((command) => command.command);
  const activationEvents = new Set(manifest.activationEvents);
  const requiredCommands = [
    "codexAvatar.openAssistant",
    "codexAvatar.toggleAssistant",
    "codexAvatar.resetSettings",
    "codexAvatar.openAssetsFolder",
    "codexAvatar.reloadAvatar",
    "codexAvatar.setState",
    "codexAvatar.startThinking",
    "codexAvatar.startSpeaking",
    "codexAvatar.emitEvent",
    "codexAvatar.markSuccess",
    "codexAvatar.markError",
    "codexAvatar.vectorizeImage",
    "codexAvatar.exportBlenderScene"
  ];

  assert.ok(activationEvents.has("onView:codexAvatar.assistantView"));
  assert.equal(manifest.contributes.views.codexAvatar[0].id, "codexAvatar.assistantView");

  for (const command of requiredCommands) {
    assert.ok(contributedCommands.includes(command), `${command} is contributed`);
  }

  for (const command of contributedCommands) {
    assert.ok(activationEvents.has(`onCommand:${command}`), `${command} has an activation event`);
  }
});

test("compiled extension registers commands and keeps webview CSP strict", async () => {
  const extensionSource = await readFile(path.join(extensionRoot, "dist", "extension.js"), "utf8");
  const providerSource = await readFile(path.join(extensionRoot, "dist", "AvatarWebviewProvider.js"), "utf8");

  for (const command of [
    "codexAvatar.openAssistant",
    "codexAvatar.toggleAssistant",
    "codexAvatar.resetSettings",
    "codexAvatar.openAssetsFolder",
    "codexAvatar.reloadAvatar",
    "codexAvatar.setState",
    "codexAvatar.startThinking",
    "codexAvatar.startSpeaking",
    "codexAvatar.emitEvent",
    "codexAvatar.markSuccess",
    "codexAvatar.markError",
    "codexAvatar.vectorizeImage",
    "codexAvatar.exportBlenderScene"
  ]) {
    assert.ok(extensionSource.includes(command), `${command} is present in compiled activation code`);
  }

  assert.ok(providerSource.includes("Content-Security-Policy"), "webview has a CSP meta tag");
  assert.ok(providerSource.includes("default-src 'none'"), "webview denies default remote content");
  assert.ok(providerSource.includes("assets:manifestLoaded"), "asset reload message is compiled");
  assert.ok(providerSource.includes("asWebviewUri"), "local assets use VS Code webview URIs");
});

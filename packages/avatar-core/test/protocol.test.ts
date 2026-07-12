import assert from "node:assert/strict";
import { test } from "vitest";
import {
  AVATAR_PROTOCOL_VERSION,
  createExtensionToWebviewMessage,
  createWebviewToExtensionMessage,
  isProtocolSerializable,
  parseExtensionToWebviewMessage,
  parseWebviewToExtensionMessage,
  type AvatarConfig,
  type AvatarManifest,
  type ExtensionToWebviewMessageInput,
  type WebviewToExtensionMessageInput
} from "../src/index.js";

const config: AvatarConfig = {
  enabled: true,
  runtime: "svg",
  position: "activity-bar-view",
  character: "default",
  animationIntensity: "medium",
  frameRate: 30,
  particleEffects: true,
  soundEnabled: false,
  lipSyncEnabled: false,
  idleTimeout: 15,
  sleepTimeout: 300,
  debugOverlay: false,
  noAnimation: false,
  focusMode: false,
  showSpeechBubble: true,
  respectReducedMotion: true,
  blenderPath: "",
  assetWorkspace: ".codex-avatar"
};

const manifest: AvatarManifest = {
  schemaVersion: 1,
  id: "default-coder-orb",
  name: "Default Coder Orb",
  version: "0.1.0",
  author: "Codex Avatar Studio contributors",
  license: "UNLICENSED (original project work)",
  preferredRuntime: "svg",
  fallbackRuntime: "svg",
  entrypoints: { svg: "avatars/svg/placeholder-avatar.svg" },
  capabilities: ["state-animation", "reduced-motion"],
  states: { idle: "idle_loop" }
};

const extensionMessages: ExtensionToWebviewMessageInput[] = [
  { type: "avatar:initialize", config, manifest },
  { type: "avatar:setState", state: "thinking" },
  { type: "avatar:trigger", trigger: "blink" },
  { type: "avatar:setMessage", text: "Thinking." },
  { type: "avatar:setPoseInput", input: { speechLevel: 0.4 } },
  { type: "settings:update", config },
  { type: "assets:manifestLoaded", manifest },
  { type: "debug:event", event: "test", payload: { ok: true } }
];

const webviewMessages: WebviewToExtensionMessageInput[] = [
  { type: "webview:ready" },
  { type: "command:toggleAssistant" },
  { type: "command:resetSettings" },
  { type: "command:openAssetsFolder" },
  { type: "command:reloadAvatar" },
  { type: "command:vectorizeImage" },
  { type: "command:exportBlender" },
  { type: "settings:update", config: { focusMode: true } },
  { type: "debug:log", message: "test", payload: ["ok"] }
];

test("all extension-to-Webview message variants are versioned, serializable, and parseable", () => {
  for (const input of extensionMessages) {
    const message = createExtensionToWebviewMessage(input);
    assert.equal(message.protocolVersion, AVATAR_PROTOCOL_VERSION);
    assert.equal(parseExtensionToWebviewMessage(JSON.parse(JSON.stringify(message))).success, true);
    assert.equal(isProtocolSerializable(message), true);
  }
});

test("all Webview-to-extension message variants are versioned, serializable, and parseable", () => {
  for (const input of webviewMessages) {
    const message = createWebviewToExtensionMessage(input);
    assert.equal(message.protocolVersion, AVATAR_PROTOCOL_VERSION);
    assert.equal(parseWebviewToExtensionMessage(JSON.parse(JSON.stringify(message))).success, true);
    assert.equal(isProtocolSerializable(message), true);
  }
});

test("unknown types and protocol versions are rejected without throwing", () => {
  assert.doesNotThrow(() => {
    const unknown = parseWebviewToExtensionMessage({ protocolVersion: AVATAR_PROTOCOL_VERSION, type: "unknown:event" });
    const wrongVersion = parseWebviewToExtensionMessage({ protocolVersion: 999, type: "webview:ready" });
    assert.equal(unknown.success, false);
    assert.equal(wrongVersion.success, false);
  });
});

test("malformed payloads are rejected at the runtime boundary", () => {
  const result = parseExtensionToWebviewMessage({
    protocolVersion: AVATAR_PROTOCOL_VERSION,
    type: "avatar:setPoseInput",
    input: { speechLevel: 2 }
  });

  assert.equal(result.success, false);
});

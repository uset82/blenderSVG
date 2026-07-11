import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));

if (!existsSync(vsixPath)) {
  throw new Error(`VSIX does not exist: ${vsixPath}`);
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-vsix-smoke-"));
extractVsix(vsixPath, tempRoot);
const installedExtensionDir = path.join(tempRoot, "extension");
const vscodeMockDir = path.join(installedExtensionDir, "node_modules", "vscode");
mkdirSync(vscodeMockDir, { recursive: true });
writeFileSync(path.join(vscodeMockDir, "index.js"), createVscodeMockSource(), "utf8");

const requireInstalled = createRequire(path.join(installedExtensionDir, "dist", "extension.js"));
const extension = requireInstalled(path.join(installedExtensionDir, "dist", "extension.js"));
const vscode = requireInstalled("vscode");
const context = {
  extensionUri: { fsPath: installedExtensionDir },
  subscriptions: []
};

extension.activate(context);

const requiredCommands = [
  "codexAvatar.openAssistant",
  "codexAvatar.toggleAssistant",
  "codexAvatar.resetSettings",
  "codexAvatar.openAssetsFolder",
  "codexAvatar.reloadAvatar",
  "codexAvatar.importAvatar",
  "codexAvatar.removeAvatar",
  "codexAvatar.deleteImportedAvatar",
  "codexAvatar.activateAvatar",
  "codexAvatar.clearCache",
  "codexAvatar.setState",
  "codexAvatar.startThinking",
  "codexAvatar.startSpeaking",
  "codexAvatar.markSuccess",
  "codexAvatar.markError",
  "codexAvatar.vectorizeImage",
  "codexAvatar.exportBlenderScene"
];

for (const command of requiredCommands) {
  assert.ok(vscode.__registeredCommands.has(command), `${command} registered after install`);
}

const provider = vscode.__registeredViewProviders.get("codexAvatar.assistantView");
assert.equal(provider?.constructor.name, "AvatarWebviewProvider");
assert.ok(context.subscriptions.length >= requiredCommands.length, "activation adds disposables");

const webviewSmoke = createWebviewSmoke();
provider.resolveWebviewView({ webview: webviewSmoke.webview });

assert.equal(webviewSmoke.webview.options.enableScripts, true, "webview scripts are enabled for bundled UI");
assert.match(webviewSmoke.webview.html, /Content-Security-Policy/, "webview HTML includes CSP");
assert.match(webviewSmoke.webview.html, /default-src 'none'/, "webview denies default remote content");
assert.match(webviewSmoke.webview.html, /<div id="root"><\/div>/, "webview contains the React root");
assert.ok(webviewSmoke.handlers.length > 0, "webview receive handler is registered");

await webviewSmoke.handlers[0]({ protocolVersion: 1, type: "webview:ready" });
await new Promise((resolve) => setTimeout(resolve, 25));
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "settings:update"),
  "webview ready posts settings"
);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "avatar:setState"),
  "webview ready posts current state"
);
assert.ok(
  webviewSmoke.messages.some(
    (message) =>
      message.type === "assets:manifestLoaded" && message.manifest.entrypoints.svg.includes("placeholder-avatar.svg")
  ),
  "webview ready receives the placeholder SVG fallback manifest"
);

await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "settings:update",
  config: { runtime: "webgl", showSpeechBubble: false }
});
await new Promise((resolve) => setTimeout(resolve, 25));
assert.equal(vscode.__configStore.get("runtime"), "webgl");
assert.equal(vscode.__configStore.get("showSpeechBubble"), false);

vscode.__quickPickValue = "thinking";
await vscode.commands.executeCommand("codexAvatar.openAssistant");
await vscode.commands.executeCommand("codexAvatar.toggleAssistant");
await vscode.commands.executeCommand("codexAvatar.resetSettings");
await vscode.commands.executeCommand("codexAvatar.openAssetsFolder");
await vscode.commands.executeCommand("codexAvatar.reloadAvatar");
await vscode.commands.executeCommand("codexAvatar.setState");
await vscode.commands.executeCommand("codexAvatar.startThinking");
await vscode.commands.executeCommand("codexAvatar.startSpeaking");
await vscode.commands.executeCommand("codexAvatar.markSuccess");
await vscode.commands.executeCommand("codexAvatar.markError");
await vscode.commands.executeCommand("codexAvatar.vectorizeImage");
vscode.__configStore.set("blenderPath", process.execPath);
await vscode.commands.executeCommand("codexAvatar.exportBlenderScene");

assert.ok(
  vscode.__executedCommands.has("workbench.view.extension.codexAvatar"),
  "open assistant focuses view container"
);
assert.ok(vscode.__executedCommands.has("revealFileInOS"), "open assets folder reveals local folder");
assert.ok(vscode.__createdDirectories.length > 0, "open assets folder creates local asset workspace");
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "assets:manifestLoaded"),
  "reload posts manifest"
);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "avatar:trigger"),
  "manual commands post triggers"
);

extension.deactivate?.();

console.log(`VSIX package, activation, command, and webview smoke passed: ${installedExtensionDir}`);

function extractVsix(vsixFile, outputDirectory) {
  execFileSync("tar", ["-xf", vsixFile, "-C", outputDirectory], { stdio: "inherit" });
}

function createVscodeMockSource() {
  return String.raw`
const registeredCommands = new Map();
const registeredViewProviders = new Map();
const executedCommands = new Set();
const createdDirectories = [];
const disposable = () => ({ dispose() {} });
const configStore = new Map();

const Uri = {
  file: fsPath => ({ fsPath, toString: () => fsPath }),
  joinPath: (base, ...segments) => ({
    fsPath: [base.fsPath, ...segments].join("/"),
    toString: () => [base.fsPath, ...segments].join("/")
  })
};

module.exports = {
  __registeredCommands: registeredCommands,
  __registeredViewProviders: registeredViewProviders,
  __executedCommands: executedCommands,
  __createdDirectories: createdDirectories,
  __configStore: configStore,
  __quickPickValue: undefined,
  ConfigurationTarget: { Global: 1 },
  DiagnosticSeverity: { Error: 0, Warning: 1 },
  Uri,
  commands: {
    executeCommand: async (command, ...args) => {
      executedCommands.add(command);
      return registeredCommands.has(command) ? registeredCommands.get(command)(...args) : undefined;
    },
    registerCommand(command, callback) {
      registeredCommands.set(command, callback);
      return disposable();
    }
  },
  debug: {
    onDidStartDebugSession: () => disposable(),
    onDidTerminateDebugSession: () => disposable()
  },
  languages: {
    getDiagnostics: () => [],
    onDidChangeDiagnostics: () => disposable()
  },
  tasks: {
    onDidStartTask: () => disposable(),
    onDidEndTask: () => disposable()
  },
  window: {
    createOutputChannel: () => ({
      append() {},
      appendLine() {},
      dispose() {},
      show() {}
    }),
    onDidChangeActiveTextEditor: () => disposable(),
    onDidOpenTerminal: () => disposable(),
    onDidCloseTerminal: () => disposable(),
    registerWebviewViewProvider(viewType, provider) {
      registeredViewProviders.set(viewType, provider);
      return disposable();
    },
    showErrorMessage: () => undefined,
    showInformationMessage: () => undefined,
    showOpenDialog: async () => undefined,
    showQuickPick: async () => module.exports.__quickPickValue,
    showTextDocument: async () => undefined,
    showWarningMessage: () => undefined
  },
  workspace: {
    isTrusted: true,
    fs: {
      createDirectory: async uri => {
        createdDirectories.push(uri.fsPath);
      }
    },
    getConfiguration: () => ({
      get: (key, fallback) => configStore.has(key) ? configStore.get(key) : fallback,
      update: async (key, value) => {
        if (value === undefined) {
          configStore.delete(key);
        } else {
          configStore.set(key, value);
        }
      }
    }),
    onDidChangeConfiguration: () => disposable(),
    onDidChangeTextDocument: () => disposable(),
    onDidSaveTextDocument: () => disposable(),
    onDidGrantWorkspaceTrust: () => disposable(),
    openTextDocument: async uri => ({ uri }),
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }]
  }
};
`;
}

function createWebviewSmoke() {
  const messages = [];
  const handlers = [];
  const webview = {
    cspSource: "vscode-webview://codex-avatar-studio",
    html: "",
    options: {},
    asWebviewUri(uri) {
      const fsPath = uri.fsPath.replace(/\\/g, "/");
      return {
        fsPath,
        toString: () => `vscode-webview://codex-avatar-studio/${fsPath.replace(/^[A-Za-z]:/, "")}`
      };
    },
    onDidReceiveMessage(handler) {
      handlers.push(handler);
      return { dispose() {} };
    },
    postMessage(message) {
      messages.push(message);
      return Promise.resolve(true);
    }
  };

  return { handlers, messages, webview };
}

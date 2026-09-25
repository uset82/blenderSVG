import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { extractZip } from "./lib/zip.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));
const offline = process.env.SMOKE_OFFLINE === "1";
let outboundFetches = 0;
if (offline) {
  globalThis.fetch = async () => {
    outboundFetches += 1;
    throw new Error("Network is unavailable in the offline Studio smoke.");
  };
}

if (!existsSync(vsixPath)) {
  throw new Error(`VSIX does not exist: ${vsixPath}`);
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-vsix-smoke-"));
extractVsix(vsixPath, tempRoot);
const installedExtensionDir = path.join(tempRoot, "extension");
const bundledWorkerPath = path.join(installedExtensionDir, "dist", "vectorizeWorker.js");
assert.equal(existsSync(bundledWorkerPath), true, "installed VSIX contains the vectorization worker");
const workerWorkspace = path.join(tempRoot, "worker-workspace");
const workerInput = path.join(workerWorkspace, "fixture.png");
mkdirSync(workerWorkspace, { recursive: true });
writeFileSync(
  workerInput,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
    "base64"
  )
);
const installedWorkerPreview = await runBundledVectorPreview(bundledWorkerPath, {
  inputPath: workerInput,
  workspaceRoot: workerWorkspace,
  outputBaseName: "fixture",
  preprocessing: {
    grayscale: false,
    quantizationLevels: 16,
    removeBackground: true,
    noiseReduction: 10,
    detail: "balanced"
  },
  maxSvgBytes: 1_000_000,
  maxSvgPaths: 20_000
});
assert.match(installedWorkerPreview.optimizedSvg, /<svg/i, "installed worker decodes and traces a real PNG");
assert.ok(installedWorkerPreview.optimizedValidation.pathCount > 0, "installed worker returns SVG metrics");
assert.equal(
  existsSync(path.join(workerWorkspace, ".codex-avatar", "exports")),
  false,
  "worker preview writes no committed export"
);
const vscodeMockDir = path.join(installedExtensionDir, "node_modules", "vscode");
mkdirSync(vscodeMockDir, { recursive: true });
writeFileSync(path.join(vscodeMockDir, "index.js"), createVscodeMockSource(), "utf8");

const requireInstalled = createRequire(path.join(installedExtensionDir, "dist", "extension.js"));
const extension = requireInstalled(path.join(installedExtensionDir, "dist", "extension.js"));
const vscode = requireInstalled("vscode");
const activationWorkspace = path.join(tempRoot, "activation-workspace");
mkdirSync(activationWorkspace, { recursive: true });
vscode.__workspaceRoot = activationWorkspace;
const context = {
  extensionUri: { fsPath: installedExtensionDir },
  secrets: {
    get: async () => undefined,
    store: async () => undefined,
    delete: async () => undefined
  },
  subscriptions: []
};

extension.activate(context);

const requiredCommands = [
  "codexAvatar.openAssistant",
  "codexAvatar.openStudio",
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
  "codexAvatar.createFromPicture",
  "codexAvatar.vectorizeImage",
  "codexAvatar.exportBlenderScene"
];

for (const command of requiredCommands) {
  assert.ok(vscode.__registeredCommands.has(command), `${command} registered after install`);
}

const provider = vscode.__registeredViewProviders.get("codexAvatar.assistantView");
assert.equal(provider?.constructor.name, "AvatarWebviewProvider");
assert.ok(context.subscriptions.length >= requiredCommands.length, "activation adds disposables");

await vscode.__registeredCommands.get("codexAvatar.openStudio")();
const studioPanel = vscode.__createdPanels.at(-1);
assert.ok(studioPanel, "Studio opens in an editor WebviewPanel");
assert.match(studioPanel.webview.html, /default-src 'none'/, "Studio panel denies remote default content");
assert.match(studioPanel.webview.html, /media\/studio\/assets\/index-[^" ]+\.js/i, "Studio loads bundled JS");
assert.doesNotMatch(studioPanel.webview.html, /https:\/\/fonts\./i, "Studio has no remote font dependency");
await studioPanel.handlers[0]({ protocolVersion: 1, type: "studio:ready" });
const studioState = await waitForMessage(studioPanel.messages, "studio:hostState");
assert.equal(studioState.host, "vscode");
assert.equal(studioState.connection.status, "disconnected");
await studioPanel.handlers[0]({
  protocolVersion: 1,
  type: "studio:openRouterConnection",
  action: "test",
  apiKey: "forbidden"
});
assert.equal(studioPanel.messages.length, 1, "Studio rejects a message carrying a credential field");
if (offline) {
  await studioPanel.handlers[0]({ protocolVersion: 1, type: "studio:modelCatalogRequest" });
  const catalog = await waitForMessage(studioPanel.messages, "studio:modelCatalog");
  assert.equal(catalog.status, "error", "an empty secret store leaves the catalog unavailable");
  await studioPanel.handlers[0]({
    protocolVersion: 1,
    type: "studio:chatRequest",
    requestId: "offline-chat-request",
    modelId: "example/model",
    history: [],
    userMessage: "offline smoke"
  });
  const chatError = await waitForMessage(
    studioPanel.messages,
    "studio:chatError",
    (message) => message.requestId === "offline-chat-request"
  );
  assert.equal(chatError.code, "model-unavailable", "chat remains unavailable without a loaded model");
  assert.equal(outboundFetches, 0, "Studio startup and no-key actions issue no network requests");
}
const savedStudioProject = await verifyInstalledStudioProjectRoundTrip(studioPanel, activationWorkspace);

const webviewSmoke = createWebviewSmoke();
provider.resolveWebviewView(webviewSmoke.view);

assert.equal(webviewSmoke.webview.options.enableScripts, true, "webview scripts are enabled for bundled UI");
assert.match(webviewSmoke.webview.html, /Content-Security-Policy/, "webview HTML includes CSP");
assert.match(webviewSmoke.webview.html, /default-src 'none'/, "webview denies default remote content");
assert.match(webviewSmoke.webview.html, /<div id="root"><\/div>/, "webview contains the React root");
assert.ok(webviewSmoke.handlers.length > 0, "webview receive handler is registered");

await webviewSmoke.handlers[0]({ protocolVersion: 1, type: "webview:ready" });
await Promise.all([
  waitForMessage(webviewSmoke.messages, "settings:update"),
  waitForMessage(webviewSmoke.messages, "avatar:setState"),
  waitForMessage(webviewSmoke.messages, "blender:status"),
  waitForMessage(webviewSmoke.messages, "assets:manifestLoaded")
]);
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
    (message) => message.type === "blender:status" && message.availability === "missing" && message.busy === false
  ),
  "webview ready posts the optional Blender connection state"
);
assert.ok(
  webviewSmoke.messages.some(
    (message) =>
      message.type === "assets:manifestLoaded" && message.manifest.entrypoints.svg.includes("placeholder-avatar.svg")
  ),
  "webview ready receives the placeholder SVG fallback manifest"
);
const initialManifest = webviewSmoke.messages.find((message) => message.type === "assets:manifestLoaded")?.manifest;
assert.match(initialManifest?.entrypoints.svg ?? "", /codexAvatarAssetRevision=\d+/, "SVG URI is cache-versioned");

await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "settings:update",
  config: { runtime: "pixi", showSpeechBubble: false }
});
await new Promise((resolve) => setTimeout(resolve, 25));
assert.equal(vscode.__configStore.get("runtime"), "pixi");
assert.equal(vscode.__configStore.get("showSpeechBubble"), false);

const studioWorkspace = path.join(tempRoot, "studio-workspace");
const studioSource = path.join(tempRoot, "studio-source.png");
const studioSourceBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);
mkdirSync(studioWorkspace, { recursive: true });
writeFileSync(studioSource, studioSourceBytes);
vscode.__workspaceRoot = studioWorkspace;
vscode.__openDialogValue = [{ fsPath: studioSource }];
await webviewSmoke.handlers[0]({ protocolVersion: 1, type: "studio:chooseImage" });
const selectedPicture = await waitForMessage(webviewSmoke.messages, "studio:imageSelected");
await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "studio:vectorizeImage",
  jobId: selectedPicture.selection.jobId,
  revision: 1,
  options: {
    preset: "color-illustration",
    grayscale: false,
    colorCount: 16,
    threshold: null,
    removeNearWhite: true,
    noiseReduction: 10,
    detail: "balanced"
  }
});
await waitForMessage(webviewSmoke.messages, "studio:vectorPreview");
await webviewSmoke.handlers[0]({
  protocolVersion: 1,
  type: "studio:saveAvatar",
  jobId: selectedPicture.selection.jobId,
  revision: 1,
  metadata: {
    id: "installed-studio-avatar",
    name: "Installed Studio Avatar",
    author: "VSIX Smoke",
    version: "1.0.0",
    license: "UNLICENSED"
  },
  collisionAction: "reject"
});
await waitForMessage(webviewSmoke.messages, "studio:packageSaved");
await waitForMessage(
  webviewSmoke.messages,
  "assets:manifestLoaded",
  (message) => message.manifest.id === "installed-studio-avatar"
);
const installedAvatarRoot = path.join(studioWorkspace, ".codex-avatar", "avatars", "installed-studio-avatar");
assert.equal(
  existsSync(path.join(installedAvatarRoot, "avatar.manifest.json")),
  true,
  "installed Studio saves manifest"
);
assert.equal(existsSync(path.join(installedAvatarRoot, "svg", "avatar.svg")), true, "installed Studio saves SVG");
assert.deepEqual(readFileSync(studioSource), studioSourceBytes, "installed Studio preserves the selected source");
assert.equal(vscode.__configStore.get("character"), "installed-studio-avatar", "installed Studio activates avatar id");
assert.equal(vscode.__configStore.get("runtime"), "svg", "installed Studio activates SVG runtime");
vscode.__openDialogValue = undefined;

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
await vscode.commands.executeCommand("codexAvatar.createFromPicture");
await vscode.commands.executeCommand("codexAvatar.vectorizeImage");
vscode.__configStore.set("blenderPath", process.execPath);
await vscode.commands.executeCommand("codexAvatar.exportBlenderScene");
assert.ok(
  webviewSmoke.messages.filter((message) => message.type === "blender:status").length >= 2,
  "installed export command reports a typed Blender probe result"
);

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
const manifestMessages = webviewSmoke.messages.filter((message) => message.type === "assets:manifestLoaded");
assert.ok(manifestMessages.length >= 2, "reload posts a fresh manifest");
assert.notEqual(
  manifestMessages.at(-1).manifest.entrypoints.svg,
  initialManifest.entrypoints.svg,
  "reload changes the SVG cache revision"
);
assert.ok(
  webviewSmoke.messages.some((message) => message.type === "avatar:trigger"),
  "manual commands post triggers"
);

extension.deactivate?.();
await verifyInstalledStudioProjectRestart(extension, vscode, context, activationWorkspace, savedStudioProject);

console.log(`VSIX package, activation, Studio project round-trip, and webview smoke passed: ${installedExtensionDir}`);

async function verifyInstalledStudioProjectRoundTrip(panel, workspaceRoot) {
  const projectId = randomUUID();
  const filePath = path.join(workspaceRoot, ".codex-avatar", "studio", "projects", `${projectId}.json`);
  const initialSnapshot = JSON.stringify({
    document: {
      schema: { schemaVersion: 2, sequences: {} },
      store: { "shape:fixture": { id: "shape:fixture", typeName: "shape", type: "geo", x: 24, y: 40 } }
    }
  });
  const editedSnapshot = JSON.stringify({
    document: {
      schema: { schemaVersion: 2, sequences: {} },
      store: { "shape:fixture": { id: "shape:fixture", typeName: "shape", type: "geo", x: 160, y: 40 } }
    }
  });

  panel.handlers[0]({ protocolVersion: 1, type: "studio:projectListRequest" });
  const initialList = await waitForMessage(panel.messages, "studio:projectList");
  assert.equal(initialList.status, "ready", "installed Studio lists its local workspace");
  assert.deepEqual(initialList.projects, [], "new workspace begins with no Studio projects");

  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectSave",
    requestId: "project-create-fixture",
    projectId,
    title: "Round trip fixture",
    snapshot: initialSnapshot
  });
  await waitForMessage(
    panel.messages,
    "studio:projectSaved",
    (message) => message.requestId === "project-create-fixture"
  );
  assert.equal(existsSync(filePath), true, "installed Studio writes a versioned project file");

  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectSave",
    requestId: "project-edit-first",
    projectId,
    title: "Round trip fixture",
    snapshot: initialSnapshot
  });
  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectSave",
    requestId: "project-edit-latest",
    projectId,
    title: "Edited canvas",
    snapshot: editedSnapshot
  });
  await waitForMessage(panel.messages, "studio:projectSaved", (message) => message.requestId === "project-edit-latest");
  assert.equal(JSON.parse(readFileSync(filePath, "utf8")).snapshot, editedSnapshot, "latest queued edit wins");
  assert.equal(
    readdirSync(path.dirname(filePath)).some((entry) => entry.endsWith(".tmp")),
    false,
    "successful atomic saves leave no temporary project file"
  );

  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectOpen",
    requestId: "project-reopen-fixture",
    projectId
  });
  const reopened = await waitForMessage(
    panel.messages,
    "studio:projectOpened",
    (message) => message.requestId === "project-reopen-fixture"
  );
  assert.equal(reopened.project.title, "Edited canvas");
  assert.equal(reopened.project.snapshot, editedSnapshot, "reopened project retains its edited shape data");
  return { projectId, filePath, snapshot: editedSnapshot };
}

async function verifyInstalledStudioProjectRestart(extension, vscode, context, workspaceRoot, savedProject) {
  vscode.__workspaceRoot = workspaceRoot;
  extension.activate({ ...context, subscriptions: [] });
  await vscode.__registeredCommands.get("codexAvatar.openStudio")();
  const panel = vscode.__createdPanels.at(-1);
  panel.handlers[0]({ protocolVersion: 1, type: "studio:projectListRequest" });
  const list = await waitForMessage(panel.messages, "studio:projectList");
  assert.equal(list.status, "ready", "restarted installed host lists projects");
  assert.equal(
    list.projects.some((project) => project.id === savedProject.projectId),
    true
  );

  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectOpen",
    requestId: "project-open-after-restart",
    projectId: savedProject.projectId
  });
  const reopened = await waitForMessage(
    panel.messages,
    "studio:projectOpened",
    (message) => message.requestId === "project-open-after-restart"
  );
  assert.equal(reopened.project.snapshot, savedProject.snapshot, "edited canvas survives host restart");

  const fsPromises = requireInstalled("node:fs/promises");
  const originalRename = fsPromises.rename;
  const bytesBeforeFailedSave = readFileSync(savedProject.filePath, "utf8");
  fsPromises.rename = async (source, target) => {
    if (path.basename(target) === `${savedProject.projectId}.json`) {
      throw Object.assign(new Error("Injected atomic rename failure"), { code: "EACCES" });
    }
    return originalRename(source, target);
  };
  try {
    panel.handlers[0]({
      protocolVersion: 1,
      type: "studio:projectSave",
      requestId: "project-save-rename-failed",
      projectId: savedProject.projectId,
      title: "Changed during failed save",
      snapshot: savedProject.snapshot
    });
    const ioError = await waitForMessage(
      panel.messages,
      "studio:projectError",
      (message) => message.requestId === "project-save-rename-failed"
    );
    assert.equal(ioError.code, "io", "failed atomic rename reports an I/O error");
    assert.equal(
      readFileSync(savedProject.filePath, "utf8"),
      bytesBeforeFailedSave,
      "failed save keeps last good file"
    );
    assert.equal(
      readdirSync(path.dirname(savedProject.filePath)).some((entry) => entry.endsWith(".tmp")),
      false,
      "failed atomic save removes its temporary file"
    );
  } finally {
    fsPromises.rename = originalRename;
  }

  const goodFile = readFileSync(savedProject.filePath, "utf8");
  writeFileSync(savedProject.filePath, "{damaged-json", "utf8");
  panel.handlers[0]({ protocolVersion: 1, type: "studio:projectListRequest" });
  const damagedList = await waitForMessage(
    panel.messages,
    "studio:projectList",
    (message) => message.corruptCount === 1
  );
  assert.equal(
    damagedList.projects.some((project) => project.id === savedProject.projectId),
    false
  );
  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectOpen",
    requestId: "project-open-damaged",
    projectId: savedProject.projectId
  });
  const openError = await waitForMessage(
    panel.messages,
    "studio:projectError",
    (message) => message.requestId === "project-open-damaged"
  );
  assert.equal(openError.code, "corrupt", "damaged project returns an actionable error");
  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectSave",
    requestId: "project-save-over-damaged",
    projectId: savedProject.projectId,
    title: "Edited canvas",
    snapshot: savedProject.snapshot
  });
  const saveError = await waitForMessage(
    panel.messages,
    "studio:projectError",
    (message) => message.requestId === "project-save-over-damaged"
  );
  assert.equal(saveError.code, "corrupt", "autosave cannot overwrite unreadable project data");
  assert.equal(readFileSync(savedProject.filePath, "utf8"), "{damaged-json", "damaged bytes remain for recovery");

  writeFileSync(savedProject.filePath, goodFile, "utf8");
  panel.handlers[0]({
    protocolVersion: 1,
    type: "studio:projectOpen",
    requestId: "project-open-repaired",
    projectId: savedProject.projectId
  });
  const repaired = await waitForMessage(
    panel.messages,
    "studio:projectOpened",
    (message) => message.requestId === "project-open-repaired"
  );
  assert.equal(repaired.project.snapshot, savedProject.snapshot, "user-repaired project can reopen");
  extension.deactivate?.();
}

function extractVsix(vsixFile, outputDirectory) {
  // The VSIX is a ZIP archive; extract it in Node because GNU tar on Linux cannot read ZIPs.
  extractZip(vsixFile, outputDirectory);
}

function runBundledVectorPreview(workerPath, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { execArgv: ["--no-deprecation"], workerData });
    worker.on("message", (message) => {
      if (message.type === "result") {
        void worker.terminate();
        resolve(message.preview);
      } else if (message.type === "error") {
        void worker.terminate();
        reject(new Error(message.message));
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Installed vectorization worker exited with code ${code}.`));
    });
  });
}

async function waitForMessage(messages, type, predicate = () => true) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const message = messages.find((candidate) => candidate.type === type && predicate(candidate));
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for installed Webview message: ${type}`);
}

function createVscodeMockSource() {
  return String.raw`
const registeredCommands = new Map();
const registeredViewProviders = new Map();
const createdPanels = [];
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
  __createdPanels: createdPanels,
  __executedCommands: executedCommands,
  __createdDirectories: createdDirectories,
  __configStore: configStore,
  __openDialogValue: undefined,
  __quickPickValue: undefined,
  __workspaceRoot: process.cwd(),
  ConfigurationTarget: { Global: 1 },
  ViewColumn: { Active: 1 },
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
  env: {
    clipboard: { writeText: async () => undefined }
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
    createWebviewPanel(_viewType, _title, _column, options) {
      const handlers = [];
      const messages = [];
      const webview = {
        html: "",
        cspSource: "vscode-webview://codex-avatar-studio",
        asWebviewUri(uri) {
          const fsPath = uri.fsPath.replace(/\\/g, "/");
          return { toString: () => "vscode-webview://codex-avatar-studio/" + fsPath.replace(/^[A-Za-z]:/, "") };
        },
        onDidReceiveMessage(handler) { handlers.push(handler); return disposable(); },
        postMessage(message) { messages.push(message); return Promise.resolve(true); }
      };
      const panel = { options, webview, handlers, messages, reveal() {}, onDidDispose: () => disposable(), dispose() {} };
      createdPanels.push(panel);
      return panel;
    },
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
    showOpenDialog: async () => module.exports.__openDialogValue,
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
    get workspaceFolders() {
      return [{ uri: { fsPath: module.exports.__workspaceRoot, scheme: "file" } }];
    }
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

  const view = {
    webview,
    onDidDispose: () => ({ dispose() {} })
  };

  return { handlers, messages, view, webview };
}

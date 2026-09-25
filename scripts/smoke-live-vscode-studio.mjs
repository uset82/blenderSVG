import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));
const codeRoot = path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code");
const codeCli = process.env.CODE_CLI ?? path.join(codeRoot, "bin", "code.cmd");
const codeExe = process.env.CODE_EXE ?? path.join(codeRoot, "Code.exe");

assert.ok(existsSync(vsixPath), `Missing VSIX: ${vsixPath}`);
assert.ok(existsSync(codeCli), `Missing VS Code CLI: ${codeCli}`);
assert.ok(existsSync(codeExe), `Missing VS Code executable: ${codeExe}`);

const attachedPort = Number(process.env.STUDIO_LIVE_PORT ?? 0);
const profileRoot = process.env.STUDIO_LIVE_PROFILE ?? mkdtempSync(path.join(os.tmpdir(), "codex-avatar-live-studio-"));
const userDataDir = path.join(profileRoot, "user-data");
const extensionsDir = path.join(profileRoot, "extensions");
const workspaceDir = path.join(profileRoot, "workspace");
mkdirSync(userDataDir, { recursive: true });
mkdirSync(extensionsDir, { recursive: true });
mkdirSync(workspaceDir, { recursive: true });
const userSettingsDir = path.join(userDataDir, "User");
mkdirSync(userSettingsDir, { recursive: true });
writeFileSync(
  path.join(userSettingsDir, "settings.json"),
  JSON.stringify({ "security.workspace.trust.enabled": false, "workbench.startupEditor": "none" }, null, 2)
);

function runCli(args) {
  const command = [codeCli, ...args].map((argument) => `"${argument.replaceAll('"', '\\"')}"`).join(" ");
  const result = spawnSync(command, { shell: true, encoding: "utf8", windowsHide: true, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`VS Code CLI failed (${result.status}): ${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

const debugPort =
  attachedPort ||
  (await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  }));

if (!attachedPort) {
  console.log(`Profile: ${profileRoot}`);
  console.log(
    runCli([
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      "--install-extension",
      vsixPath,
      "--force"
    ])
  );
  const installed = runCli(["--user-data-dir", userDataDir, "--extensions-dir", extensionsDir, "--list-extensions"]);
  assert.match(installed, /codex-avatar-studio\.codex-avatar-studio-extension/i);
  console.log(installed);
  const child = spawn(
    codeExe,
    [
      "--new-window",
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      `--remote-debugging-port=${debugPort}`,
      "--disable-background-networking",
      "--skip-welcome",
      workspaceDir
    ],
    { detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();
  console.log(`VS Code PID ${child.pid}, CDP ${debugPort}`);
}

const deadline = Date.now() + 30_000;
let targets;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    targets = await response.json();
    if (targets.length) break;
  } catch {
    // VS Code is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
assert.ok(targets?.length, "VS Code did not expose a CDP target");
const projectDir = path.join(workspaceDir, ".codex-avatar", "studio", "projects");
console.log(`Project files: ${projectDir}`);

const workbench = targets.find((target) => target.type === "page" && target.url.includes("workbench.html"));
assert.ok(workbench?.webSocketDebuggerUrl, "VS Code workbench target missing");
const cdp = await connectCdp(workbench.webSocketDebuggerUrl);
await cdp.send("Runtime.enable");
await cdp.send("Page.enable");
if (!targets.some((target) => target.type === "iframe" && target.url.startsWith("vscode-webview://"))) {
  await waitUntil(
    async () => /Explorer|Show All Commands/.test((await evaluate(cdp, "document.body?.innerText")) ?? ""),
    "VS Code workbench UI",
    30_000
  );
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "P",
    code: "KeyP",
    modifiers: 10,
    windowsVirtualKeyCode: 80
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "P",
    code: "KeyP",
    modifiers: 10,
    windowsVirtualKeyCode: 80
  });
  await waitUntil(
    async () => await evaluate(cdp, "Boolean(document.querySelector('.quick-input-widget'))"),
    "Command Palette"
  );
  await cdp.send("Input.insertText", { text: "Codex Avatar: Open Studio" });
  await waitUntil(
    async () =>
      (await evaluate(cdp, "document.querySelector('.quick-input-widget')?.innerText"))?.includes(
        "Codex Avatar: Open Studio"
      ),
    "Open Studio command result"
  );
  assert.match(await evaluate(cdp, "document.body.innerText"), /Codex Avatar: Open Studio/);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
const studioTarget = await waitUntil(
  async () => {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return targets.find((target) => target.type === "iframe" && target.url.startsWith("vscode-webview://"));
  },
  "Studio editor Webview",
  15_000
);
assert.ok(studioTarget?.webSocketDebuggerUrl, "Studio editor Webview did not open");
const studioCdp = await connectCdp(studioTarget.webSocketDebuggerUrl);
await studioCdp.send("Runtime.enable");
const innerDocument = "document.querySelector('iframe')?.contentDocument";
const initialText = await waitUntil(async () => {
  const text = await evaluate(studioCdp, `${innerDocument}?.body?.innerText`);
  return (/Recents/i.test(text ?? "") && /New file/.test(text ?? "")) ||
    (/Auto-saved/.test(text ?? "") && /Agents/.test(text ?? ""))
    ? text
    : undefined;
}, "Studio Webview content");
const isRecentsHome = /Recents/i.test(initialText ?? "") && /New file/.test(initialText ?? "");
const isStudioEditor = /Auto-saved/.test(initialText ?? "") && /Agents/.test(initialText ?? "");
assert.ok(isRecentsHome || isStudioEditor, "Studio Recents or canvas editor is visible");
console.log(`Studio opened: ${initialText?.slice(0, 300)}`);

if (isRecentsHome) {
  const startedProject = await evaluate(
    studioCdp,
    `(() => { const buttons = [...${innerDocument}?.querySelectorAll(".recents__button--primary") ?? []]; const button = buttons.find((item) => item.innerText.trim() === "New file"); button?.click(); return Boolean(button); })()`
  );
  assert.equal(startedProject, true, "New file action is available");
}
const canvasState = await waitUntil(
  async () =>
    await evaluate(
      studioCdp,
      `(() => { const doc = ${innerDocument}; if (doc?.querySelector('.studio-canvas-license')) return 'license-required'; if (doc?.querySelector('.tl-container')) return 'canvas'; return null; })()`
    ),
  "new project canvas or license setup notice"
);
if (canvasState === "license-required") {
  const notice = (await evaluate(studioCdp, `${innerDocument}?.querySelector('.studio-canvas-license')?.innerText`))
    ?.replaceAll(/\s+/g, " ")
    .trim();
  assert.ok(notice, "The missing-license notice explains the production canvas state");
  if (process.env.STUDIO_SKIP_EDIT !== "1") {
    throw new Error(
      `Live canvas acceptance needs a licensed Studio build. Set VITE_TLDRAW_LICENSE_KEY before rebuilding. Notice: ${notice}`
    );
  }
  console.log(`Canvas setup notice: ${notice}`);
  const projectFiles = existsSync(projectDir) ? readdirSync(projectDir).filter((name) => name.endsWith(".json")) : [];
  assert.equal(projectFiles.length, 0, "An unavailable editor does not create a misleading empty project");
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(path.join(profileRoot, "studio-live-license-notice.png"), Buffer.from(screenshot.data, "base64"));
  console.log(
    "Verified installed VS Code Webview opens the project route and explains that editing requires a license."
  );
  studioCdp.close();
  cdp.close();
  process.exit(0);
} else {
  await waitUntil(
    async () => (await evaluate(studioCdp, `${innerDocument}?.body?.innerText`))?.includes("Auto-saved"),
    "new project editor autosave status"
  );
}

await waitUntil(() => {
  const files = existsSync(projectDir) ? readdirSync(projectDir).filter((name) => name.endsWith(".json")) : [];
  return files.length === 1 ? files[0] : undefined;
}, "one autosaved project file");
const [projectFileName] = readdirSync(projectDir).filter((name) => name.endsWith(".json"));
const projectPath = path.join(projectDir, projectFileName);
const initialProject = readProject(projectPath);
const initialGeoCount = countShapes(initialProject, "geo");
console.log(
  `Initial project ${initialProject.id}: ${countShapes(initialProject, "frame")} frame, ${initialGeoCount} rectangles`
);

if (process.env.STUDIO_SKIP_EDIT !== "1") {
  const rectangleFound = await evaluate(
    studioCdp,
    `Boolean(${innerDocument}?.querySelector('button[aria-label="Rectangle (R)"]'))`
  );
  assert.equal(rectangleFound, true, "Rectangle canvas tool is visible");
  const canvasLocalBounds = await evaluate(
    studioCdp,
    `(() => { const frame = document.querySelector("iframe"); const canvas = frame?.contentDocument?.querySelector(".tl-container"); if (!frame || !canvas) return null; const frameRect = frame.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect(); return { x: frameRect.x + canvasRect.x, y: frameRect.y + canvasRect.y, width: canvasRect.width, height: canvasRect.height }; })()`
  );
  const webviewBounds = await evaluate(
    cdp,
    `(() => { const frame = [...document.querySelectorAll("iframe")].find((item) => item.src.startsWith("vscode-webview://")); if (!frame) return null; const rect = frame.getBoundingClientRect(); return { x: rect.x, y: rect.y }; })()`
  );
  assert.ok(
    canvasLocalBounds && webviewBounds,
    "Canvas and Webview bounds are available for the live editor interaction"
  );
  const canvasBounds = {
    x: canvasLocalBounds.x + webviewBounds.x,
    y: canvasLocalBounds.y + webviewBounds.y,
    width: canvasLocalBounds.width,
    height: canvasLocalBounds.height
  };
  console.log("Live canvas bounds:", canvasBounds);
  writeFileSync(
    path.join(profileRoot, "studio-live-before-edit.png"),
    Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true })).data, "base64")
  );
  await evaluate(studioCdp, `${innerDocument}.querySelector('button[aria-label="Rectangle (R)"]').click()`);
  console.log(
    "Active canvas tools:",
    await evaluate(
      studioCdp,
      `[...${innerDocument}.querySelectorAll(".studio-toolbar__button")].filter((button) => button.getAttribute("aria-pressed") === "true").map((button) => button.getAttribute("aria-label"))`
    )
  );
  const startX = canvasBounds.x + canvasBounds.width * 0.4;
  const startY = canvasBounds.y + canvasBounds.height * 0.4;
  const endX = startX + 140;
  const endY = startY + 100;
  for (const event of [
    { type: "mouseMoved", x: startX, y: startY },
    { type: "mousePressed", x: startX, y: startY, button: "left", buttons: 1, clickCount: 1 },
    { type: "mouseMoved", x: startX + 35, y: startY + 25, button: "left", buttons: 1 },
    { type: "mouseMoved", x: startX + 80, y: startY + 55, button: "left", buttons: 1 },
    { type: "mouseMoved", x: endX, y: endY, button: "left", buttons: 1 },
    { type: "mouseReleased", x: endX, y: endY, button: "left", buttons: 0, clickCount: 1 }
  ]) {
    await cdp.send("Input.dispatchMouseEvent", event);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  writeFileSync(
    path.join(profileRoot, "studio-live-after-draw.png"),
    Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true })).data, "base64")
  );
  console.log("Project shapes after pointer input:", countShapes(readProject(projectPath), "geo"));
  const editedProject = await waitUntil(() => {
    const project = readProject(projectPath);
    return countShapes(project, "geo") > initialGeoCount ? project : undefined;
  }, "rectangle autosave");
  assert.equal(editedProject.id, initialProject.id);
  assert.equal(countShapes(editedProject, "frame"), countShapes(initialProject, "frame"));
  console.log(
    `Edited project ${editedProject.id}: ${countShapes(editedProject, "frame")} frame, ${countShapes(editedProject, "geo")} rectangles; autosaved ${editedProject.updatedAt}`
  );
}
console.log(
  `Studio save status: ${await evaluate(studioCdp, `${innerDocument}?.querySelector('.studio-windowbar__unsaved')?.innerText`)}`
);
console.log(
  "Rendered shapes:",
  await evaluate(
    studioCdp,
    `${innerDocument} && [...${innerDocument}.querySelectorAll('[data-shape-id], [data-testid], .tl-shape, .tl-container')].map(x => ({id:x.getAttribute('data-shape-id'), testId:x.getAttribute('data-testid'), cls:String(x.className).slice(0,80)})).slice(0,25)`
  )
);
console.log(
  "License overlay:",
  await evaluate(
    studioCdp,
    `${innerDocument}?.querySelector('[data-testid="tl-license-expired"]')?.outerHTML.slice(0,1200)`
  )
);
console.log(
  "Canvas layout:",
  await evaluate(
    studioCdp,
    `${innerDocument} && ['.studio-canvas-content','.studio-canvas-editor','.tl-container','.tl-canvas','.tl-shapes','.tl-shape-container'].map(s => {const x=${innerDocument}.querySelector(s);const r=x?.getBoundingClientRect();return {selector:s,exists:!!x,rect:r&&[r.x,r.y,r.width,r.height],html:x?.outerHTML.slice(0,250)}})`
  )
);
console.log(
  "tldraw classes:",
  await evaluate(
    studioCdp,
    `${innerDocument} && [...new Set([...${innerDocument}.querySelectorAll('[class*=tl-]')].map(x => String(x.className).split(' ')[0]))].slice(0,50)`
  )
);
console.log(
  "tldraw html:",
  await evaluate(studioCdp, `${innerDocument}?.querySelector('.tl-container')?.innerHTML.slice(0,3000)`)
);
const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(path.join(profileRoot, "studio-live.png"), Buffer.from(screenshot.data, "base64"));
studioCdp.close();
cdp.close();

function readProject(filePath) {
  const project = JSON.parse(readFileSync(filePath, "utf8"));
  return { ...project, snapshot: JSON.parse(project.snapshot) };
}

function countShapes(project, type) {
  return Object.values(project.snapshot.document.store).filter(
    (record) => record.typeName === "shape" && record.type === type
  ).length;
}

async function waitUntil(read, description, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await read();
      if (result) return result;
    } catch {
      // The atomic replace may be in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function evaluate(connection, expression) {
  const result = await connection.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    socket.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const id = ++sequence;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((done, fail) => pending.set(id, { done, fail }));
        },
        close() {
          socket.close();
        }
      })
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      const promise = pending.get(message.id);
      if (!promise) return;
      pending.delete(message.id);
      if (message.error) promise.fail(new Error(message.error.message));
      else promise.done(message.result);
    });
    socket.addEventListener("error", reject);
  });
}

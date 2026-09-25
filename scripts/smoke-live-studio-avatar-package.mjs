import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";
import { AvatarPackageRegistry } from "../apps/extension/dist/avatarPackages.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const requireStudioPackage = createRequire(path.join(root, "apps", "studio", "package.json"));
const { createServer } = await import(pathToFileURL(requireStudioPackage.resolve("vite")).href);
const edgeExe = process.env.EDGE_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert.ok(existsSync(edgeExe), `Microsoft Edge was not found: ${edgeExe}`);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-avatar-package-smoke-"));
const profile = path.join(temporaryRoot, "edge-profile");
const downloads = path.join(temporaryRoot, "downloads");
const workspaceRoot = path.join(temporaryRoot, "avatar-workspace");
mkdirSync(downloads, { recursive: true });
const launchToken = randomBytes(32).toString("hex");
const host = await startStudioServer(0, path.join(root, "apps", "studio", "dist"), launchToken);
const hostAddress = host.address();
assert.ok(hostAddress && typeof hostAddress !== "string");
const hostOrigin = `http://127.0.0.1:${hostAddress.port}`;
const vite = await createServer({
  root: path.join(root, "apps", "studio"),
  configFile: path.join(root, "apps", "studio", "vite.config.ts"),
  logLevel: "silent",
  server: {
    host: "127.0.0.1",
    port: 0,
    proxy: {
      "/api/studio": { target: hostOrigin, ws: true },
      "/api": { target: hostOrigin },
      "/assets": { target: hostOrigin }
    }
  }
});
await vite.listen();
const viteAddress = vite.httpServer.address();
assert.ok(viteAddress && typeof viteAddress !== "string");
const origin = `http://127.0.0.1:${viteAddress.port}`;
const debugPort = await reservePort();
const edge = spawn(
  edgeExe,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-proxy-server",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);
let cdp;

try {
  const target = await waitUntil(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    return (await response.json()).find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
  }, "isolated Edge page");
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: `${hostOrigin}/?studioToken=${launchToken}` });
  await waitUntil(async () => await evaluate(cdp, `document.readyState === "complete"`), "host session cookie");
  await cdp.send("Page.navigate", { url: `${origin}/?studioToken=${launchToken}` });
  await waitUntil(async () => /Recents/.test((await evaluate(cdp, "document.body?.innerText")) ?? ""), "Studio Home");
  await evaluate(cdp, `document.querySelector(".recents__button--primary")?.click()`);
  await waitUntil(async () => /^#\/p\//.test((await evaluate(cdp, "location.hash")) ?? ""), "new design canvas");
  await evaluate(cdp, `document.querySelector('summary[aria-label="Agents"]')?.click()`);
  await waitUntil(
    async () =>
      await evaluate(
        cdp,
        `Boolean([...document.querySelectorAll(".studio-windowbar__menu-popover button")].find((button) => button.innerText.trim() === "Open conversation"))`
      ),
    "Agents menu"
  );
  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-windowbar__menu-popover button")].find((button) => button.innerText.trim() === "Open conversation"))?.click()`
  );
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector(".studio-left-panel"))`),
    "left panel"
  );
  await evaluate(cdp, `document.querySelector('[role="tab"][aria-label="Assets"]')?.click()`);
  await waitUntil(
    async () => (await evaluate(cdp, "document.body?.innerText"))?.includes("Add avatar"),
    "Assets panel"
  );
  await evaluate(
    cdp,
    `([...document.querySelectorAll("button")].find((button) => button.innerText.trim() === "Add avatar"))?.click()`
  );
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector(".studio-shape--avatar svg.layered-mascot"))`),
    "layered mascot renderer"
  );

  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-shape__renderer-tabs button")].find((button) => button.innerText.trim() === "Package SVG"))?.click()`
  );
  await waitUntil(
    async () =>
      await evaluate(
        cdp,
        `Boolean(document.querySelector(".studio-shape--avatar img.avatar-svg-asset")?.complete && document.querySelector(".studio-shape--avatar img.avatar-svg-asset")?.naturalWidth > 0)`
      ),
    "packaged SVG renderer"
  );
  const svgRenderer = await evaluate(
    cdp,
    `({ source: document.querySelector(".studio-shape--avatar .avatar-shell")?.dataset.avatarSource, image: document.querySelector(".studio-shape--avatar img.avatar-svg-asset")?.naturalWidth })`
  );
  assert.equal(svgRenderer.source, "manifest");
  assert.ok(svgRenderer.image > 0);

  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-shape__renderer-tabs button")].find((button) => button.innerText.trim() === "Layered mascot"))?.click()`
  );
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector(".studio-shape--avatar svg.layered-mascot"))`),
    "layered renderer restored"
  );
  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-shape__states button")].find((button) => button.innerText.trim() === "Thinking"))?.click()`
  );
  await waitUntil(
    async () =>
      await evaluate(cdp, `document.querySelector(".layered-mascot-shell")?.dataset.avatarState === "thinking"`),
    "state preview"
  );
  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-shape__states button")].find((button) => button.innerText.trim() === "Idle"))?.click()`
  );
  await evaluate(
    cdp,
    `(() => { const originalFetch = window.fetch.bind(window); window.fetch = async (...args) => { const response = await originalFetch(...args); if (String(args[0]).includes("/api/avatar-package")) window.__studioAvatarZip = await response.clone().blob(); return response; }; })()`
  );
  await evaluate(cdp, `document.querySelector(".studio-shape__package-button")?.click()`);
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(window.__studioAvatarZip && window.__studioAvatarZip.size > 0)`),
    "avatar package response",
    20_000
  );
  const archiveMeta = await evaluate(
    cdp,
    `(async () => { const blob = window.__studioAvatarZip; const buffer = await blob.arrayBuffer(); const bytes = new Uint8Array(buffer); let binary = ""; for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768)); return { type: blob.type, size: blob.size, base64: btoa(binary) }; })()`
  );
  assert.equal(archiveMeta.type, "application/zip");
  const archiveName = "cholita-3d-1.0.0.codex-avatar.zip";
  const archivePath = path.join(downloads, archiveName);
  await writeFile(archivePath, Buffer.from(archiveMeta.base64, "base64"));
  const registry = new AvatarPackageRegistry(
    () => workspaceRoot,
    () => ".codex-avatar"
  );
  const imported = await registry.importPackage(archivePath);
  const activated = await registry.activateAvatar(imported.id);
  const packagedSvg = readFileSync(path.join(imported.rootPath, "svg", "avatar.svg"), "utf8");
  assert.equal(imported.id, "cholita-3d");
  assert.equal(activated?.id, "cholita-3d");
  assert.match(packagedSvg, /viewBox="0 0 441 653"/);
  assert.match(packagedSvg, /id="avatar\/root"/);
  assert.doesNotMatch(packagedSvg, /<script|foreignObject/i);
  assert.doesNotMatch(packagedSvg, /(?:href|xlink:href)="(?:https?:|data:|\/\/)/i);
  assert.match((await registry.getActivePackage())?.manifest.entrypoints.svg ?? "", /svg\/avatar\.svg/);

  console.log(
    "Live avatar builder smoke passed:",
    JSON.stringify({
      project: "new local Studio canvas",
      renderers: ["LayeredMascotRenderer", "SvgAvatarRenderer"],
      statePreview: "thinking",
      export: archiveName,
      packageImportedAndActivated: true,
      svgIsStaticAndSanitized: true
    })
  );
} catch (error) {
  const state = cdp
    ? await evaluate(
        cdp,
        `({ hash: location.hash, body: document.body?.innerText?.slice(0, 1800), avatar: document.querySelector(".studio-shape--avatar")?.outerHTML?.slice(0, 1600) })`
      ).catch(() => null)
    : null;
  throw new Error(`${error instanceof Error ? error.message : String(error)}; browser state: ${JSON.stringify(state)}`);
} finally {
  if (cdp) {
    await cdp.send("Page.navigate", { url: "about:blank" }).catch(() => undefined);
    await waitUntil(
      async () => (await evaluate(cdp, "location.href")) === "about:blank",
      "closed smoke page",
      2_000
    ).catch(() => undefined);
    await cdp.send("Browser.close").catch(() => undefined);
    cdp.close();
  }
  if (edge.exitCode === null) {
    edge.kill();
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5_000);
      edge.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  await vite.close();
  await new Promise((resolve) => host.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
}

async function reservePort() {
  const server = createTcpServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not reserve an Edge port."));
      server.close(() => resolve(address.port));
    });
  });
}

async function waitUntil(read, description, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value) return value;
    } catch {
      // Navigation and rendering can briefly interrupt CDP evaluation.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function evaluate(connection, expression) {
  return connection
    .send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    .then((result) => {
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result?.value;
    });
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const listeners = new Map();
    let sequence = 0;
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const id = ++sequence;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((done, fail) => pending.set(id, { done, fail }));
        },
        on(method, listener) {
          const subscribed = listeners.get(method) ?? new Set();
          subscribed.add(listener);
          listeners.set(method, subscribed);
        },
        close() {
          socket.close();
        }
      })
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        if (message.error) request.fail(new Error(message.error.message));
        else request.done(message.result);
        return;
      }
      for (const listener of listeners.get(message.method) ?? []) listener(message.params);
    });
  });
}

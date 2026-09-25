import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vsixPath = path.resolve(process.env.VSIX_PATH ?? path.join(root, "dist", "codex-avatar-studio-0.1.0.vsix"));
const edge = findEdge();
assert.ok(existsSync(vsixPath), `VSIX does not exist: ${vsixPath}`);
assert.ok(edge, "Microsoft Edge is required for the packaged browser boundary check. Set EDGE_BIN if needed.");

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-offline-studio-"));
let browser;
let cdp;
let server;
try {
  const installedSmoke = spawnSync(process.execPath, [path.join(root, "scripts", "smoke-installed-vsix.mjs")], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    windowsHide: true,
    env: { ...process.env, SMOKE_OFFLINE: "1", VSIX_PATH: vsixPath }
  });
  if (installedSmoke.error) throw installedSmoke.error;
  assert.equal(
    installedSmoke.status,
    0,
    `Bundled extension failed offline activation smoke:\n${installedSmoke.stdout ?? ""}\n${installedSmoke.stderr ?? ""}`
  );

  execFileSync("tar", ["-xf", vsixPath, "-C", tempRoot], { stdio: "pipe" });
  const studioRoot = path.join(tempRoot, "extension", "media", "studio");
  assert.ok(existsSync(path.join(studioRoot, "index.html")), "packaged Studio HTML is present");
  server = makeAssetServer(studioRoot);
  const port = await listen(server);
  const debugPort = await freePort();
  browser = spawn(
    edge,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-proxy-server",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(tempRoot, "edge-profile")}`,
      "about:blank"
    ],
    { windowsHide: true, stdio: "ignore" }
  );

  const target = await waitForPageTarget(debugPort);
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  const requests = [];
  cdp.on("Network.requestWillBeSent", (event) => requests.push(event.request.url));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html#/p/page%3Apage` });
  await waitFor(cdp, `Boolean(document.querySelector('button[aria-label="All files"]'))`);
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Return to canvas'))?.click();
      document.querySelector('summary[aria-label="Settings"]')?.click();
    })()`
  });
  await waitFor(cdp, `Boolean(document.querySelector('summary[aria-label="Settings"]')?.closest('details')?.open)`);
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('summary[aria-label="Agents"]')?.click();
      [...document.querySelectorAll('.studio-windowbar__menu-popover button')]
        .find(button => button.textContent?.includes('Open conversation'))?.click();
    })()`
  });
  await waitFor(cdp, `Boolean(document.querySelector('section[aria-label="OpenRouter connection"]'))`);
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const connection = document.querySelector('section[aria-label="OpenRouter connection"]');
      const sidebar = document.querySelector('#studio-agent-sidebar');
      return {
        connectionText: connection?.textContent || '',
        settingsText: document.querySelector('summary[aria-label="Settings"]')?.closest('details')?.textContent || '',
        hasCredentialField: Boolean(document.querySelector('input[type="password"]')),
        connectionControlsEnabled: [...(document.querySelector('summary[aria-label="Settings"]')?.closest('details')?.querySelectorAll('button') || [])]
          .filter(button => /^(connect|test|replace|disconnect)$/i.test(button.textContent?.trim() || ''))
          .some(button => !button.disabled),
        hasDisabledComposer: Boolean(sidebar?.querySelector('textarea:disabled')),
        hasCanvas: Boolean(document.querySelector('.tl-container')),
        hasLicenseNotice: Boolean(document.querySelector('.studio-canvas-license')),
        route: window.location.hash,
        bodyText: document.body.innerText.slice(0, 360)
      };
    })()`,
    returnByValue: true
  });
  const rendered = result.result.value;
  console.log("Packaged Studio smoke state:", rendered);
  assert.match(rendered.connectionText, /offline preview/i);
  assert.match(rendered.settingsText, /key is sent once to this computer and is not kept in the page/i);
  assert.equal(rendered.hasCredentialField, false, "browser preview exposes no credential input");
  assert.equal(
    rendered.connectionControlsEnabled,
    false,
    "browser preview exposes no enabled provider connection action"
  );
  assert.equal(rendered.hasDisabledComposer, true, "browser preview disables the chat composer");
  if (process.env.VITE_TLDRAW_LICENSE_KEY?.trim()) {
    assert.equal(rendered.hasCanvas, true, "packaged Studio canvas renders with its configured license");
    assert.equal(rendered.hasLicenseNotice, false, "licensed build does not show the missing-license notice");
  } else {
    assert.equal(rendered.hasCanvas, false, "unlicensed production preview does not mount tldraw");
    assert.equal(
      rendered.hasLicenseNotice,
      true,
      `unlicensed production preview explains how to enable the canvas: ${JSON.stringify(rendered)}`
    );
  }
  assert.ok(requests.length > 0, "the packaged UI requested local assets");
  const externalRequests = requests.filter(
    (url) => !url.startsWith(`http://127.0.0.1:${port}/`) && !url.startsWith("data:") && !url.startsWith("blob:")
  );
  assert.ok(
    externalRequests.length === 0,
    `Browser preview attempted ${externalRequests.length} external requests: ${[...new Set(externalRequests)].slice(0, 8).join(", ")}`
  );
  console.log(
    "Offline Studio smoke passed: bundled host made zero fetches; packaged browser UI rendered setup-only on loopback with the expected canvas license state."
  );
} finally {
  try {
    if (cdp) {
      await Promise.race([
        cdp.send("Browser.close").catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 2_000))
      ]);
    }
  } catch {
    // The dedicated smoke profile can be closed by killing only this child.
  }
  browser?.kill();
  cdp?.close();
  await new Promise((resolve) => server?.close(resolve) ?? resolve());
  // The target is a direct child of the system temp directory made above.
  assert.equal(path.dirname(path.resolve(tempRoot)), path.resolve(os.tmpdir()));
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function makeAssetServer(studioRoot) {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const relativePath = decodeURIComponent(pathname === "/" ? "index.html" : pathname.slice(1));
      const filePath = path.resolve(studioRoot, relativePath);
      const inside = path.relative(studioRoot, filePath);
      if (inside.startsWith("..") || path.isAbsolute(inside)) throw new Error("Path escaped Studio assets.");
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("Not a file.");
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createTcpServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForPageTarget(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      // Edge may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Edge DevTools page did not start.");
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const listeners = new Map();
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener("open", () => {
      resolve({
        on(method, callback) {
          listeners.set(method, callback);
        },
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((done, fail) => {
            pending.set(id, { done, fail });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.method) listeners.get(message.method)?.(message.params);
      if (!message.id) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.fail(new Error(message.error.message));
      else request.done(message.result);
    });
    socket.addEventListener("error", () => reject(new Error("Could not connect to Edge DevTools.")));
  });
}

async function waitFor(cdp, expression) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true }).catch(() => null);
    if (result?.result?.value === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Packaged Studio UI did not reach expected state: ${expression}`);
}

function findEdge() {
  const candidates = [
    process.env.EDGE_BIN,
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe")
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

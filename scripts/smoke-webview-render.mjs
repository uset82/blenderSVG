import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const webviewOutput = path.join(root, "apps", "extension", "media", "webview");
const edgeExecutable = findEdgeExecutable();
const smokeProfilePrefix = "codex-avatar-webview-smoke-";

if (!edgeExecutable) {
  throw new Error("Microsoft Edge was not found. Set EDGE_BIN to run the webview render smoke.");
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const relativePath = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath.slice(1));
    const filePath = path.resolve(webviewOutput, relativePath);

    if (!isInsideDirectory(webviewOutput, filePath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await cleanupOldSmokeProfiles();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), smokeProfilePrefix));
let browser;

try {
  const port = await listen(server);
  const url = `http://127.0.0.1:${port}/index.html`;
  const debugPort = await findFreePort();
  browser = spawn(edgeExecutable, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-breakpad",
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${tempRoot}`,
    url
  ], { windowsHide: true });
  const stderr = captureStream(browser.stderr);
  const target = await waitForPageTarget(debugPort, url);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable").catch(() => undefined);
  await cdp.send("Runtime.enable").catch(() => undefined);
  await delay(500);
  const rendered = await evaluateRenderedWebview(cdp);

  assert.equal(rendered.hasPanel, true, "React avatar panel rendered");
  assert.equal(rendered.hasStage, true, "avatar stage rendered");
  assert.match(rendered.text, /Ready to build\./, "assistant message rendered");
  assert.match(rendered.text, /welcome/, "initial avatar state rendered");

  cdp.close();
  console.log(`Webview render smoke passed: ${url}`);
  if (stderr.text.includes("ERR_")) {
    console.warn(stderr.text.trim());
  }
} finally {
  await stopBrowser(browser);
  server.close();
  await removeTempRoot(tempRoot);
}

function listen(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
        return;
      }

      reject(new Error("Unable to determine webview smoke server port."));
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const tcpServer = createTcpServer();
    tcpServer.once("error", reject);
    tcpServer.listen(0, "127.0.0.1", () => {
      const address = tcpServer.address();
      tcpServer.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
          return;
        }

        reject(new Error("Unable to find a free CDP port."));
      });
    });
  });
}

async function waitForPageTarget(debugPort, expectedUrl) {
  const endpoint = `http://127.0.0.1:${debugPort}/json`;
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      const targets = await response.json();
      const target = targets.find(item => item.type === "page" && item.url === expectedUrl);
      if (target?.webSocketDebuggerUrl) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`Unable to connect to Edge DevTools endpoint: ${lastError?.message ?? endpoint}`);
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== "function") {
      reject(new Error("This Node.js runtime does not provide WebSocket."));
      return;
    }

    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));

          return new Promise((sendResolve, sendReject) => {
            pending.set(id, { reject: sendReject, resolve: sendResolve });
          });
        },
        close() {
          socket.close();
        }
      });
    });

    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data.toString());
      const request = pending.get(message.id);
      if (!request) {
        return;
      }

      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    });

    socket.addEventListener("error", () => reject(new Error("Unable to connect to Edge DevTools WebSocket.")));
  });
}

async function evaluateRenderedWebview(cdp) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `(() => new Promise(resolve => {
          const deadline = Date.now() + 5000;
          const tick = () => {
            const panel = document.querySelector(".avatar-panel");
            const stage = document.querySelector(".avatar-stage");
            if (panel || Date.now() > deadline) {
              resolve({
                hasPanel: Boolean(panel),
                hasStage: Boolean(stage),
                html: document.body.innerHTML,
                text: document.body.textContent || ""
              });
              return;
            }

            setTimeout(tick, 50);
          };
          tick();
        }))()`
      });

      return result.result.value;
    } catch (error) {
      lastError = error;
      if (!/Execution context was destroyed/i.test(error.message)) {
        throw error;
      }

      await delay(300);
    }
  }

  throw lastError;
}

function captureStream(stream) {
  const captured = { text: "" };
  stream?.on("data", chunk => {
    captured.text += chunk.toString();
  });
  return captured;
}

async function stopBrowser(child) {
  if (!child) {
    return;
  }

  if (child.exitCode === null && !child.killed) {
    child.kill();
  }

  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    delay(2000)
  ]);
}

async function removeTempRoot(directory) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(directory, { force: true, recursive: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  if (process.env.SMOKE_DEBUG_CLEANUP === "1") {
    console.warn(`Unable to remove temporary webview smoke profile: ${lastError.message}`);
  }
}

async function cleanupOldSmokeProfiles() {
  const entries = await readdir(os.tmpdir(), { withFileTypes: true });
  await Promise.all(
    entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith(smokeProfilePrefix))
      .map(entry => removeTempRoot(path.join(os.tmpdir(), entry.name)))
  );
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function findEdgeExecutable() {
  const candidates = [
    process.env.EDGE_BIN,
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe")
  ].filter(Boolean);

  return candidates.find(candidate => {
    try {
      return statSyncFile(candidate);
    } catch {
      return false;
    }
  });
}

function statSyncFile(filePath) {
  return statSync(filePath).isFile();
}

function getContentType(filePath) {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isInsideDirectory(parent, child) {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

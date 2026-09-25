import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const edgeExe = process.env.EDGE_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert.ok(existsSync(edgeExe), `Microsoft Edge was not found: ${edgeExe}`);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-conversation-smoke-"));
const profile = path.join(temporaryRoot, "edge-profile");
const library = path.join(temporaryRoot, "library");
const staticRoot = path.join(root, "apps", "studio", "dist");
const launchToken = randomBytes(32).toString("hex");
const projectId = "96c147eb-a0bf-4c5b-a128-912044bad299";
const conversationId = "0791847d-ea7d-4faa-9b47-aab47511c777";
const server = await startStudioServer(0, staticRoot, launchToken, undefined, library);
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const edgePort = await reservePort();
const edge = spawn(
  edgeExe,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${edgePort}`,
    `${origin}/?studioToken=${launchToken}`
  ],
  { stdio: "ignore", windowsHide: true }
);
let cdp;

try {
  const seeded = await fetch(`${origin}/api/projects/${projectId}/conversations?studioToken=${launchToken}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      id: conversationId,
      projectId,
      title: "Saved iteration",
      modelId: "openrouter/auto",
      updatedAt: new Date().toISOString(),
      messages: [
        { role: "user", content: "Remember this local draft." },
        { role: "assistant", content: "The saved transcript returned after reload." }
      ]
    })
  });
  assert.equal(seeded.status, 200, "The local standalone host accepts a conversation record");

  const targets = await waitUntil(async () => {
    const response = await fetch(`http://127.0.0.1:${edgePort}/json/list`);
    const items = await response.json();
    return items.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  }, "Edge page target");
  cdp = await connectCdp(targets.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await waitUntil(async () => {
    const text = await evaluate(cdp, "document.body?.innerText");
    return /Recents/.test(text ?? "") && /New file/.test(text ?? "");
  }, "Studio Home");

  await evaluate(
    cdp,
    `(() => { const native = crypto.randomUUID.bind(crypto); let next = ${JSON.stringify(projectId)}; Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => { const value = next; next = ""; return value || native(); } }); return true; })()`
  );
  const started = await evaluate(
    cdp,
    `(() => { const button = [...document.querySelectorAll(".recents__button--primary")].find((item) => item.innerText.trim() === "New file"); button?.click(); return Boolean(button); })()`
  );
  assert.equal(started, true, "Studio Home exposes New file");
  await waitUntil(async () => (await evaluate(cdp, "location.hash")) === `#/p/${projectId}`, "New project route");
  await evaluate(cdp, `document.querySelector('summary[aria-label="Agents"]')?.click()`);
  await waitUntil(
    async () => (await evaluate(cdp, "document.body?.innerText"))?.includes("Open conversation"),
    "Agents menu"
  );
  const openedConversation = await evaluate(
    cdp,
    `(() => { const button = [...document.querySelectorAll("button")].find((item) => item.innerText.trim() === "Open conversation"); button?.click(); return Boolean(button); })()`
  );
  assert.equal(openedConversation, true, "Agents menu opens the design conversation panel");
  try {
    await waitUntil(
      async () =>
        (await evaluate(cdp, "document.body?.innerText"))?.includes("The saved transcript returned after reload."),
      "restored conversation transcript",
      8_000
    );
  } catch (error) {
    const diagnostic = await evaluate(
      cdp,
      `(async () => { const response = await fetch(${JSON.stringify(`/api/projects/${projectId}/conversations`)}); return { route: location.hash, status: response.status, list: await response.text(), body: document.body?.innerText.slice(0, 1200), panel: Boolean(document.querySelector(".studio-agent__messages")) }; })()`
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)}: ${JSON.stringify(diagnostic)}`);
  }

  await evaluate(cdp, `document.querySelector(".studio-agent__conversation-picker > button")?.click()`);
  const menu = await waitUntil(async () => {
    const text = await evaluate(cdp, "document.querySelector('#studio-agent-conversations')?.innerText");
    return text?.includes("openrouter/auto") ? text : undefined;
  }, "saved conversation in the model menu");
  const restored = await evaluate(
    cdp,
    `({
    route: location.hash,
    title: document.querySelector(".studio-agent__conversation-picker > button")?.innerText,
    messages: [...document.querySelectorAll(".studio-agent__message")].map((node) => node.innerText)
  })`
  );
  assert.match(restored.title, /Saved iteration/);
  assert.ok(restored.messages.some((message) => message.includes("Remember this local draft.")));
  assert.ok(restored.messages.some((message) => message.includes("The saved transcript returned after reload.")));
  assert.match(menu, /Saved iteration/);
  assert.match(menu, /openrouter\/auto/);
  console.log("Live standalone conversation restore passed:", JSON.stringify(restored));
} finally {
  if (cdp) {
    await cdp.send("Browser.close").catch(() => undefined);
    cdp.close();
  }
  if (edge.exitCode === null) edge.kill();
  await new Promise((resolve) => server.close(resolve));
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

async function waitUntil(read, description, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value) return value;
    } catch {
      // Browser navigation and atomic writes can briefly interrupt inspection.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function evaluate(connection, expression) {
  const result = await connection.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    socket.addEventListener("error", reject, { once: true });
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
  });
}

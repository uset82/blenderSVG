import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const edgeExe = process.env.EDGE_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert.ok(existsSync(edgeExe), `Microsoft Edge was not found: ${edgeExe}`);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-openrouter-smoke-"));
const profile = path.join(temporaryRoot, "edge-profile");
const library = path.join(temporaryRoot, "library");
const staticRoot = path.join(root, "apps", "studio", "dist");
const launchToken = randomBytes(32).toString("hex");
const testKey = "sk-or-v1-smoke-local-0123456789abcdef";
const modelId = "openai/gpt-4o-mini";
const providerRequests = [];
let storedKey = null;
const keyring = {
  async get() {
    return storedKey;
  },
  async set(value) {
    storedKey = value;
  }
};
const providerRequest = async (input, init) => {
  const url = String(input);
  providerRequests.push({ url, authorization: new Headers(init?.headers).get("authorization"), body: init?.body });
  assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${testKey}`);
  if (url.endsWith("/key")) {
    return json({ data: { label: "Studio smoke key", is_management_key: false, limit_remaining: 10 } });
  }
  if (url.includes("/models/user?output_modalities=all")) {
    return json({
      data: [
        {
          id: modelId,
          name: "GPT 4o mini",
          description: "Smoke model for the local OpenRouter bridge.",
          architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
          context_length: 128_000,
          pricing: { prompt: "0.00000015", completion: "0.0000006" },
          supported_parameters: ["tools"]
        },
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Claude 3.5 Sonnet",
          architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          context_length: 200_000,
          pricing: { prompt: "0.000003", completion: "0.000015" },
          supported_parameters: ["tools"]
        }
      ]
    });
  }
  if (url.endsWith("/chat/completions")) {
    const events = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Standalone OpenRouter reply verified." } }] })}`,
      "",
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19, cost: 0.0001 } })}`,
      "",
      "data: [DONE]",
      ""
    ].join("\n");
    return new Response(events, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  throw new Error(`Unexpected OpenRouter request: ${url}`);
};

const server = await startStudioServer(0, staticRoot, launchToken, keyring, library, providerRequest);
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
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
const socketFrames = [];

try {
  const target = await waitUntil(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const tabs = await response.json();
    return tabs.find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
  }, "Edge page target");
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  cdp.on("Network.webSocketFrameSent", (event) => socketFrames.push(event.response?.payloadData ?? ""));
  cdp.on("Network.webSocketFrameReceived", (event) => socketFrames.push(event.response?.payloadData ?? ""));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.navigate", { url: `${origin}/?studioToken=${launchToken}` });
  try {
    await waitUntil(async () => /Recents/.test((await evaluate(cdp, "document.body?.innerText")) ?? ""), "Studio Home");
  } catch (error) {
    const state = await evaluate(
      cdp,
      `({ title: document.title, url: location.href, body: document.body?.innerText?.slice(0, 1200), errors: [...document.querySelectorAll("vite-error-overlay")].map((item) => item.innerText) })`
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; startup state: ${JSON.stringify(state)}`
    );
  }
  await evaluate(cdp, `document.querySelector(".recents__button--primary")?.click()`);
  await waitUntil(async () => /^#\/p\//.test((await evaluate(cdp, "location.hash")) ?? ""), "new Studio project");
  await evaluate(cdp, `document.querySelector('summary[aria-label="Agents"]')?.click()`);
  await waitUntil(
    async () => (await evaluate(cdp, "document.body?.innerText"))?.includes("Open conversation"),
    "Agents menu"
  );
  await evaluate(
    cdp,
    `([...document.querySelectorAll(".studio-windowbar__menu-popover button")].find((item) => item.innerText.trim() === "Open conversation"))?.click()`
  );
  try {
    await waitUntil(
      async () => await evaluate(cdp, `Boolean(document.querySelector("#studio-chat-composer"))`),
      "agent composer",
      5_000
    );
  } catch (error) {
    const state = await evaluate(
      cdp,
      `({ hash: location.hash, body: document.body?.innerText?.slice(0, 1800), panel: Boolean(document.querySelector(".studio-left-panel")), composer: document.querySelector("#studio-chat-composer")?.outerHTML, textareas: [...document.querySelectorAll("textarea")].map((item) => ({ id: item.id, label: item.getAttribute("aria-label"), html: item.outerHTML.slice(0, 400) })), buttons: [...document.querySelectorAll(".studio-windowbar__menu-popover button")].map((button) => button.innerText) })`
    );
    throw new Error(`${error instanceof Error ? error.message : String(error)}; UI state: ${JSON.stringify(state)}`);
  }
  await evaluate(cdp, `document.querySelector('summary[aria-label="Settings"]')?.click()`);
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector('input[name="openrouter-key"]'))`),
    "key input"
  );
  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector('input[name="openrouter-key"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(testKey)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.closest("form")?.requestSubmit();
      return true;
    })()`
  );
  await waitUntil(async () => providerRequests.some((request) => request.url.endsWith("/key")), "host key validation");
  await waitUntil(
    async () => providerRequests.some((request) => request.url.includes("/models/user?output_modalities=all")),
    "account-filtered OpenRouter model catalog"
  );
  const keyState = await evaluate(
    cdp,
    `({
      input: document.querySelector('input[name="openrouter-key"]')?.value,
      local: Object.values(localStorage).join(" "),
      session: Object.values(sessionStorage).join(" "),
      body: document.body.innerText
    })`
  );
  assert.equal(keyState.input, "", "the password input is cleared after submission");
  assert.ok(!keyState.local.includes(testKey) && !keyState.session.includes(testKey), "browser storage stays key-free");
  assert.ok(!keyState.body.includes(testKey), "the page never renders the provider key");

  await evaluate(cdp, `document.querySelector('summary[aria-label="Settings"]')?.click()`);
  await evaluate(cdp, `document.querySelector("button.studio-agent__model-trigger")?.click()`);
  await waitUntil(
    async () =>
      await evaluate(
        cdp,
        `Boolean(document.querySelector('[role="dialog"][aria-label="Choose an OpenRouter model"]'))`
      ),
    "model picker"
  );
  await waitUntil(
    async () => (await evaluate(cdp, "document.body?.innerText"))?.includes("2 available in this catalog"),
    "two live model options"
  );
  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector('input[aria-label="Search models"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, "GPT 4o mini");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`
  );
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector('[role="option"][data-model-id="${modelId}"]'))`),
    "filtered model row"
  );
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", windowsVirtualKeyCode: 40 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", windowsVirtualKeyCode: 40 });
  assert.equal(
    await evaluate(cdp, "document.activeElement?.dataset.modelId"),
    modelId,
    "ArrowDown focuses the first result"
  );
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", windowsVirtualKeyCode: 13 });
  try {
    await waitUntil(
      async () =>
        (await evaluate(cdp, "document.querySelector('.studio-agent__model-trigger')?.innerText"))?.includes(
          "GPT 4o mini"
        ),
      "model selection",
      5_000
    );
  } catch (error) {
    const state = await evaluate(
      cdp,
      `({ trigger: document.querySelector('.studio-agent__model-trigger')?.innerText, active: document.activeElement?.outerHTML?.slice(0, 300), option: document.querySelector('[data-model-id="${modelId}"]')?.outerHTML?.slice(0, 500), body: document.body?.innerText?.slice(0, 1200) })`
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; picker state: ${JSON.stringify(state)}`
    );
  }

  const refreshCount = providerRequests.filter((request) =>
    request.url.includes("/models/user?output_modalities=all")
  ).length;
  await evaluate(cdp, `document.querySelector("button.studio-agent__model-trigger")?.click()`);
  await waitUntil(
    async () => await evaluate(cdp, `Boolean(document.querySelector(".studio-model-picker-popover__footer button"))`),
    "refresh button"
  );
  await evaluate(cdp, `document.querySelector('.studio-model-picker-popover__footer button')?.click()`);
  await waitUntil(
    async () =>
      providerRequests.filter((request) => request.url.includes("/models/user?output_modalities=all")).length >
      refreshCount,
    "manual catalog refresh"
  );

  const draft = "Reply through the local OpenRouter host smoke.";
  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector("#studio-chat-composer");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(draft)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('button[aria-label="Review & send"]')?.click();
    })()`
  );
  const contextRow = await evaluate(
    cdp,
    `({ text: document.querySelector('.studio-agent__context')?.textContent, previewChecked: document.querySelector('.studio-agent__context input[type="checkbox"]')?.checked })`
  );
  assert.ok(contextRow.text.includes("Model: GPT 4o mini"));
  assert.ok(contextRow.text.includes(`Draft: ${draft.length} characters.`));
  assert.ok(contextRow.text.includes("Earlier messages included: 0."));
  assert.ok(contextRow.text.includes("No image attached."));
  assert.ok(contextRow.text.includes("The OpenRouter key is not included."));
  assert.equal(contextRow.previewChecked, true);
  await waitUntil(
    async () =>
      await evaluate(cdp, `Boolean(document.querySelector('[aria-labelledby="studio-consent-title"] button'))`),
    "first-send consent"
  );
  const consentDialog = await evaluate(
    cdp,
    `document.querySelector('[aria-labelledby="studio-consent-title"]')?.innerText`
  );
  assert.match(consentDialog, /sends your draft, earlier messages/);
  assert.match(consentDialog, /OpenRouter key stays on the host/);
  await evaluate(cdp, `document.querySelector('[aria-labelledby="studio-consent-title"] button')?.click()`);
  const consentState = await evaluate(
    cdp,
    `({ projectId: decodeURIComponent(location.hash.split("/").pop()), entries: Object.entries(sessionStorage).filter(([key]) => key.startsWith("studio-chat-consent-v2:")) })`
  );
  assert.deepEqual(consentState.entries, [[`studio-chat-consent-v2:${consentState.projectId}`, "yes"]]);
  await waitUntil(
    async () =>
      await evaluate(cdp, `Boolean(document.querySelector('[aria-labelledby="studio-outbound-title"] button'))`),
    "outbound request review"
  );
  const outboundReview = await evaluate(
    cdp,
    `document.querySelector('[aria-labelledby="studio-outbound-title"]')?.innerText`
  );
  assert.ok(outboundReview.includes(draft), "the exact draft appears in outbound review");
  assert.match(outboundReview, /\$0\.15 input \/ \$0\.6 output per 1M tokens/);
  await evaluate(
    cdp,
    `([...document.querySelectorAll('[aria-labelledby="studio-outbound-title"] button')].find((button) => button.innerText.trim() === "Send to OpenRouter"))?.click()`
  );
  await waitUntil(async () => {
    const text = await evaluate(
      cdp,
      "document.querySelector('.studio-agent__markdown')?.textContent || document.body?.textContent"
    );
    return Boolean(text?.includes("Standalone OpenRouter reply verified."));
  }, "streamed OpenRouter reply");
  const chatRequest = providerRequests.find((request) => request.url.endsWith("/chat/completions"));
  assert.ok(chatRequest, "the standalone host received a chat request");
  assert.match(String(chatRequest.body), new RegExp(`"model":"${modelId.replaceAll("/", "\\/")}"`));
  assert.ok(!socketFrames.some((frame) => frame.includes(testKey)), "WebSocket protocol frames never contain the key");
  assert.ok(
    !JSON.stringify(providerRequests.map(({ url }) => url)).includes(testKey),
    "host logs store no key in URLs"
  );
  assert.equal(providerRequests.filter((request) => request.url.endsWith("/key")).length, 1);
  console.log(
    "Live standalone OpenRouter smoke passed:",
    JSON.stringify({
      host: "loopback WebSocket",
      catalogModels: 2,
      selectedModel: modelId,
      refreshed: true,
      streamedReply: true,
      consentShownBeforeSend: true,
      keyInPageStorageOrMessages: false
    })
  );
} finally {
  if (cdp) cdp.close();
  if (edge.exitCode === null) edge.kill();
  await new Promise((resolve) => server.close(resolve));
}

function json(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
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
      // Navigation and UI updates can briefly interrupt CDP evaluation.
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

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kurva-vscode-mcp-"));
const library = path.join(temporaryRoot, "library");
const launchToken = randomBytes(32).toString("hex");
const projectId = randomUUID();
const projectTitle = "VS Code MCP acceptance";
const projectSnapshot = JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } });
const provider = process.argv[2]?.trim() || "copilotcli";
const clientId = `kurva-vscode-${randomUUID()}`;
const sessionUri = `ahp-session:/${randomUUID()}`;
let server;
let socket;
let sessionCreated = false;
let clientToken;
let requestId = 0;
let clientSeq = 0;
let chatUri;
let chatComplete;
let chatFailure;
const pendingRequests = new Map();
const toolNames = new Map();
const completedTools = [];

try {
  await mkdir(library, { recursive: true });
  server = await startStudioServer(0, path.join(root, "apps", "studio", "dist"), launchToken, undefined, library);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;

  const clientResponse = await fetch(`${origin}/api/mcp-clients?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "VS Code acceptance", permission: "apply" })
  });
  const client = await clientResponse.json();
  assert.equal(clientResponse.status, 200);
  assert.equal(typeof client.token, "string");
  clientToken = client.token;

  const projectResponse = await fetch(`${origin}/api/projects?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: projectId, title: projectTitle, snapshot: projectSnapshot })
  });
  assert.equal(projectResponse.status, 200, await projectResponse.text());

  await writeFile(
    path.join(temporaryRoot, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        blendersvg: {
          type: "http",
          url: `${origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`,
          headers: { Authorization: `Bearer ${client.token}` }
        }
      }
    }),
    { mode: 0o600 }
  );

  const registry = JSON.parse(
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "code agent endpoints"], {
      encoding: "utf8",
      timeout: 10_000
    })
  );
  const endpoint = registry.endpoints?.find((item) => item.type === "standalone" && item.endpoint?.type === "tcp");
  assert.ok(
    endpoint,
    "Start VS Code Agent Host first with `code agent host --new-instance --host 127.0.0.1 --port 0 --foreground --idle-timeout 300`."
  );

  socket = new WebSocket(
    `ws://${endpoint.endpoint.host}:${endpoint.endpoint.port}/?tkn=${encodeURIComponent(endpoint.connectionToken)}`
  );
  socket.addEventListener("message", onMessage);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to the VS Code Agent Host.")), {
      once: true
    });
  });

  const initialized = await request("initialize", {
    channel: "ahp-root://",
    protocolVersions: ["0.9.0"],
    clientId,
    clientInfo: { name: "Kurva Studio acceptance", version: "1.0.0" },
    initialSubscriptions: ["ahp-root://"]
  });
  assert.ok(
    !initialized.error,
    `VS Code Agent Host initialize failed: ${initialized.error?.message ?? "unknown error"}`
  );
  const rootState = initialized.result.snapshots?.find((snapshot) => snapshot.resource === "ahp-root://")?.state;
  const agentInfo = rootState?.agents?.find((agent) => agent.provider === provider);
  assert.ok(agentInfo, `VS Code Agent Host provider ${provider} is unavailable.`);
  assert.ok(
    !Array.isArray(agentInfo.models) || agentInfo.models.length > 0,
    `VS Code Agent Host provider ${provider} has no available models; authenticate or configure it before running the MCP acceptance.`
  );

  const createResponse = await request("createSession", {
    channel: sessionUri,
    provider,
    workingDirectories: [pathToFileURL(temporaryRoot).href]
  });
  assert.ok(
    !createResponse.error,
    `VS Code ${agentInfo.displayName} session failed to start: ${createResponse.error?.message ?? "unknown error"}`
  );
  sessionCreated = true;

  const sessionState = await waitForSession(60_000);
  const mcpServer = findCustomization(
    sessionState.customizations,
    (item) => item.type === "mcpServer" && item.name === "blendersvg"
  );
  assert.ok(mcpServer, "VS Code Agent Host did not discover the temporary blendersvg MCP configuration.");
  if (mcpServer.state?.kind !== "ready") {
    dispatchSessionAction({ type: "session/mcpServerStartRequested", id: mcpServer.id });
    await waitForMcpServer(60_000);
  }
  chatUri = sessionState.defaultChat ?? sessionState.chats?.[0]?.resource;
  assert.ok(chatUri, "VS Code Agent Host session has no default chat.");
  const chatSubscription = await request("subscribe", { channel: chatUri });
  assert.ok(!chatSubscription.error, "Could not subscribe to the VS Code Agent Host chat.");

  const turnId = randomUUID();
  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "dispatchAction",
      params: {
        channel: chatUri,
        clientSeq: ++clientSeq,
        action: {
          type: "chat/turnStarted",
          turnId,
          startedAt: new Date().toISOString(),
          message: {
            text: [
              "Use only the blendersvg MCP server. First call list_projects, then get_canvas_state for the supplied project id.",
              `Project id: ${projectId}. After those reads, make exactly one write using create_design_frame with id ${projectId}, name "VS Code connector acceptance", and html "<main>VS Code MCP acceptance</main>".`,
              "Do not use built-in tools or any other MCP server. Finish after the write and report the project title, read result, and frame id."
            ].join(" "),
            origin: { kind: "user" }
          }
        }
      }
    })
  );

  await waitForChat(180_000);
  if (chatFailure) throw new Error(chatFailure);

  assert.deepEqual(
    completedTools.map((tool) => tool.name),
    ["list_projects", "get_canvas_state", "create_design_frame"],
    "VS Code did not complete the expected Studio MCP read/read/write sequence."
  );
  assert.ok(
    completedTools.every((tool) => tool.success),
    "At least one VS Code MCP call failed."
  );

  const project = await fetch(`${origin}/api/projects/${projectId}?studioToken=${launchToken}`).then((response) =>
    response.json()
  );
  const snapshot = JSON.parse(project.snapshot);
  const frame = snapshot.document.store["shape:landing"];
  assert.equal(frame?.type, "design-frame", "VS Code's MCP write did not persist a design frame.");
  assert.equal(frame.props?.name, "VS Code connector acceptance");
  assert.match(frame.props?.html ?? "", /VS Code MCP acceptance/);
  const vscodeVersion = execFileSync("powershell.exe", ["-NoProfile", "-Command", "code --version"], {
    encoding: "utf8",
    timeout: 10_000
  })
    .trim()
    .split(/\r?\n/)[0];
  console.log(
    `VS Code ${vscodeVersion} Agent Host (${agentInfo.displayName}) MCP acceptance passed: list_projects, get_canvas_state, create_design_frame; persisted ${frame.props.name}.`
  );
} catch (error) {
  const safeMessage = String(error?.message ?? error)
    .replaceAll(launchToken, "[studio-token]")
    .replaceAll(clientToken ?? "\0", "[mcp-token]");
  console.error(safeMessage);
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN && sessionCreated) {
    try {
      await request("disposeSession", { channel: sessionUri }, 5_000);
    } catch {
      // The host may already have disposed a failed session.
    }
  }
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

function onMessage(event) {
  const message = JSON.parse(event.data);
  if (message.id && pendingRequests.has(message.id)) {
    const { resolve, timer } = pendingRequests.get(message.id);
    clearTimeout(timer);
    pendingRequests.delete(message.id);
    resolve(message);
    return;
  }
  if (message.method !== "action") return;

  const { channel, action } = message.params ?? {};
  if (channel === sessionUri) {
    actionHandler?.(action);
    return;
  }
  if (channel !== chatUri || !action) return;

  if (action.type === "chat/toolCallStart") {
    toolNames.set(action.toolCallId, action.toolName);
  } else if (action.type === "chat/toolCallReady") {
    handleToolCallReady(action);
  } else if (action.type === "chat/toolCallComplete") {
    const name = baseToolName(toolNames.get(action.toolCallId));
    const success = action.result?.success === true;
    completedTools.push({ name, success });
    if (!success && !chatFailure) chatFailure = `VS Code MCP tool ${name ?? "unknown"} failed.`;
  } else if (action.type === "chat/error") {
    chatFailure = action.part?.error?.message ?? "VS Code Agent Host returned an error.";
  } else if (action.type === "chat/turnComplete") {
    chatComplete?.();
  }
}

function handleToolCallReady(action) {
  const name = baseToolName(toolNames.get(action.toolCallId));
  const contributor = action.contributor;
  const input = parseToolInput(action.toolInput);
  const isOurMcpServer = contributor?.kind === "mcp" && contributor.customizationId?.includes("mcp=blendersvg");
  let approved = false;

  if (isOurMcpServer && name === "list_projects") approved = Object.keys(input ?? {}).length === 0;
  if (isOurMcpServer && name === "get_canvas_state") approved = input?.id === projectId;
  if (isOurMcpServer && name === "create_design_frame") {
    approved =
      input?.id === projectId &&
      input?.name === "VS Code connector acceptance" &&
      input?.html === "<main>VS Code MCP acceptance</main>";
  }

  if (!approved) {
    chatFailure ??= `VS Code requested an unexpected tool${name ? ` (${name})` : ""}; it was denied.`;
    dispatchChatAction({
      type: "chat/toolCallConfirmed",
      turnId: action.turnId,
      toolCallId: action.toolCallId,
      approved: false,
      reason: "denied"
    });
    return;
  }

  dispatchChatAction({
    type: "chat/toolCallConfirmed",
    turnId: action.turnId,
    toolCallId: action.toolCallId,
    approved: true,
    confirmed: "user-action"
  });
}

function dispatchChatAction(action) {
  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "dispatchAction",
      params: { channel: chatUri, clientSeq: ++clientSeq, action }
    })
  );
}

function request(method, params, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`VS Code Agent Host ${method} timed out.`));
    }, timeoutMs);
    pendingRequests.set(id, { resolve, timer });
    socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
}

async function waitForSession(timeoutMs) {
  let state = null;
  const check = async () => {
    const response = await request("subscribe", { channel: sessionUri });
    assert.ok(!response.error, "Could not read the VS Code Agent Host session state.");
    state = response.result?.snapshot?.state ?? response.result?.state ?? null;
    return state;
  };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    state = await check();
    if (state?.lifecycle === "ready") {
      return state;
    }
    if (state?.lifecycle === "creationFailed") {
      throw new Error(`VS Code Agent Host session failed: ${state.creationError?.message ?? "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const mcpState = findCustomization(
    state?.customizations,
    (item) => item.type === "mcpServer" && item.name === "blendersvg"
  )?.state?.kind;
  throw new Error(
    `VS Code Agent Host session did not become ready (lifecycle=${state?.lifecycle ?? "missing"}, MCP=${mcpState ?? "missing"}).`
  );
}

async function waitForMcpServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let currentState = "missing";
  while (Date.now() < deadline) {
    const response = await request("subscribe", { channel: sessionUri });
    assert.ok(!response.error, "Could not read the VS Code Agent Host session state.");
    const state = response.result?.snapshot?.state ?? response.result?.state;
    const mcpServer = findCustomization(
      state?.customizations,
      (item) => item.type === "mcpServer" && item.name === "blendersvg"
    );
    currentState = mcpServer?.state?.kind ?? "missing";
    if (currentState === "ready") return;
    if (currentState === "failed" || currentState === "authRequired") {
      throw new Error(`VS Code Agent Host blendersvg MCP server entered ${currentState}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`VS Code Agent Host blendersvg MCP server did not become ready (state=${currentState}).`);
}

function dispatchSessionAction(action) {
  socket.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "dispatchAction",
      params: { channel: sessionUri, clientSeq: ++clientSeq, action }
    })
  );
}

function waitForChat(timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chatComplete = null;
      reject(new Error("VS Code Agent Host MCP acceptance timed out."));
    }, timeoutMs);
    chatComplete = () => {
      clearTimeout(timer);
      chatComplete = null;
      resolve();
    };
  });
}

function findCustomization(customizations, predicate) {
  for (const customization of customizations ?? []) {
    if (predicate(customization)) return customization;
    const child = findCustomization(customization.children, predicate);
    if (child) return child;
  }
  return undefined;
}

function baseToolName(toolName = "") {
  return toolName.split(/[./]/).at(-1).split("__").at(-1);
}

function parseToolInput(toolInput) {
  if (typeof toolInput !== "string") return null;
  try {
    return JSON.parse(toolInput);
  } catch {
    return null;
  }
}

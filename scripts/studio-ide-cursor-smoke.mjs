import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kurva-cursor-mcp-"));
const workspaceRoot = path.join(temporaryRoot, "workspace");
const hostRoot = path.join(temporaryRoot, "host");
const launchToken = randomBytes(32).toString("hex");
const projectId = randomUUID();
const projectTitle = "Cursor MCP acceptance";
const distro = process.env.CURSOR_WSL_DISTRO || "Ubuntu";
const cliPathOverride = process.env.CURSOR_AGENT_WSL_PATH;
const userOverride = process.env.CURSOR_WSL_USER;
let user;
let cursorAgent;
let host;
let clientToken;

try {
  user = userOverride || wslOutput(["--distribution", distro, "--exec", "id", "-un"]);
  const home = wslOutput(["--distribution", distro, "--user", user, "--exec", "printenv", "HOME"]);
  cursorAgent = cliPathOverride || `${home.replace(/\/$/, "")}/.local/bin/agent`;
  await Promise.all([mkdir(workspaceRoot, { recursive: true }), mkdir(hostRoot, { recursive: true })]);
  const linuxRoot = wslOutput(["--distribution", distro, "--user", user, "--exec", "wslpath", "-u", root]);
  const linuxWorkspace = wslOutput([
    "--distribution",
    distro,
    "--user",
    user,
    "--exec",
    "wslpath",
    "-u",
    workspaceRoot
  ]);
  const linuxHostRoot = wslOutput(["--distribution", distro, "--user", user, "--exec", "wslpath", "-u", hostRoot]);
  const serverModuleUrl = new URL(`file://${path.posix.join(linuxRoot, "apps/studio-server/src/server.ts")}`).href;
  const serverScript = path.join(hostRoot, "host.mjs");
  await writeFile(serverScript, createHostSource(serverModuleUrl));

  const checkCli = await runCursor(["--version"], linuxWorkspace, workspaceRoot, 15_000);
  assert.equal(checkCli.code, 0, `Could not run Cursor Agent CLI: ${checkCli.output}`);
  const version = checkCli.output.trim();

  host = startWslHost({
    distro,
    user,
    linuxRoot,
    linuxWorkspace,
    linuxHostRoot,
    hostScript: wslOutput(["--distribution", distro, "--user", user, "--exec", "wslpath", "-u", serverScript]),
    projectId,
    projectTitle,
    launchToken
  });
  const hostReady = await host.waitFor("ready", 60_000);
  clientToken = hostReady.clientToken;
  const origin = `http://127.0.0.1:${hostReady.port}`;

  const cursorConfigDirectory = path.join(workspaceRoot, ".cursor");
  await mkdir(cursorConfigDirectory, { recursive: true });
  await writeFile(
    path.join(cursorConfigDirectory, "mcp.json"),
    JSON.stringify({
      mcpServers: {
        blendersvg: {
          url: `${origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`,
          headers: { Authorization: `Bearer ${clientToken}` }
        }
      }
    }),
    { mode: 0o600 }
  );
  await writeFile(
    path.join(workspaceRoot, "AGENTS.md"),
    [
      "For this acceptance, use only the `blendersvg` MCP server.",
      "Do not use shell, file, web, or any other MCP tools.",
      "Call `list_projects`, then `get_canvas_state` for the supplied project id, then call `create_design_frame` with the exact supplied values.",
      "Stop after those three calls and summarize the project title, initial shape count, and frame id."
    ].join("\n")
  );

  const configList = await runCursor(["mcp", "list"], linuxWorkspace, workspaceRoot, 15_000);
  assert.equal(configList.code, 0, `Could not inspect Cursor MCP servers: ${configList.output}`);
  const configuredServers = configList.output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9._-]+):\s/))
    .filter(Boolean)
    .map((match) => match[1]);
  assert.deepEqual(
    configuredServers,
    ["blendersvg"],
    `Refusing to auto-approve unexpected Cursor MCP servers: ${configuredServers.join(", ") || "none discovered"}.`
  );

  const prompt = [
    "Use only the blendersvg MCP server. First call list_projects and get_canvas_state for this project id.",
    `Project id: ${projectId}. Then make exactly one write by calling create_design_frame with id ${projectId}, name "Cursor connector acceptance", and html "<main>Cursor MCP acceptance</main>".`,
    "Do not use built-in tools or any other MCP server. Report the project title, the initial shape count, and the created frame id."
  ].join(" ");
  const agentResult = await runCursor(
    [
      "--print",
      "--output-format",
      "stream-json",
      "--workspace",
      linuxWorkspace,
      "--trust",
      "--sandbox",
      "enabled",
      "--force",
      "--approve-mcps",
      prompt
    ],
    linuxWorkspace,
    workspaceRoot,
    180_000
  );
  const safeOutput = agentResult.output
    .replaceAll(launchToken, "[studio-token]")
    .replaceAll(clientToken, "[mcp-token]");
  assert.equal(agentResult.code, 0, `Cursor Agent CLI exited with ${agentResult.code}.`);
  const streamToolNames = readCursorMcpToolCalls(safeOutput);

  const verifyPromise = host.waitFor("verified", 15_000);
  host.send({ type: "verify" });
  const verification = await verifyPromise;
  const expectedCalls = ["list_projects", "get_canvas_state", "create_design_frame"];
  assert.deepEqual(
    verification.calls,
    expectedCalls,
    `Cursor called ${verification.calls?.join(", ") || "no MCP tools"}; observed ${verification.requests?.join(", ") || "no MCP requests"}. ${readCursorFinalText(safeOutput)}`
  );
  assert.equal(verification.frame?.name, "Cursor connector acceptance", "Cursor's MCP write did not persist a frame.");
  assert.match(verification.frame?.html ?? "", /Cursor MCP acceptance/);
  console.log(
    `Cursor Agent CLI ${version} Studio MCP acceptance passed: ${verification.calls.join(", ")}.${streamToolNames.length ? ` Stream markers: ${streamToolNames.join(", ")}.` : ""}`
  );
} catch (error) {
  const safeMessage = String(error?.message ?? error)
    .replaceAll(launchToken, "[studio-token]")
    .replaceAll(clientToken ?? "\0", "[mcp-token]");
  console.error(safeMessage);
  process.exitCode = 1;
} finally {
  if (host) {
    try {
      await host.stop();
    } catch (error) {
      console.error(`Could not stop the temporary WSL Studio host cleanly: ${error.message}`);
    }
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

function wslOutput(args) {
  return execFileSync("wsl.exe", args, { encoding: "utf8", timeout: 15_000 }).trim();
}

function runCursor(args, linuxCwd, windowsCwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "wsl.exe",
      ["--distribution", distro, "--user", user, "--cd", linuxCwd, "--exec", cursorAgent, ...args],
      { cwd: windowsCwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    let output = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) reject(new Error("Cursor Studio MCP acceptance timed out."));
      else resolve({ code, signal, output });
    });
  });
}

function createHostSource(serverModuleUrl) {
  return `import { startStudioServer } from ${JSON.stringify(serverModuleUrl)};
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const [repoRoot, hostRoot, projectId, projectTitle] = process.argv.slice(2);
const launchToken = process.env.KURVA_STUDIO_TOKEN;
if (!launchToken) throw new Error("Missing temporary Studio launch token.");
const library = path.join(hostRoot, "library");
await mkdir(library, { recursive: true });
const server = await startStudioServer(0, path.join(repoRoot, "apps/studio/dist"), launchToken, undefined, library);
const toolCalls = [];
const mcpRequests = [];
server.prependListener("request", (request) => {
  if (request.method !== "POST" || !request.url?.startsWith("/mcp")) return;
  const chunks = [];
  request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  request.on("end", () => {
    try {
      const call = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      mcpRequests.push(call.method + (call.params?.name ? ":" + call.params.name : ""));
      if (call.method === "tools/call" && typeof call.params?.name === "string") toolCalls.push(call.params.name);
    } catch {
      // The Studio server performs authoritative JSON-RPC validation.
    }
  });
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not read the temporary Studio host address.");
const origin = \`http://127.0.0.1:\${address.port}\`;
const clientResponse = await fetch(\`\${origin}/api/mcp-clients?studioToken=\${launchToken}\`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Cursor acceptance", permission: "apply" })
});
const client = await clientResponse.json();
if (!clientResponse.ok || typeof client.token !== "string") throw new Error("Could not create the temporary Cursor MCP client.");
const projectResponse = await fetch(\`\${origin}/api/projects?studioToken=\${launchToken}\`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: projectId,
    title: projectTitle,
    snapshot: JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } })
  })
});
if (!projectResponse.ok) throw new Error(\`Could not create the temporary Cursor MCP project: \${await projectResponse.text()}\`);

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}

const input = readline.createInterface({ input: process.stdin });
input.on("line", async (line) => {
  try {
    const message = JSON.parse(line);
    if (message.type === "verify") {
      const response = await fetch(\`\${origin}/api/projects/\${projectId}?studioToken=\${launchToken}\`);
      if (!response.ok) throw new Error("Could not verify the persisted Cursor project.");
      const project = await response.json();
      const snapshot = JSON.parse(project.snapshot);
      const frame = Object.entries(snapshot.document.store).find(
        ([id, record]) => id === "shape:landing" && record.typeName === "shape" && record.type === "design-frame"
      )?.[1];
      send({
        type: "verified",
        calls: toolCalls,
        requests: mcpRequests,
        frame: frame ? { name: frame.props?.name, html: frame.props?.html } : null
      });
    } else if (message.type === "stop") {
      server.closeAllConnections();
      server.close(() => {
        send({ type: "stopped" });
        input.close();
        process.exit(0);
      });
    }
  } catch (error) {
    send({ type: "error", message: String(error?.message ?? error) });
  }
});

send({ type: "ready", port: address.port, clientToken: client.token });
`;
}

function startWslHost({
  distro,
  user,
  linuxRoot,
  linuxWorkspace,
  linuxHostRoot,
  hostScript,
  projectId,
  projectTitle,
  launchToken
}) {
  const forwardedVariables = new Set((process.env.WSLENV || "").split(":").filter(Boolean));
  forwardedVariables.add("KURVA_STUDIO_TOKEN");
  const child = spawn(
    "wsl.exe",
    [
      "--distribution",
      distro,
      "--user",
      user,
      "--cd",
      linuxRoot,
      "--exec",
      "node",
      "--experimental-strip-types",
      hostScript,
      linuxRoot,
      linuxHostRoot,
      projectId,
      projectTitle
    ],
    {
      cwd: root,
      env: { ...process.env, KURVA_STUDIO_TOKEN: launchToken, WSLENV: [...forwardedVariables].join(":") },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  let stdoutBuffer = "";
  let stderr = "";
  let closeResult;
  const messages = [];
  const waiters = [];
  const closePromise = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      closeResult = { code, signal };
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error(`Temporary WSL Studio host exited (${code ?? signal}): ${stderr.slice(-1000)}`));
      }
      resolve(closeResult);
    });
  });
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (stdoutBuffer.includes("\n")) {
      const newline = stdoutBuffer.indexOf("\n");
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      try {
        publish(JSON.parse(line));
      } catch {
        stderr += `\nUnexpected host output: ${line.slice(0, 400)}`;
      }
    }
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
  child.once("error", (error) => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  });

  function publish(message) {
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    } else {
      messages.push(message);
    }
  }

  function waitFor(type, timeoutMs) {
    const queuedIndex = messages.findIndex((message) => message.type === type);
    if (queuedIndex >= 0) return Promise.resolve(messages.splice(queuedIndex, 1)[0]);
    if (closeResult)
      return Promise.reject(new Error(`Temporary WSL Studio host already exited (${closeResult.code}).`));
    return new Promise((resolve, reject) => {
      const waiter = { type, resolve, reject, timeout: null };
      waiter.timeout = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`Timed out waiting for temporary WSL Studio host ${type}. ${stderr.slice(-1000)}`));
      }, timeoutMs);
      waiters.push(waiter);
    });
  }

  function send(message) {
    if (!child.stdin.writable) throw new Error("Temporary WSL Studio host is not accepting commands.");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async function stop() {
    if (closeResult) return;
    const stopped = waitFor("stopped", 10_000);
    send({ type: "stop" });
    await stopped;
    const result = await closePromise;
    if (result.code !== 0) throw new Error(`Temporary WSL Studio host exited with ${result.code}.`);
  }

  return { linuxWorkspace, waitFor, send, stop };
}

function readCursorMcpToolCalls(output) {
  const expectedNames = ["list_projects", "get_canvas_state", "create_design_frame"];
  const toolEvents = output
    .split(/\r?\n/)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((event) => event?.type === "tool_call" && event.subtype === "started");
  const names = toolEvents.map((event) => {
    const serialized = JSON.stringify(event);
    return (
      expectedNames.find((name) => serialized.includes(name)) ??
      (serialized.toLowerCase().includes("mcp") ? "unexpected_mcp_tool" : null)
    );
  });
  return names.filter(Boolean);
}

function readCursorFinalText(output) {
  for (const line of output.split(/\r?\n/).reverse()) {
    try {
      const event = JSON.parse(line);
      if (event?.type === "result" && typeof event.result === "string") return event.result.slice(-1000);
    } catch {
      // Ignore non-JSON terminal output.
    }
  }
  return "";
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kurva-qoder-mcp-"));
const library = path.join(temporaryRoot, "library");
const configPath = path.join(temporaryRoot, "mcp.json");
const qoderCli = path.join(
  process.env.APPDATA ?? "",
  "npm",
  "node_modules",
  "@qoder-ai",
  "qodercli",
  "bundle",
  "qodercli.js"
);
const ide = process.argv[2] === "claude" ? "claude" : "qoder";
const requestedModel = process.argv[3]?.trim();
const launchToken = randomBytes(32).toString("hex");
const projectId = randomUUID();
const projectTitle = "Qoder MCP acceptance";
await mkdir(library, { recursive: true });
const server = await startStudioServer(0, path.join(root, "apps", "studio", "dist"), launchToken, undefined, library);
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

try {
  const clientResponse = await fetch(`${origin}/api/mcp-clients?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Qoder acceptance", permission: "apply" })
  });
  const client = await clientResponse.json();
  assert.equal(clientResponse.status, 200);
  assert.equal(typeof client.token, "string");

  const projectResponse = await fetch(`${origin}/api/projects?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: projectId,
      title: projectTitle,
      snapshot: JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } })
    })
  });
  assert.equal(projectResponse.status, 200, await projectResponse.text());

  const mcpUrl = `${origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`;
  await writeFile(
    configPath,
    JSON.stringify({
      mcpServers: {
        blendersvg: {
          ...(ide === "claude" ? { type: "http" } : {}),
          url: mcpUrl,
          headers: { Authorization: `Bearer ${client.token}` }
        }
      }
    }),
    { mode: 0o600 }
  );

  const prompt = [
    "Use only the blendersvg MCP server. First call list_projects and get_canvas_state with the provided project id.",
    `Project id: ${projectId}. Then make exactly one write by calling create_design_frame with id ${projectId}, name "Qoder connector acceptance", and HTML "<main>Qoder MCP acceptance</main>".`,
    "Do not use built-in tools or other MCP servers. Report the project title, the read shape count, and the created frame id."
  ].join(" ");
  const cliArgs =
    ide === "claude"
      ? [
          "--print",
          ...(requestedModel ? ["--model", requestedModel] : []),
          "--bare",
          "--no-session-persistence",
          "--mcp-config",
          configPath,
          "--strict-mcp-config",
          "--tools",
          "",
          "--allowedTools",
          "mcp__blendersvg__list_projects",
          "mcp__blendersvg__get_canvas_state",
          "mcp__blendersvg__create_design_frame",
          "--output-format",
          "text",
          "--max-turns",
          "8",
          prompt
        ]
      : [
          "--print",
          "--permission-mode",
          "auto",
          ...(requestedModel ? ["--model", requestedModel] : []),
          "--no-session-persistence",
          "--mcp-config",
          configPath,
          "--strict-mcp-config",
          "--allowed-mcp-server-names",
          "blendersvg",
          "--tools",
          "",
          "--cwd",
          temporaryRoot,
          "--max-output-tokens",
          "1000",
          prompt
        ];
  const cliResult = await run(
    ide === "claude" ? "claude" : process.execPath,
    ide === "claude" ? cliArgs : [qoderCli, ...cliArgs],
    temporaryRoot,
    180_000
  );
  const safeOutput = cliResult.output.replaceAll(launchToken, "[studio-token]").replaceAll(client.token, "[mcp-token]");
  process.stdout.write(safeOutput.slice(-5000));
  assert.equal(cliResult.code, 0, `${ide} CLI exited with ${cliResult.code}.`);

  const project = await fetch(`${origin}/api/projects/${projectId}?studioToken=${launchToken}`).then((response) =>
    response.json()
  );
  const snapshot = JSON.parse(project.snapshot);
  const frame = Object.entries(snapshot.document.store).find(
    ([id, record]) => id === "shape:landing" && record.typeName === "shape" && record.type === "design-frame"
  )?.[1];
  assert.ok(frame, "Qoder's MCP write persisted the design frame.");
  assert.equal(frame.props?.name, "Qoder connector acceptance");
  assert.match(frame.props?.html ?? "", /Qoder MCP acceptance/);
  console.log(`${ide} Studio MCP read/write acceptance passed.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("IDE MCP acceptance timed out."));
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kurva-codex-mcp-"));
const library = path.join(temporaryRoot, "library");
const codexCli = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
const launchToken = randomBytes(32).toString("hex");
const projectId = randomUUID();
const projectTitle = "Codex MCP acceptance";
const projectSnapshot = JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } });
let server;
let codex;
let output = "";

try {
  await mkdir(library, { recursive: true });
  server = await startStudioServer(0, path.join(root, "apps", "studio", "dist"), launchToken, undefined, library);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;

  const clientResponse = await fetch(`${origin}/api/mcp-clients?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Codex acceptance", permission: "apply" })
  });
  const client = await clientResponse.json();
  assert.equal(clientResponse.status, 200);
  assert.equal(typeof client.token, "string");

  const projectResponse = await fetch(`${origin}/api/projects?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: projectId, title: projectTitle, snapshot: projectSnapshot })
  });
  assert.equal(projectResponse.status, 200, await projectResponse.text());

  const mcpUrl = `${origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`;
  const prompt = [
    "Use only the blendersvg MCP server. First call list_projects and get_canvas_state for the provided project id.",
    `Project id: ${projectId}. Then make exactly one write by calling create_design_frame with id ${projectId}, name "Codex connector acceptance", and HTML "<main>Codex MCP acceptance</main>".`,
    "Do not use built-in tools or other MCP servers. Report the project title, the read shape count, and the created frame id."
  ].join(" ");
  assert.ok(existsSync(codexCli), "Codex npm CLI entry point is installed.");
  codex = spawn(
    process.execPath,
    [
      codexCli,
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--skip-git-repo-check",
      "--approve-for-me",
      "-c",
      `mcp_servers.blendersvg.url=${JSON.stringify(mcpUrl)}`,
      "-c",
      'mcp_servers.blendersvg.bearer_token_env_var="BLENDERSVG_MCP_TOKEN"',
      prompt
    ],
    {
      cwd: root,
      env: { ...process.env, BLENDERSVG_MCP_TOKEN: client.token },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  codex.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
  codex.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));
  const exitCode = await waitForExit(codex, 180_000);
  const safeOutput = output.replaceAll(launchToken, "[studio-token]").replaceAll(client.token, "[mcp-token]");
  process.stdout.write(safeOutput.slice(-5000));
  assert.equal(exitCode, 0, `Codex CLI exited with ${exitCode}.`);

  const project = await fetch(`${origin}/api/projects/${projectId}?studioToken=${launchToken}`).then((response) =>
    response.json()
  );
  const snapshot = JSON.parse(project.snapshot);
  const frame = Object.entries(snapshot.document.store).find(
    ([id, record]) => id === "shape:landing" && record.typeName === "shape" && record.type === "design-frame"
  )?.[1];
  assert.ok(frame, "Codex's MCP write persisted the design frame.");
  assert.equal(frame.props?.name, "Codex connector acceptance");
  assert.match(frame.props?.html ?? "", /Codex MCP acceptance/);
  console.log("Codex Studio MCP read/write acceptance passed.");
} finally {
  if (codex && codex.exitCode === null) codex.kill();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Codex MCP acceptance timed out."));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code ?? 0);
    });
  });
}

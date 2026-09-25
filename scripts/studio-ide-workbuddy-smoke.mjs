import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "kurva-workbuddy-mcp-"));
const workspaceRoot = path.join(temporaryRoot, "workspace");
const libraryRoot = path.join(temporaryRoot, "library");
const launchToken = randomBytes(32).toString("hex");
const projectId = randomUUID();
const projectTitle = "WorkBuddy MCP acceptance";
let server;

try {
  await Promise.all([
    mkdir(path.join(workspaceRoot, ".workbuddy"), { recursive: true }),
    mkdir(libraryRoot, { recursive: true })
  ]);

  server = await startStudioServer(0, path.join(root, "apps", "studio", "dist"), launchToken, undefined, libraryRoot);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not read the temporary Studio host address.");
  const origin = `http://127.0.0.1:${address.port}`;

  const clientResponse = await fetch(`${origin}/api/mcp-clients?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "WorkBuddy acceptance", permission: "apply" })
  });
  const client = await clientResponse.json();
  if (!clientResponse.ok || typeof client.token !== "string") {
    throw new Error("Could not create the temporary WorkBuddy MCP client.");
  }

  const projectResponse = await fetch(`${origin}/api/projects?studioToken=${launchToken}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: projectId,
      title: projectTitle,
      snapshot: JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } })
    })
  });
  if (!projectResponse.ok) {
    throw new Error(`Could not create the temporary WorkBuddy project: ${await projectResponse.text()}`);
  }

  const mcpUrl = `${origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`;
  await writeFile(
    path.join(workspaceRoot, ".workbuddy", "mcp.json"),
    JSON.stringify({
      mcpServers: {
        blendersvg: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${client.token}` }
        }
      }
    }),
    { mode: 0o600 }
  );

  const calls = [];
  const requests = [];
  server.prependListener("request", (request) => {
    if (request.method !== "POST" || !request.url?.startsWith("/mcp")) return;
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        requests.push(message.method + (message.params?.name ? `:${message.params.name}` : ""));
        if (message.method === "tools/call" && typeof message.params?.name === "string") {
          calls.push(message.params.name);
        }
      } catch {
        // Studio performs authoritative JSON-RPC validation.
      }
    });
  });

  process.stdout.write(
    `${JSON.stringify({
      type: "ready",
      version: "5.5.2 (910352f0)",
      projectId,
      workspaceRoot,
      prompt: `Use only the blendersvg MCP server. Call list_projects, then get_canvas_state for project ${projectId}, then make exactly one write by calling create_design_frame with id ${projectId}, name "WorkBuddy connector acceptance", and html "<main>WorkBuddy MCP acceptance</main>". Do not use built-in tools, other MCP servers, or modify workspace files. Report the project title, initial shape count, and created frame id.`
    })}\n`
  );

  const input = createInterface({ input: process.stdin });
  for await (const line of input) {
    const command = line.trim();
    if (command === "verify") {
      const response = await fetch(`${origin}/api/projects/${projectId}?studioToken=${launchToken}`);
      if (!response.ok) throw new Error("Could not verify the persisted WorkBuddy project.");
      const project = await response.json();
      const snapshot = JSON.parse(project.snapshot);
      const frame = Object.entries(snapshot.document.store).find(
        ([id, record]) => id === "shape:landing" && record.typeName === "shape" && record.type === "design-frame"
      )?.[1];
      process.stdout.write(
        `${JSON.stringify({
          type: "verified",
          calls,
          requests,
          frameId: frame ? "shape:landing" : null,
          frameName: frame?.props?.name ?? null,
          frameHtml: frame?.props?.html ?? null
        })}\n`
      );
    } else if (command === "stop") {
      input.close();
      break;
    }
  }
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}

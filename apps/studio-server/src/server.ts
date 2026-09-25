import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, STATUS_CODES } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  createHostToStudioMessage,
  type HostToStudioMessageInput,
  parseStudioToHostMessage,
  type StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { readLibraryAsset, writeLibraryAsset } from "@codex-avatar-studio/studio-host-core/assetStore";
import { generateSvgWithQuiver } from "@codex-avatar-studio/asset-pipeline";
import { previewImageToSvg } from "@codex-avatar-studio/asset-pipeline";
import { probeBlenderExecutable } from "@codex-avatar-studio/studio-host-core/blenderProbe";
import { runBlenderCommand, type BlenderCommandRunner } from "@codex-avatar-studio/studio-host-core/blenderRunner";
import {
  conversationRecord,
  deleteConversation,
  listConversations,
  readConversation,
  renameConversation,
  writeConversation
} from "@codex-avatar-studio/studio-host-core/conversationStore";
import type { SecretKeyring } from "@codex-avatar-studio/studio-host-core/hostSecrets";
import { resolveOpenRouterSecret, saveOpenRouterSecret } from "@codex-avatar-studio/studio-host-core/hostSecrets";
import { OpenRouterChatController } from "@codex-avatar-studio/studio-host-core/openRouterChat";
import {
  OPENROUTER_SECRET_KEY,
  OpenRouterConnectionController,
  type SecretStore
} from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import { StudioProjectStore, StudioProjectStoreError } from "@codex-avatar-studio/studio-host-core/studioProjectStore";
import {
  readProjectThumbnail,
  removeProjectThumbnail,
  writeProjectThumbnail
} from "@codex-avatar-studio/studio-host-core/thumbnailStore";
import { type Context, Hono } from "hono";
import { WebSocket, WebSocketServer } from "ws";
import { readBlenderGlbAsset, sendSvgToBlender } from "./blenderSend.ts";
import { handleAvatarPackageRoute } from "./avatarPackageRoute.ts";
import { type BlenderSupportState, blenderStatusMessage } from "./blenderStatus.ts";
import {
  guardStudioRequest,
  MAX_AVATAR_PACKAGE_REQUEST_BYTES,
  MAX_QUIVER_GENERATION_BODY_BYTES,
  readCookieToken,
  sessionCookie
} from "./hostSecurity.ts";
import {
  applyConcurrentEdits,
  authorizeMcpCall,
  createMcpClient,
  createSavedDesignFrame,
  createSavedShapes,
  deleteSavedShape,
  exportSavedFrame,
  insertSavedSvg,
  type McpClient,
  publicMcpClient,
  readDesignFrameHtml,
  readProjectStyle,
  readSavedSelection,
  summarizeCanvasSnapshot,
  touchMcpClient,
  updateSavedShape,
  validateMcpTool
} from "./mcpAccess.ts";
import { mcpJsonRpcResult } from "./mcpJsonRpc.ts";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverPackageRoot =
  path.basename(path.dirname(serverDirectory)) === "dist"
    ? path.resolve(serverDirectory, "../..")
    : path.resolve(serverDirectory, "..");
const STATIC_ROOT = path.resolve(serverPackageRoot, "../studio/dist");
const EXTENSION_ROOT = path.resolve(serverPackageRoot, "../extension");

export function createStudioApp(
  staticRoot = STATIC_ROOT,
  launchToken = randomBytes(32).toString("hex"),
  keyring?: SecretKeyring,
  libraryRoot?: string,
  probeBlender?: () => Promise<{
    supportState: BlenderSupportState;
    version: string | null;
    executablePath?: string | null;
  }>,
  mcpClients: McpClient[] = [],
  blenderRunner: BlenderCommandRunner = runBlenderCommand,
  quiverKeyring?: SecretKeyring,
  quiverRequest: typeof fetch = fetch
) {
  const projects = libraryRoot ? new StudioProjectStore(() => libraryRoot, "library") : null;
  const app = new Hono();
  const recent: number[] = [];
  let canvasRevision = 0;
  let pendingMcpProposal: { badge: string; name: string; arguments: string } | null = null;
  let pendingLiveEdit: { name: string; arguments: string } | null = null;
  let pendingScreenshot: {
    id: string;
    frameId: string;
    resolve: (pngDataUrl: string) => void;
    reject: (error: Error) => void;
  } | null = null;
  const sessions = new Set<string>();
  let quiverEnabled = false;
  const requestLiveScreenshot = (frameId: string) =>
    new Promise<string>((resolve, reject) => {
      if (pendingScreenshot) pendingScreenshot.reject(new Error("A newer screenshot replaced this request."));
      const id = randomBytes(8).toString("hex");
      const timer = setTimeout(() => {
        if (pendingScreenshot?.id === id) pendingScreenshot = null;
        reject(new Error("The live editor did not return a screenshot."));
      }, 4_000);
      pendingScreenshot = {
        id,
        frameId,
        resolve: (pngDataUrl) => {
          clearTimeout(timer);
          resolve(pngDataUrl);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      };
    });

  app.all("*", async (c) => {
    const now = Date.now();
    while (recent[0] !== undefined && recent[0] < now - 60_000) recent.shift();
    recent.push(now);
    const url = new URL(c.req.url);
    const headerHost = c.req.header("host") || url.host;
    const decision = guardStudioRequest({
      method: c.req.method,
      host: headerHost,
      urlHost: url.host,
      origin: c.req.header("origin") ?? null,
      cookieToken: readCookieToken(c.req.header("cookie") ?? null),
      queryToken: url.searchParams.get("studioToken"),
      contentLength: Number(c.req.header("content-length") ?? "0") || null,
      ...(url.pathname === "/api/quiver/generate"
        ? { maxBodyBytes: MAX_QUIVER_GENERATION_BODY_BYTES }
        : url.pathname === "/api/avatar-package"
          ? { maxBodyBytes: MAX_AVATAR_PACKAGE_REQUEST_BYTES }
          : {}),
      upgrade: (c.req.header("upgrade") ?? "").toLowerCase() === "websocket",
      launchToken,
      recentCount: recent.length - 1
    });
    if (decision.status !== 200) {
      return c.text(decision.message, decision.status as 401 | 403 | 413 | 421 | 429, decision.headers);
    }
    const headers = { ...decision.headers };
    if (decision.setCookie) headers["set-cookie"] = sessionCookie(launchToken);
    const assetMatch = /^\/assets\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (assetMatch?.[1] && libraryRoot) {
      if (c.req.method === "GET") {
        const asset = await readLibraryAsset(libraryRoot, assetMatch[1]);
        if (!asset) return c.text("Not found.", 404, headers);
        return c.body(Buffer.from(asset.bytes), 200, { ...headers, "content-type": asset.contentType });
      }
      if (c.req.method === "POST") {
        const type = (c.req.header("content-type") ?? "").split(";")[0] ?? "";
        await writeLibraryAsset(libraryRoot, assetMatch[1], type, new Uint8Array(await c.req.arrayBuffer()));
        return c.json({ src: `/assets/${assetMatch[1]}` }, 200, headers);
      }
    }
    if (url.pathname.includes("/conversations") && libraryRoot) {
      return handleConversationRoute(c, libraryRoot, headers);
    }
    if (url.pathname.startsWith("/api/projects")) {
      if (!projects) return c.json({ message: "The Studio library is not available on this launch." }, 503, headers);
      return handleProjectRoute(c, projects, headers, libraryRoot);
    }
    if (url.pathname === "/api/avatar-package") return handleAvatarPackageRoute(c, headers);
    if (url.pathname === "/api/openrouter-key") return handleOpenRouterKeyRoute(c, headers, keyring);
    if (url.pathname === "/api/quiver")
      return handleQuiverSettingsRoute(
        c,
        headers,
        quiverKeyring,
        () => quiverEnabled,
        (enabled) => {
          quiverEnabled = enabled;
        }
      );
    if (url.pathname === "/api/quiver/generate")
      return handleQuiverGenerateRoute(c, headers, quiverKeyring, () => quiverEnabled, quiverRequest);
    const glbMatch = /^\/api\/blender-asset\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (glbMatch?.[1] && libraryRoot && c.req.method === "GET") {
      const glb = await readBlenderGlbAsset(libraryRoot, glbMatch[1]);
      if (!glb) return c.text("Not found.", 404, headers);
      return c.body(Buffer.from(glb), 200, { ...headers, "content-type": "model/gltf-binary" });
    }
    if (url.pathname === "/api/blender")
      return handleBlenderRoute(c, headers, probeBlender, libraryRoot, blenderRunner);
    if (url.pathname === "/mcp")
      return handleMcpRoute(
        c,
        headers,
        mcpClients,
        projects,
        libraryRoot,
        () => canvasRevision,
        (next) => {
          canvasRevision = next;
        },
        (proposal) => {
          pendingMcpProposal = proposal;
        },
        sessions,
        requestLiveScreenshot,
        (edit) => {
          pendingLiveEdit = edit;
        }
      );
    if (url.pathname === "/api/mcp-screenshot") {
      if (c.req.method === "GET") {
        return c.json(
          { request: pendingScreenshot ? { id: pendingScreenshot.id, frameId: pendingScreenshot.frameId } : null },
          200,
          headers
        );
      }
      if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
      const body = (await c.req.json().catch(() => null)) as {
        requestId?: unknown;
        pngDataUrl?: unknown;
        error?: unknown;
      } | null;
      const current = pendingScreenshot;
      if (!current || body?.requestId !== current.id) return c.json({ ok: false }, 409, headers);
      pendingScreenshot = null;
      if (typeof body.error === "string" && body.error.trim()) {
        current.reject(new Error(body.error));
        return c.json({ ok: false }, 200, headers);
      }
      if (typeof body.pngDataUrl !== "string" || !body.pngDataUrl.startsWith("data:image/png;base64,")) {
        current.reject(new Error("The live editor returned a screenshot that is not a PNG."));
        return c.json({ ok: false }, 400, headers);
      }
      current.resolve(body.pngDataUrl);
      return c.json({ ok: true }, 200, headers);
    }
    if (url.pathname === "/api/mcp-live-edit") {
      const edit = pendingLiveEdit;
      pendingLiveEdit = null;
      return c.json({ edit }, 200, headers);
    }
    if (url.pathname === "/api/mcp-proposal") {
      const proposal = pendingMcpProposal;
      pendingMcpProposal = null;
      return c.json({ proposal }, 200, headers);
    }
    if (url.pathname === "/api/mcp-clients") return handleMcpClientsRoute(c, headers, mcpClients);
    if (url.pathname.startsWith("/api/")) return c.text("Unknown API route.", 404, headers);

    const filePath = studioFilePath(staticRoot, new URL(c.req.url).pathname);
    if (!filePath) return c.text("That path is outside the Studio build.", 403);

    try {
      const info = await stat(filePath);
      if (!info.isFile()) return c.text("Not found.", 404);
      const body = await readFile(filePath);
      return c.body(body, 200, { ...headers, "content-type": contentType(filePath) });
    } catch {
      return c.text("Studio build is missing. Run pnpm build:studio.", 503);
    }
  });

  return app;
}

async function handleMcpClientsRoute(
  c: Context,
  headers: Record<string, string>,
  clients: McpClient[]
): Promise<Response> {
  if (c.req.method === "GET") return c.json({ clients: clients.map(publicMcpClient) }, 200, headers);
  if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  const body = (await c.req.json().catch(() => null)) as {
    action?: unknown;
    name?: unknown;
    permission?: unknown;
    id?: unknown;
  } | null;
  const action = body?.action;
  if (action === "rename" || action === "revoke" || action === "permission") {
    const client = clients.find((item) => item.id === body?.id);
    if (!client) return c.json({ error: "missing" }, 404, headers);
    if (action === "revoke") client.revoked = true;
    if (action === "rename" && typeof body?.name === "string")
      client.name = body.name.trim().slice(0, 80) || client.name;
    if (action === "permission") {
      if (body?.permission !== "read" && body?.permission !== "propose" && body?.permission !== "apply") {
        return c.json({ error: "permission" }, 400, headers);
      }
      client.permission = body.permission;
    }
    return c.json({ client: publicMcpClient(client) }, 200, headers);
  }
  const permission = body?.permission === "apply" || body?.permission === "propose" ? body.permission : "read";
  const token = randomBytes(32).toString("hex");
  const client = createMcpClient(clients, typeof body?.name === "string" ? body.name : "IDE", permission, token);
  return c.json({ client: publicMcpClient(client), token }, 200, headers);
}

async function handleMcpRoute(
  c: Context,
  headers: Record<string, string>,
  clients: McpClient[],
  projects: StudioProjectStore | null,
  libraryRoot: string | undefined,
  readRevision: () => number,
  writeRevision: (revision: number) => void,
  stageProposal: (proposal: { badge: string; name: string; arguments: string }) => void,
  sessions: Set<string>,
  requestLiveScreenshot: (frameId: string) => Promise<string>,
  stageLiveEdit: (edit: { name: string; arguments: string }) => void
): Promise<Response> {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const client = clients.find((item) => item.token === token);
  const tool = new URL(c.req.url).searchParams.get("tool") ?? "get_canvas_state";
  const decision = authorizeMcpCall(client, tool);
  if (decision === "missing" || decision === "revoked") return c.json({ error: decision }, 401, headers);
  if (client) touchMcpClient(client, new Date().toISOString());
  if (c.req.method === "GET" && (c.req.header("accept") ?? "").includes("text/event-stream")) {
    const session = c.req.header("mcp-session-id") ?? "";
    if (!sessions.has(session)) return c.json({ error: "MCP session required." }, 400, headers);
    return c.body(
      `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"ready"}}\n\n`,
      200,
      { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache" }
    );
  }
  if (decision === "read-only") return c.json({ error: decision }, 403, headers);
  const args = c.req.method === "POST" ? await c.req.json().catch(() => null) : undefined;
  if (args && typeof args === "object" && (args as { jsonrpc?: unknown }).jsonrpc === "2.0") {
    const method = (args as { method?: unknown }).method;
    const session = c.req.header("mcp-session-id") ?? "";
    if (method !== "initialize" && !sessions.has(session)) {
      return c.json({ jsonrpc: "2.0", error: { code: -32001, message: "MCP session required." } }, 400, headers);
    }
    if (typeof method === "string" && method.startsWith("notifications/")) {
      return c.body(null, 202, headers);
    }
    if (method === "tools/call") {
      const call = args as { id?: unknown; params?: { name?: string } };
      if (call.params?.name && authorizeMcpCall(client, call.params.name) === "read-only") {
        return c.json({ error: "read-only" }, 403, headers);
      }
      if (
        call.params?.name === "list_projects" ||
        call.params?.name === "open_project" ||
        call.params?.name === "get_canvas_state" ||
        call.params?.name === "get_styles" ||
        call.params?.name === "get_selection" ||
        call.params?.name === "get_frame_code" ||
        call.params?.name === "export_frame" ||
        call.params?.name === "update_shapes" ||
        call.params?.name === "delete_shapes" ||
        call.params?.name === "create_shapes" ||
        call.params?.name === "insert_svg" ||
        call.params?.name === "create_design_frame" ||
        call.params?.name === "screenshot_frame" ||
        call.params?.name === "vectorize_image"
      ) {
        let text = "[]";
        if (call.params.name === "vectorize_image") {
          const callArgs = (call.params as { arguments?: { imagePath?: string; engine?: string } }).arguments;
          const imagePath = path.resolve(String(callArgs?.imagePath ?? ""));
          const engine = callArgs?.engine === "imagetracer" ? "imagetracer" : "vtracer";
          const root = libraryRoot ? path.resolve(libraryRoot) : "";
          const relative = root ? path.relative(root, imagePath) : "..";
          if (!root || relative.startsWith("..") || path.isAbsolute(relative)) {
            text = JSON.stringify({ error: "The image must stay inside the Studio library." });
          } else {
            try {
              const preview = await previewImageToSvg({ inputPath: imagePath, workspaceRoot: root, engine });
              text = JSON.stringify({
                engine,
                svg: preview.optimizedSvg.includes("<svg")
              });
            } catch (error) {
              text = JSON.stringify({
                error: error instanceof Error ? error.message : "The image could not be vectorized."
              });
            }
          }
        } else if (call.params.name === "screenshot_frame") {
          const callArgs = (call.params as { arguments?: { frameId?: string } }).arguments;
          const frameId = String(callArgs?.frameId ?? "");
          try {
            const pngDataUrl = await requestLiveScreenshot(frameId);
            text = JSON.stringify({ kind: "canvas-raster", frameId, pngDataUrl });
          } catch (error) {
            text = JSON.stringify({
              error: error instanceof Error ? error.message : "The live editor did not return a screenshot."
            });
          }
        } else if (call.params.name === "create_design_frame") {
          const callArgs = (call.params as { arguments?: { id?: string; name?: string; html?: string } }).arguments;
          try {
            const project = projects ? await projects.open(String(callArgs?.id ?? "")) : null;
            if (!project) text = JSON.stringify({ error: "Project not found." });
            else {
              const next = createSavedDesignFrame(
                project.snapshot,
                "shape:landing",
                String(callArgs?.name ?? "Design"),
                String(callArgs?.html ?? "")
              );
              await projects?.save(project.id, project.title, next);
              text = JSON.stringify({ created: "shape:landing", script: next.toLowerCase().includes("<script") });
            }
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "insert_svg") {
          const callArgs = (call.params as { arguments?: { id?: string; svg?: string } }).arguments;
          try {
            const project = projects ? await projects.open(String(callArgs?.id ?? "")) : null;
            const next = project
              ? insertSavedSvg(project.snapshot, "shape:svg", String(callArgs?.svg ?? ""))
              : { error: "Project not found." };
            if (!project || typeof next !== "string")
              text = JSON.stringify(typeof next === "string" ? { error: "Project not found." } : next);
            else {
              await projects?.save(project.id, project.title, next);
              text = JSON.stringify({ inserted: "shape:svg", script: next.toLowerCase().includes("<script") });
            }
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "create_shapes") {
          const callArgs = (
            call.params as {
              arguments?: { id?: string; shapes?: Array<{ id?: string; name?: string; w?: number; h?: number }> };
            }
          ).arguments;
          try {
            const project = projects ? await projects.open(String(callArgs?.id ?? "")) : null;
            const shapes = (callArgs?.shapes ?? []).flatMap((shape) =>
              shape.id && shape.name ? [{ id: shape.id, name: shape.name, w: shape.w ?? 10, h: shape.h ?? 10 }] : []
            );
            if (!project || !shapes.length) text = JSON.stringify({ error: "Shape not found." });
            else {
              await projects?.save(project.id, project.title, createSavedShapes(project.snapshot, shapes));
              text = JSON.stringify({ created: shapes.map((shape) => shape.id) });
            }
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "delete_shapes") {
          const callArgs = (call.params as { arguments?: { id?: string; shapeIds?: string[] } }).arguments;
          try {
            const project = projects ? await projects.open(String(callArgs?.id ?? "")) : null;
            const shapeId = callArgs?.shapeIds?.[0] ?? "";
            const next = project && shapeId ? deleteSavedShape(project.snapshot, shapeId) : null;
            if (!project || !next) text = JSON.stringify({ error: "Shape not found." });
            else {
              await projects?.save(project.id, project.title, next);
              text = JSON.stringify({ deleted: shapeId });
            }
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "update_shapes") {
          const callArgs = (
            call.params as { arguments?: { id?: string; updates?: Array<{ id?: string; name?: string }> } }
          ).arguments;
          try {
            const project = projects ? await projects.open(String(callArgs?.id ?? "")) : null;
            const update = callArgs?.updates?.[0];
            const next =
              project && update?.id
                ? updateSavedShape(
                    project.snapshot,
                    update.id,
                    typeof update.name === "string" ? { name: update.name } : {}
                  )
                : null;
            if (!project || !next) text = JSON.stringify({ error: "Shape not found." });
            else {
              await projects?.save(project.id, project.title, next);
              text = JSON.stringify({
                updated: update?.id,
                ...(typeof update?.name === "string" ? { name: update.name } : {})
              });
            }
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "list_projects") {
          const listed = projects ? await projects.list() : { projects: [] };
          text = JSON.stringify(listed.projects.map((item) => ({ id: item.id, title: item.title })));
        } else if (call.params.name === "export_frame") {
          const args = (call.params as { arguments?: { id?: string; frameId?: string; format?: string } }).arguments;
          if (args?.format === "png") {
            try {
              const pngDataUrl = await requestLiveScreenshot(String(args.frameId ?? ""));
              text = JSON.stringify({ format: "png", pngDataUrl });
            } catch (error) {
              text = JSON.stringify({
                error: error instanceof Error ? error.message : "The live editor did not return a PNG export."
              });
            }
          } else {
            try {
              const project = projects ? await projects.open(String(args?.id ?? "")) : null;
              text = JSON.stringify(
                project
                  ? exportSavedFrame(project.snapshot, String(args?.frameId ?? ""), String(args?.format ?? ""))
                  : { error: "Project not found." }
              );
            } catch {
              text = JSON.stringify({ error: "Project not found." });
            }
          }
        } else if (call.params.name === "get_frame_code") {
          const args = (call.params as { arguments?: { id?: string; frameId?: string } }).arguments;
          try {
            const project = projects ? await projects.open(String(args?.id ?? "")) : null;
            const html = project ? readDesignFrameHtml(project.snapshot, String(args?.frameId ?? "")) : null;
            text = JSON.stringify(html ? { html } : { error: "Design frame not found." });
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "get_selection") {
          const id = String((call.params as { arguments?: { id?: string } }).arguments?.id ?? "");
          try {
            const project = projects ? await projects.open(id) : null;
            text = JSON.stringify(
              project ? { selectedShapeIds: readSavedSelection(project.snapshot) } : { error: "Project not found." }
            );
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "get_styles") {
          const id = String((call.params as { arguments?: { id?: string } }).arguments?.id ?? "");
          try {
            const project = projects ? await projects.open(id) : null;
            text = JSON.stringify(project ? readProjectStyle(project.snapshot) : { error: "Project not found." });
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else if (call.params.name === "get_canvas_state") {
          const id = String((call.params as { arguments?: { id?: string } }).arguments?.id ?? "");
          try {
            const project = projects ? await projects.open(id) : null;
            text = JSON.stringify(
              project ? summarizeCanvasSnapshot(project.snapshot) : { error: "Project not found." }
            );
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        } else {
          const id = String((call.params as { arguments?: { id?: string } }).arguments?.id ?? "");
          try {
            const project = projects ? await projects.open(id) : null;
            text = JSON.stringify(project ? { id: project.id, title: project.title } : { error: "Project not found." });
          } catch {
            text = JSON.stringify({ error: "Project not found." });
          }
        }
        const liveWrites = new Set([
          "create_design_frame",
          "create_shapes",
          "update_shapes",
          "delete_shapes",
          "insert_svg"
        ]);
        if (call.params.name && liveWrites.has(call.params.name) && !text.includes('"error"')) {
          const raw = { ...((call.params as { arguments?: Record<string, unknown> }).arguments ?? {}) };
          delete raw.id;
          delete raw.baseRevision;
          stageLiveEdit({ name: call.params.name, arguments: JSON.stringify(raw) });
        }
        return c.json(
          {
            jsonrpc: "2.0",
            id: call.id ?? null,
            result: { content: [{ type: "text", text }] }
          },
          200,
          headers
        );
      }
    }
    const body = mcpJsonRpcResult(args);
    if (method === "initialize") {
      const sessionId = randomBytes(16).toString("hex");
      sessions.add(sessionId);
      return c.json(body, 200, { ...headers, "mcp-session-id": sessionId });
    }
    return c.json(body, 200, headers);
  }
  const problem = validateMcpTool(tool, args === null ? undefined : args);
  if (problem) return c.json({ error: problem }, 400, headers);
  const record = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  const write =
    tool !== "get_canvas_state" &&
    tool !== "get_selection" &&
    tool !== "get_styles" &&
    tool !== "screenshot_frame" &&
    tool !== "get_frame_code" &&
    tool !== "list_projects" &&
    tool !== "open_project" &&
    tool !== "export_frame";
  if (write && client?.permission === "propose") {
    stageProposal({ badge: client.name, name: tool, arguments: JSON.stringify(record) });
    return c.json({ proposal: true, badge: client.name, undo: false }, 202, headers);
  }
  if (typeof record.baseRevision === "number") {
    const result = applyConcurrentEdits(readRevision(), [
      { source: "mcp", baseRevision: record.baseRevision, shapeId: tool }
    ]);
    if (result.conflicts.length) return c.json({ error: "conflict", revision: readRevision() }, 409, headers);
    writeRevision(result.revision);
  }
  return c.json(
    {
      ok: true,
      permission: client?.permission ?? "read",
      revision: readRevision(),
      badge: client?.name ?? "MCP",
      undo: write
    },
    200,
    headers
  );
}

async function handleBlenderRoute(
  c: Context,
  headers: Record<string, string>,
  probeBlender:
    | (() => Promise<{ supportState: BlenderSupportState; version: string | null; executablePath?: string | null }>)
    | undefined,
  libraryRoot: string | undefined,
  blenderRunner: BlenderCommandRunner
): Promise<Response> {
  if (c.req.method !== "GET" && c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  const probed = probeBlender
    ? await probeBlender()
    : await probeBlenderExecutable({ timeoutMs: 4_000 }).then((result) => ({
        supportState: result.supportState,
        version: result.version?.version ?? null,
        executablePath: result.executablePath
      }));
  const status = blenderStatusMessage(probed.supportState, probed.version);
  if (c.req.method === "GET") return c.json(status, 200, headers);
  if (probed.supportState !== "supported" || !probed.executablePath) {
    return c.json(status, 409, headers);
  }
  const body = (await c.req.json().catch(() => null)) as { svg?: unknown; sourceName?: unknown } | null;
  if (!body || typeof body.svg !== "string" || !body.svg.includes("<svg")) {
    return c.json({ ...status, sent: false, message: "Select an SVG before sending it to Blender." }, 400, headers);
  }
  if (!libraryRoot) {
    return c.json(
      { ...status, sent: false, message: "The Studio library is not available on this launch." },
      503,
      headers
    );
  }
  try {
    const result = await sendSvgToBlender({
      libraryRoot,
      svg: body.svg,
      sourceName: typeof body.sourceName === "string" && body.sourceName.trim() ? body.sourceName : "selection.svg",
      blenderPath: probed.executablePath,
      extensionRoot: EXTENSION_ROOT,
      processRunner: blenderRunner
    });
    return c.json({ ...status, ...result }, 200, headers);
  } catch (error) {
    return c.json(
      {
        ...status,
        sent: false,
        message: error instanceof Error ? error.message : "Send to Blender failed. No source scene was modified."
      },
      502,
      headers
    );
  }
}

async function handleOpenRouterKeyRoute(
  c: Context,
  headers: Record<string, string>,
  keyring?: SecretKeyring
): Promise<Response> {
  if (!keyring) return c.json({ configured: false, source: "none" }, 503, headers);
  if (c.req.method === "GET") return c.json(await resolveOpenRouterSecret(keyring), 200, headers);
  if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  const body = (await c.req.json().catch(() => null)) as { key?: unknown; action?: unknown } | null;
  if (body?.action === "disconnect") {
    await keyring.set("");
    return c.json(await resolveOpenRouterSecret(keyring), 200, headers);
  }
  if (body?.action === "test") {
    const status = await resolveOpenRouterSecret(keyring);
    return c.json({ ok: status.configured, configured: status.configured, source: status.source }, 200, headers);
  }
  if (!body || typeof body.key !== "string") return c.json({ configured: false, source: "none" }, 400, headers);
  try {
    return c.json(await saveOpenRouterSecret(keyring, body.key), 200, headers);
  } catch {
    return c.json({ configured: false, source: "none" }, 400, headers);
  }
}

type QuiverStatus = { available: boolean; configured: boolean; enabled: boolean; message: string };

async function handleQuiverSettingsRoute(
  c: Context,
  headers: Record<string, string>,
  keyring: SecretKeyring | undefined,
  isEnabled: () => boolean,
  setEnabled: (enabled: boolean) => void
): Promise<Response> {
  const status = async (): Promise<QuiverStatus> => {
    if (!keyring) {
      return {
        available: false,
        configured: false,
        enabled: false,
        message: "Secure key storage is unavailable on this computer."
      };
    }
    const configured = Boolean((await keyring.get())?.trim());
    return {
      available: true,
      configured,
      enabled: configured && isEnabled(),
      message: configured
        ? "QuiverAI is connected to the local Studio host."
        : "Add your QuiverAI API key to enable remote SVG generation."
    };
  };

  if (c.req.method === "GET") return c.json(await status(), 200, headers);
  if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  if (!keyring) return c.json(await status(), 503, headers);
  const body = (await c.req.json().catch(() => null)) as { action?: unknown; key?: unknown } | null;
  if (body?.action === "enable") {
    if (!(await keyring.get())?.trim())
      return c.json(
        { ...(await status()), message: "Save a QuiverAI API key before enabling this engine." },
        409,
        headers
      );
    setEnabled(true);
    return c.json(await status(), 200, headers);
  }
  if (body?.action === "disable") {
    setEnabled(false);
    return c.json(await status(), 200, headers);
  }
  if (body?.action === "clear") {
    await keyring.set("");
    setEnabled(false);
    return c.json(await status(), 200, headers);
  }
  if (body?.action === "save" && typeof body.key === "string") {
    const key = body.key.trim();
    if (!key || key.length > 1_024)
      return c.json({ ...(await status()), message: "Enter a valid QuiverAI API key." }, 400, headers);
    await keyring.set(key);
    return c.json(await status(), 200, headers);
  }
  return c.json({ ...(await status()), message: "Choose save, clear, enable, or disable." }, 400, headers);
}

async function handleQuiverGenerateRoute(
  c: Context,
  headers: Record<string, string>,
  keyring: SecretKeyring | undefined,
  isEnabled: () => boolean,
  quiverRequest: typeof fetch
): Promise<Response> {
  if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  if (!keyring) return c.json({ message: "Secure key storage is unavailable on this computer." }, 503, headers);
  if (!isEnabled())
    return c.json({ message: "QuiverAI is off. Enable the remote SVG engine before generating." }, 403, headers);
  const apiKey = (await keyring.get())?.trim();
  if (!apiKey) return c.json({ message: "Add a QuiverAI API key in this dialog before generating." }, 409, headers);

  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength > MAX_QUIVER_GENERATION_BODY_BYTES) {
    return c.json({ message: "This generation request is too large. Use a smaller reference image." }, 413, headers);
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return c.json({ message: "The generation request was not valid JSON." }, 400, headers);
  }
  if (!body || typeof body !== "object")
    return c.json({ message: "The generation request is incomplete." }, 400, headers);
  const record = body as Record<string, unknown>;
  if (record.consentConfirmed !== true) {
    return c.json({ message: "Confirm the exact prompt and reference image disclosure before sending." }, 400, headers);
  }
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const model = typeof record.model === "string" ? record.model : "arrow-1.1";
  if (model.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) {
    return c.json({ message: "Choose a valid QuiverAI model." }, 400, headers);
  }
  const referenceImages = record.referenceImages;
  if (
    referenceImages !== undefined &&
    (!Array.isArray(referenceImages) ||
      referenceImages.length > 4 ||
      referenceImages.some((item) => typeof item !== "string"))
  ) {
    return c.json({ message: "Choose up to four PNG or JPEG reference images." }, 400, headers);
  }
  try {
    const result = await generateSvgWithQuiver({
      apiKey,
      prompt,
      model,
      ...(Array.isArray(referenceImages) ? { referenceImages: referenceImages as string[] } : {}),
      signal: c.req.raw.signal,
      fetcher: quiverRequest
    });
    return c.json({ svg: result.svg, ...(result.usage ? { usage: result.usage } : {}) }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuiverAI could not generate this SVG.";
    const status =
      message.includes("prompt") || message.includes("reference") || message.includes("cancelled") ? 400 : 502;
    return c.json({ message }, status, headers);
  }
}

export function startStudioServer(
  port = 0,
  staticRoot?: string,
  launchToken = randomBytes(32).toString("hex"),
  keyring?: SecretKeyring,
  libraryRoot?: string,
  providerRequest: typeof fetch = fetch,
  quiverKeyring?: SecretKeyring,
  quiverRequest: typeof fetch = fetch
): Promise<Server> {
  const app = createStudioApp(
    staticRoot ?? STATIC_ROOT,
    launchToken,
    keyring,
    libraryRoot,
    undefined,
    [],
    undefined,
    quiverKeyring,
    quiverRequest
  );
  const server = createServer(async (request, response) => {
    const host = request.headers.host || "127.0.0.1";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }
    const method = request.method ?? "GET";
    const body =
      method === "GET" || method === "HEAD" ? undefined : (Readable.toWeb(request) as ReadableStream<Uint8Array>);
    const init = {
      method,
      headers,
      ...(body ? { body, duplex: "half" as const } : {})
    } as RequestInit & { duplex?: "half" };
    const result = await app.fetch(new Request(url, init));
    response.statusCode = result.status;
    result.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });
    response.end(Buffer.from(await result.arrayBuffer()));
  });
  const socketServer = new WebSocketServer({ noServer: true, maxPayload: 8_000_000, perMessageDeflate: false });
  let recentUpgrades: number[] = [];
  server.on("upgrade", (request, socket, head) => {
    const requestUrl = safeRequestUrl(request);
    if (requestUrl?.pathname !== "/api/studio") {
      rejectUpgrade(socket, 404, "Unknown Studio socket.");
      return;
    }
    const now = Date.now();
    recentUpgrades = recentUpgrades.filter((time) => time >= now - 60_000);
    const host = request.headers.host ?? requestUrl.host;
    const decision = guardStudioRequest({
      method: request.method ?? "GET",
      host,
      urlHost: requestUrl.host,
      origin: headerValue(request.headers.origin),
      cookieToken: readCookieToken(headerValue(request.headers.cookie)),
      queryToken: requestUrl.searchParams.get("studioToken"),
      contentLength: Number(headerValue(request.headers["content-length"]) ?? "0") || null,
      upgrade: true,
      launchToken,
      recentCount: recentUpgrades.length
    });
    if (decision.status !== 200) {
      rejectUpgrade(socket, decision.status, decision.message);
      return;
    }
    recentUpgrades.push(now);
    socketServer.handleUpgrade(request, socket, head, (client) => {
      socketServer.emit("connection", client, request);
    });
  });
  socketServer.on("connection", (client) => {
    handleStudioSocket(client, keyring, providerRequest);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function handleStudioSocket(
  socket: WebSocket,
  keyring: SecretKeyring | undefined,
  providerRequest: typeof fetch
): void {
  const secretStore: SecretStore = {
    async get(key) {
      if (key !== OPENROUTER_SECRET_KEY) return undefined;
      const stored = await keyring?.get();
      return stored?.trim() || process.env.OPENROUTER_API_KEY?.trim() || undefined;
    },
    async store(key, value) {
      if (key !== OPENROUTER_SECRET_KEY || !keyring) throw new Error("Secure key storage is unavailable.");
      await keyring.set(value);
    },
    async delete(key) {
      if (key !== OPENROUTER_SECRET_KEY || !keyring) throw new Error("Secure key storage is unavailable.");
      await keyring.set("");
    }
  };
  const send = (message: HostToStudioMessageInput): void => {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(createHostToStudioMessage(message)));
    } catch {
      socket.close(1008, "Invalid Studio host message.");
    }
  };
  const sendHostState = (connection: Extract<HostToStudioMessageInput, { type: "studio:hostState" }>["connection"]) =>
    send({ type: "studio:hostState", host: "standalone", workspaceTrusted: true, connection });
  const chat = new OpenRouterChatController(secretStore, send, providerRequest);
  const connection = new OpenRouterConnectionController(
    secretStore,
    async () => undefined,
    sendHostState,
    providerRequest,
    "the operating system keychain"
  );
  let disposed = false;
  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      socket.close(1003, "Studio protocol messages must be text.");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      return;
    }
    const parsed = parseStudioToHostMessage(raw);
    if (!parsed.success) return;
    void handleStandaloneStudioMessage(parsed.data, chat, connection, send, sendHostState);
  });
  socket.on("close", () => {
    if (disposed) return;
    disposed = true;
    chat.dispose();
    connection.dispose();
  });
  socket.on("error", () => undefined);
}

async function handleStandaloneStudioMessage(
  message: StudioToHostMessage,
  chat: OpenRouterChatController,
  connection: OpenRouterConnectionController,
  send: (message: HostToStudioMessageInput) => void,
  sendHostState: (connection: Extract<HostToStudioMessageInput, { type: "studio:hostState" }>["connection"]) => void
): Promise<void> {
  if (message.type === "studio:ready") {
    sendHostState(await connection.currentState());
  } else if (message.type === "studio:modelCatalogRequest") {
    send(await chat.refreshModels());
  } else if (message.type === "studio:chatRequest") {
    void chat.send(message);
  } else if (message.type === "studio:chatCancel" || message.type === "studio:agentStop") {
    chat.cancel(message.requestId);
  } else if (message.type === "studio:toolPermission") {
    chat.resolveToolPermission(message.requestId, message.callId, message.granted);
  } else if (message.type === "studio:toolExecutionResult") {
    chat.resolveToolExecutionResult(message.requestId, message.callId, {
      ok: message.ok,
      content: message.content,
      ...(message.imageDataUrl ? { imageDataUrl: message.imageDataUrl } : {})
    });
  } else if (message.type === "studio:openRouterConnection") {
    if (message.action === "connect" || message.action === "replace") {
      sendHostState({ status: "error", message: "Enter or replace the key in Settings on this computer." });
      return;
    }
    if (message.action === "disconnect") chat.cancelAll();
    const state = await connection.run(message.action);
    sendHostState(state);
  }
}

function safeRequestUrl(request: IncomingMessage): URL | null {
  try {
    const host = request.headers.host;
    if (!host) return null;
    return new URL(request.url ?? "/", `http://${host}`);
  } catch {
    return null;
  }
}

function headerValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function rejectUpgrade(socket: import("node:stream").Duplex, status: number, message: string): void {
  const statusText = STATUS_CODES[status] ?? "Bad Request";
  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
  );
}

export async function handleProjectRoute(
  c: Context,
  projects: StudioProjectStore,
  headers: Record<string, string>,
  libraryRoot?: string
): Promise<Response> {
  const url = new URL(c.req.url);
  const match = /^\/api\/projects(?:\/([0-9a-f-]{36})(?:\/(rename|duplicate|delete|thumbnail))?)?$/.exec(url.pathname);
  if (!match) return c.json({ message: "Unknown project route." }, 404, headers);
  const id = match[1];
  const action = match[2];
  try {
    if (!id && c.req.method === "POST") {
      const body = (await c.req.json()) as { id?: unknown; title?: unknown; snapshot?: unknown };
      if (typeof body.id !== "string" || typeof body.title !== "string" || typeof body.snapshot !== "string") {
        return c.json({ message: "Project id, title, and snapshot are required." }, 400, headers);
      }
      return c.json(await projects.save(body.id, body.title, body.snapshot), 200, headers);
    }
    if (!id) return c.json(await projects.list(), 200, headers);
    if (c.req.method === "GET" && !action) return c.json(await projects.open(id), 200, headers);
    if (c.req.method === "POST" && action === "rename") {
      const body = (await c.req.json()) as { title?: unknown };
      if (typeof body.title !== "string") return c.json({ message: "A title is required." }, 400, headers);
      return c.json(await projects.rename(id, body.title), 200, headers);
    }
    if (c.req.method === "POST" && action === "duplicate") return c.json(await projects.duplicate(id), 200, headers);
    if (libraryRoot && action === "thumbnail" && c.req.method === "GET") {
      const bytes = await readProjectThumbnail(libraryRoot, id);
      if (!bytes) return c.text("Thumbnail not found.", 404, headers);
      return c.body(Buffer.from(bytes), 200, { ...headers, "content-type": "image/png" });
    }
    if (libraryRoot && action === "thumbnail" && c.req.method === "POST") {
      try {
        await projects.open(id);
      } catch (error) {
        if (error instanceof StudioProjectStoreError && error.code === "missing") {
          return c.text("Project not found.", 404, headers);
        }
        throw error;
      }
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      await writeProjectThumbnail(libraryRoot, id, bytes);
      return c.json({ stored: true }, 200, headers);
    }
    if (c.req.method === "POST" && action === "delete") {
      const body = (await c.req.json()) as { confirm?: unknown };
      if (body.confirm !== true) return c.json({ message: "Delete needs confirmation." }, 400, headers);
      await projects.delete(id);
      if (libraryRoot) await removeProjectThumbnail(libraryRoot, id);
      return c.json({ deleted: true }, 200, headers);
    }
    return c.json({ message: "That project action is not available." }, 405, headers);
  } catch (error) {
    const message = error instanceof StudioProjectStoreError ? error.message : "The project could not be saved.";
    const status = error instanceof StudioProjectStoreError && error.code === "missing" ? 404 : 400;
    return c.json({ message }, status, headers);
  }
}

export async function handleConversationRoute(
  c: Context,
  libraryRoot: string,
  headers: Record<string, string>
): Promise<Response> {
  const url = new URL(c.req.url);
  const match = /^\/api\/projects\/([0-9a-f-]{36})\/conversations(?:\/([0-9a-f-]{36})(?:\/(rename|delete))?)?$/.exec(
    url.pathname
  );
  if (!match) return c.json({ message: "Unknown conversation route." }, 404, headers);
  const projectId = match[1] ?? "";
  const id = match[2];
  const action = match[3];
  if (!id && c.req.method === "GET") {
    return c.json(await listConversations(libraryRoot, projectId), 200, headers);
  }
  if (!id && c.req.method === "POST") {
    const body = conversationRecord(await c.req.json().catch(() => null));
    if (!body || body.projectId !== projectId)
      return c.json({ message: "The conversation was rejected." }, 400, headers);
    await writeConversation(libraryRoot, body);
    return c.json({ id: body.id, modelId: body.modelId }, 200, headers);
  }
  if (!id) return c.json({ message: "A conversation id is required." }, 404, headers);
  if (c.req.method === "GET") {
    const stored = await readConversation(libraryRoot, projectId, id);
    if (!stored) return c.json({ message: "Not found." }, 404, headers);
    return c.json(stored, 200, headers);
  }
  if (c.req.method === "POST" && action === "rename") {
    const body = (await c.req.json().catch(() => null)) as { title?: unknown } | null;
    if (!body || typeof body.title !== "string") return c.json({ message: "A title is required." }, 400, headers);
    const renamed = await renameConversation(libraryRoot, projectId, id, body.title);
    return c.json({ id: renamed.id, title: renamed.title }, 200, headers);
  }
  if (c.req.method === "POST" && action === "delete") {
    const body = (await c.req.json().catch(() => null)) as { confirm?: unknown } | null;
    if (body?.confirm !== true) return c.json({ message: "Delete requires confirm: true." }, 400, headers);
    await deleteConversation(libraryRoot, projectId, id);
    return c.json({ deleted: true }, 200, headers);
  }
  return c.json({ message: "Unknown conversation route." }, 404, headers);
}

export function studioFilePath(staticRoot: string, pathname: string): string | null {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("..")) return null;
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = path.resolve(staticRoot, relative);
  if (!filePath.startsWith(path.resolve(staticRoot) + path.sep) && filePath !== path.resolve(staticRoot)) return null;
  return filePath;
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

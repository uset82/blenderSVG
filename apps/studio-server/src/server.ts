import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { readLibraryAsset, writeLibraryAsset } from "@codex-avatar-studio/studio-host-core/assetStore";
import {
  conversationRecord,
  deleteConversation,
  readConversation,
  renameConversation,
  writeConversation
} from "@codex-avatar-studio/studio-host-core/conversationStore";
import type { SecretKeyring } from "@codex-avatar-studio/studio-host-core/hostSecrets";
import { StudioProjectStore, StudioProjectStoreError } from "@codex-avatar-studio/studio-host-core/studioProjectStore";
import { readProjectThumbnail, writeProjectThumbnail } from "@codex-avatar-studio/studio-host-core/thumbnailStore";
import { type Context, Hono } from "hono";
import { guardStudioRequest, readCookieToken, sessionCookie } from "./hostSecurity.ts";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverPackageRoot =
  path.basename(path.dirname(serverDirectory)) === "dist"
    ? path.resolve(serverDirectory, "../..")
    : path.resolve(serverDirectory, "..");
const STATIC_ROOT = path.resolve(serverPackageRoot, "../studio/dist");

export function createStudioApp(
  staticRoot = STATIC_ROOT,
  launchToken = randomBytes(32).toString("hex"),
  keyring?: SecretKeyring,
  libraryRoot?: string
) {
  const projects = libraryRoot ? new StudioProjectStore(() => libraryRoot, "library") : null;
  const app = new Hono();
  const recent: number[] = [];

  app.all("*", async (c) => {
    const now = Date.now();
    while (recent.length > 0 && recent[0]! < now - 60_000) recent.shift();
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

export function startStudioServer(
  port = 0,
  staticRoot?: string,
  launchToken = randomBytes(32).toString("hex"),
  keyring?: SecretKeyring,
  libraryRoot?: string
): Promise<Server> {
  const app = createStudioApp(staticRoot ?? STATIC_ROOT, launchToken, keyring, libraryRoot);
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

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
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
      return c.body(Buffer.from(bytes), 200, { ...headers, "content-type": "image/png" });
    }
    if (libraryRoot && action === "thumbnail" && c.req.method === "POST") {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      await writeProjectThumbnail(libraryRoot, id, bytes);
      return c.json({ stored: true }, 200, headers);
    }
    if (c.req.method === "POST" && action === "delete") {
      const body = (await c.req.json()) as { confirm?: unknown };
      if (body.confirm !== true) return c.json({ message: "Delete needs confirmation." }, 400, headers);
      await projects.delete(id);
      return c.json({ deleted: true }, 200, headers);
    }
    return c.json({ message: "That project action is not available." }, 405, headers);
  } catch (error) {
    const message = error instanceof StudioProjectStoreError ? error.message : "The project could not be saved.";
    return c.json({ message }, 400, headers);
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
    if (!body || body.confirm !== true) return c.json({ message: "Delete requires confirm: true." }, 400, headers);
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

function isLoopbackHost(host: string): boolean {
  if (!host || host === ":") return true;
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]";
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

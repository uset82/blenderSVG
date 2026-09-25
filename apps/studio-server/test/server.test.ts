import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { createStudioToHostMessage } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { WebSocket as TestWebSocket } from "ws";
import { createStudioApp, startStudioServer, studioFilePath } from "../src/server.js";

describe("studio server", () => {
  it("binds to loopback and serves a built file", async () => {
    const root = path.join(tmpdir(), `studio-server-${Date.now()}`);
    const library = path.join(tmpdir(), `studio-server-library-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await mkdir(library, { recursive: true });
    await writeFile(path.join(root, "index.html"), "<title>Kurva</title>");
    const server = await startStudioServer(0, root, "test-token", undefined, library);
    const address = server.address();
    expect(typeof address === "object" && address?.address).toBe("127.0.0.1");
    const port = typeof address === "object" && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(`${origin}/?studioToken=test-token`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Kurva");
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toContain("studio_session=");

      const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
      const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });
      const saved = await fetch(`${origin}/api/projects`, {
        method: "POST",
        headers: { origin, cookie: cookie ?? "", "content-type": "application/json" },
        body: JSON.stringify({ id, title: "Server round trip", snapshot })
      });
      const savedBody = await saved.text();
      expect(saved.status, savedBody).toBe(200);
      const opened = await fetch(`${origin}/api/projects/${id}`, { headers: { cookie: cookie ?? "" } });
      expect(opened.status).toBe(200);
      expect(await opened.json()).toMatchObject({ id, title: "Server round trip", formatVersion: 1 });
      expect(await readdir(path.join(library, "projects"))).toContain(`${id}.json`);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("rejects a path that leaves the Studio build", async () => {
    const root = path.join(tmpdir(), `studio-server-path-${Date.now()}`);
    await mkdir(root, { recursive: true });
    expect(studioFilePath(root, "/%2e%2e/%2e%2e/secret")).toBeNull();
    expect(studioFilePath(root, "/index.html")).toBe(path.join(root, "index.html"));
  });

  it("stores a provider key on the host and does not echo it", async () => {
    const root = path.join(tmpdir(), `studio-key-route-${Date.now()}`);
    let stored: string | null = null;
    const keyring = {
      async get() {
        return stored;
      },
      async set(value: string) {
        stored = value;
      }
    };
    const app = createStudioApp(root, "test-token", keyring);
    const response = await app.fetch(
      new Request("http://127.0.0.1/api/openrouter-key?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ key: "sk-or-test-secret" })
      })
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain("sk-or-test-secret");
    expect(JSON.parse(body)).toEqual({ configured: true, source: "keychain" });
    expect(stored).toBe("sk-or-test-secret");
  });

  it("keeps QuiverAI disabled by default and only sends reviewed, selected content through the host", async () => {
    const root = path.join(tmpdir(), `studio-quiver-${Date.now()}`);
    let stored: string | null = null;
    let providerCall: { url: string; authorization: string | null; body: Record<string, unknown> } | null = null;
    const quiverKeyring = {
      async get() {
        return stored;
      },
      async set(value: string) {
        stored = value;
      }
    };
    const quiverRequest: typeof fetch = async (input, init) => {
      providerCall = {
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>
      };
      return new Response(
        JSON.stringify({
          data: [
            {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="bad()"><script>bad()</script><path d="M0 0h10v10z"/></svg>'
            }
          ],
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const app = createStudioApp(
      root,
      "test-token",
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      quiverKeyring,
      quiverRequest
    );
    const request = (path: string, init?: RequestInit) =>
      app.fetch(
        new Request(`http://127.0.0.1${path}?studioToken=test-token`, {
          ...init,
          headers: { origin: "http://127.0.0.1", ...(init?.headers as Record<string, string> | undefined) }
        })
      );

    const initial = (await (await request("/api/quiver")).json()) as { configured: boolean; enabled: boolean };
    expect(initial).toEqual(expect.objectContaining({ available: true, configured: false, enabled: false }));

    const blocked = await request("/api/quiver/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "private prompt", consentConfirmed: true })
    });
    expect(blocked.status).toBe(403);
    expect(providerCall).toBeNull();

    const saved = await request("/api/quiver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", key: "qv-test-secret" })
    });
    const savedText = await saved.text();
    expect(saved.status).toBe(200);
    expect(savedText).not.toContain("qv-test-secret");
    expect(JSON.parse(savedText)).toMatchObject({ configured: true, enabled: false });

    const enable = await request("/api/quiver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "enable" })
    });
    expect(await enable.json()).toMatchObject({ configured: true, enabled: true });

    const noConsent = await request("/api/quiver/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "private prompt", referenceImages: ["aGVsbG8="], consentConfirmed: false })
    });
    expect(noConsent.status).toBe(400);
    expect(providerCall).toBeNull();

    const generated = await request("/api/quiver/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "arrow-1.1",
        prompt: "private prompt",
        referenceImages: ["aGVsbG8="],
        consentConfirmed: true
      })
    });
    const responseText = await generated.text();
    expect(generated.status).toBe(200);
    expect(responseText).not.toContain("qv-test-secret");
    expect(responseText).not.toMatch(/script|onload/i);
    expect(JSON.parse(responseText)).toMatchObject({ usage: { totalTokens: 30 } });
    expect(providerCall).toEqual({
      url: "https://api.quiver.ai/v1/svgs/generations",
      authorization: "Bearer qv-test-secret",
      body: expect.objectContaining({
        model: "arrow-1.1",
        prompt: "private prompt",
        references: [{ base64: "aGVsbG8=" }]
      })
    });
  });

  it("reports a missing Blender install without changing a scene", async () => {
    const app = createStudioApp(
      path.join(tmpdir(), "studio-blender-missing"),
      "test-token",
      undefined,
      undefined,
      async () => ({
        supportState: "not-found",
        version: null
      })
    );
    const response = await app.fetch(
      new Request("http://127.0.0.1/api/blender?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1" }
      })
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { supportState: string; message: string };
    expect(body.supportState).toBe("not-found");
    expect(body.message).toContain("no scene file is changed");
  });

  it("sends a selected SVG through the copy handoff and returns GLB and PNG assets", async () => {
    const library = path.join(tmpdir(), `studio-blender-send-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const sourceBlend = path.join(library, "user-source.blend");
    writeFileSync(sourceBlend, "KEEP-SOURCE");
    const scripts: string[] = [];
    const app = createStudioApp(
      path.join(tmpdir(), "studio-blender-send-static"),
      "test-token",
      undefined,
      library,
      async () => ({ supportState: "supported", version: "4.5.0", executablePath: "fake-blender" }),
      [],
      async (_command, args) => {
        const script = args.find((arg) => arg.endsWith(".py")) ?? "";
        scripts.push(path.basename(script));
        const output = args[args.indexOf("--output") + 1] ?? "";
        const report = args[args.indexOf("--manifest") + 1] ?? "";
        const input = args[args.indexOf("--input") + 1] ?? "";
        if (script.endsWith("import_svg_scene.py")) {
          writeFileSync(output, Buffer.from("BLENDER-v300fixture"));
          writeFileSync(
            report,
            JSON.stringify({
              schemaVersion: 1,
              mode: "svg-handoff",
              sourceFile: path.basename(input),
              outputFile: path.basename(output),
              collection: "Export",
              objectCount: 1,
              guidance: "Editable curves are not a rig."
            })
          );
        } else if (script.endsWith("export_glb.py")) {
          writeFileSync(output, minimalGlb());
          writeFileSync(report, exportReport("glb", input, output));
        } else if (script.endsWith("render_turntable.py")) {
          writeFileSync(
            output,
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              "base64"
            )
          );
          writeFileSync(report, exportReport("png", input, output));
        }
        return { stdout: "", stderr: "" };
      }
    );
    const response = await app.fetch(
      new Request("http://127.0.0.1/api/blender?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
          sourceName: "selection.svg"
        })
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sent: boolean; sceneFile: string; pngSrc: string; glbSrc: string };
    expect(body.sent).toBe(true);
    expect(body.sceneFile.endsWith(".working.blend")).toBe(true);
    expect(scripts).toEqual(["import_svg_scene.py", "export_glb.py", "render_turntable.py"]);
    expect(readFileSync(sourceBlend, "utf8")).toBe("KEEP-SOURCE");
    const png = await app.fetch(
      new Request(`http://127.0.0.1${body.pngSrc}?studioToken=test-token`, { headers: { origin: "http://127.0.0.1" } })
    );
    expect(png.headers.get("content-type")).toBe("image/png");
    const glb = await app.fetch(
      new Request(`http://127.0.0.1${body.glbSrc}?studioToken=test-token`, { headers: { origin: "http://127.0.0.1" } })
    );
    expect(glb.headers.get("content-type")).toBe("model/gltf-binary");
  });

  it("vectorizes a library image on the Studio MCP host", async () => {
    const library = path.join(tmpdir(), `studio-vectorize-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const image = path.join(library, "mark.png");
    writeFileSync(image, png8());
    const app = createStudioApp(
      path.join(tmpdir(), "studio-vectorize-static"),
      "test-token",
      undefined,
      library,
      undefined,
      [
        {
          id: "client-apply",
          name: "Cursor",
          token: "token-apply",
          permission: "apply",
          revoked: false,
          lastSeen: null
        }
      ]
    );
    const opened = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
      })
    );
    const notified = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": opened.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
      })
    );
    expect(notified.status).toBe(202);
    const traced = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": opened.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "vectorize_image", arguments: { imagePath: image, engine: "imagetracer" } }
        })
      })
    );
    const body = (await traced.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(body.result?.content?.[0]?.text).toContain('"svg":true');
    const outside = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": opened.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "vectorize_image",
            arguments: { imagePath: path.join(tmpdir(), "outside.png"), engine: "imagetracer" }
          }
        })
      })
    );
    const rejected = (await outside.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(rejected.result?.content?.[0]?.text).toContain("Studio library");
  });

  it("requires an MCP token and rejects revoked or read-only writes", async () => {
    const clients = [
      {
        id: "client-1",
        name: "Cursor",
        token: "token-live",
        permission: "read" as const,
        revoked: false,
        lastSeen: null
      },
      {
        id: "client-2",
        name: "Codex",
        token: "token-revoked",
        permission: "apply" as const,
        revoked: true,
        lastSeen: null
      }
    ];
    const app = createStudioApp(
      path.join(tmpdir(), "studio-mcp"),
      "test-token",
      undefined,
      undefined,
      undefined,
      clients
    );
    const missing = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", { headers: { origin: "http://127.0.0.1" } })
    );
    expect(missing.status).toBe(401);
    const revoked = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-revoked" }
      })
    );
    expect(revoked.status).toBe(401);
    const readOnly = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live" }
      })
    );
    expect(readOnly.status).toBe(403);
    const read = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=get_selection", {
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live" }
      })
    );
    expect(read.status).toBe(200);
    const opened = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
      })
    );
    const sessionId = opened.headers.get("mcp-session-id") ?? "";
    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);
    const withoutSession = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
      })
    );
    expect(withoutSession.status).toBe(400);
    const listed = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": sessionId
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
      })
    );
    const listedBody = (await listed.json()) as {
      result?: {
        tools?: Array<{
          name: string;
          inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
        }>;
      };
    };
    expect(listedBody.result?.tools?.some((tool) => tool.name === "get_selection")).toBe(true);
    expect(listedBody.result?.tools?.some((tool) => tool.name === "avatar_set_state")).toBe(false);
    const canvasTool = listedBody.result?.tools?.find((tool) => tool.name === "get_canvas_state");
    expect(canvasTool?.inputSchema?.properties).toHaveProperty("id");
    expect(canvasTool?.inputSchema?.required).toContain("id");
    const designFrameTool = listedBody.result?.tools?.find((tool) => tool.name === "create_design_frame");
    expect(designFrameTool?.inputSchema?.required).toEqual(["id", "name", "html"]);
    const stream = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          accept: "text/event-stream",
          "mcp-session-id": sessionId
        }
      })
    );
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    expect(await stream.text()).toContain("event: message");
    const library = path.join(tmpdir(), `studio-mcp-projects-library-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const projectApp = createStudioApp(
      path.join(tmpdir(), "studio-mcp-projects"),
      "test-token",
      undefined,
      library,
      undefined,
      clients
    );
    const projectSession = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "initialize" })
      })
    );
    const projectList = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "list_projects", arguments: {} }
        })
      })
    );
    const projectBody = (await projectList.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(projectBody.result?.content?.[0]?.text).toBe("[]");
    const projectId = "11111111-1111-4111-8111-111111111111";
    await mkdir(path.join(library, "projects"), { recursive: true });
    await writeFile(
      path.join(library, "projects", `${projectId}.json`),
      JSON.stringify({
        formatVersion: 1,
        id: projectId,
        title: "Desk",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z",
        snapshot: JSON.stringify({
          document: {
            schema: { schemaVersion: 1 },
            store: {
              "document:document": { typeName: "document", meta: { studioStyle: "Ink" } },
              "instance_page_state:page": { typeName: "instance_page_state", selectedShapeIds: ["shape:frame"] },
              "shape:frame": { typeName: "shape", type: "frame", props: { name: "Artboard", w: 800, h: 600 } },
              "shape:design": { typeName: "shape", type: "design-frame", props: { html: "<h1>Hi</h1>" } }
            }
          }
        })
      })
    );
    const openedProject = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "open_project", arguments: { id: projectId } }
        })
      })
    );
    const openedBody = (await openedProject.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(openedBody.result?.content?.[0]?.text).toContain("Desk");
    const canvas = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "get_canvas_state", arguments: { id: projectId } }
        })
      })
    );
    const canvasBody = (await canvas.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(canvasBody.result?.content?.[0]?.text).toContain("Artboard");
    const styles = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "get_styles", arguments: { id: projectId } }
        })
      })
    );
    const stylesBody = (await styles.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(stylesBody.result?.content?.[0]?.text).toContain("Ink");
    const selection = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: { name: "get_selection", arguments: { id: projectId } }
        })
      })
    );
    const selectionBody = (await selection.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(selectionBody.result?.content?.[0]?.text).toContain("shape:frame");
    const code = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: { name: "get_frame_code", arguments: { id: projectId, frameId: "shape:design" } }
        })
      })
    );
    const codeBody = (await code.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(codeBody.result?.content?.[0]?.text).toContain("<h1>Hi</h1>");
    const exported = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: { name: "export_frame", arguments: { id: projectId, frameId: "shape:frame", format: "svg" } }
        })
      })
    );
    const exportBody = (await exported.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(exportBody.result?.content?.[0]?.text).toContain("Artboard");
    expect(exportBody.result?.content?.[0]?.text).toContain("<svg");
    clients.push({
      id: "client-apply",
      name: "Codex",
      token: "token-apply",
      permission: "apply",
      revoked: false,
      lastSeen: null
    });
    const renamed = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 11,
          method: "tools/call",
          params: {
            name: "update_shapes",
            arguments: { id: projectId, updates: [{ id: "shape:frame", name: "Renamed" }] }
          }
        })
      })
    );
    const renamedBody = (await renamed.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(renamedBody.result?.content?.[0]?.text).toContain("Renamed");
    const deleted = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: { name: "delete_shapes", arguments: { id: projectId, shapeIds: ["shape:design"] } }
        })
      })
    );
    const deletedBody = (await deleted.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(deletedBody.result?.content?.[0]?.text).toContain("shape:design");
    const created = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 13,
          method: "tools/call",
          params: {
            name: "create_shapes",
            arguments: { id: projectId, shapes: [{ id: "shape:added", name: "Added", w: 20, h: 10 }] }
          }
        })
      })
    );
    const createdBody = (await created.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(createdBody.result?.content?.[0]?.text).toContain("shape:added");
    const inserted = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 14,
          method: "tools/call",
          params: {
            name: "insert_svg",
            arguments: {
              id: projectId,
              svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect /></svg>'
            }
          }
        })
      })
    );
    const insertedBody = (await inserted.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(insertedBody.result?.content?.[0]?.text).toContain('"script":false');
    const designed = await projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 15,
          method: "tools/call",
          params: {
            name: "create_design_frame",
            arguments: { id: projectId, name: "Landing", html: "<h1>Landing</h1><script>alert(1)</script>" }
          }
        })
      })
    );
    const designedBody = (await designed.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(designedBody.result?.content?.[0]?.text).toContain('"script":false');
    const live = await projectApp.fetch(
      new Request("http://127.0.0.1/api/mcp-live-edit?studioToken=test-token", {
        headers: { origin: "http://127.0.0.1" }
      })
    );
    const liveBody = (await live.json()) as { edit?: { name?: string; arguments?: string } | null };
    expect(liveBody.edit?.name).toBe("create_design_frame");
    expect(liveBody.edit?.arguments).toContain("Landing");
    expect(liveBody.edit?.arguments).not.toContain('"id"');
    const shotPromise = projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 16,
          method: "tools/call",
          params: { name: "screenshot_frame", arguments: { id: projectId, frameId: "shape:frame" } }
        })
      })
    );
    let queued: { id?: string; frameId?: string } | null = null;
    for (let attempt = 0; attempt < 20 && !queued?.id; attempt += 1) {
      const status = await projectApp.fetch(
        new Request("http://127.0.0.1/api/mcp-screenshot?studioToken=test-token", {
          headers: { origin: "http://127.0.0.1" }
        })
      );
      queued = ((await status.json()) as { request?: { id?: string; frameId?: string } | null }).request ?? null;
      if (!queued?.id) await new Promise((resolve) => setTimeout(resolve, 15));
    }
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const posted = await projectApp.fetch(
      new Request("http://127.0.0.1/api/mcp-screenshot?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ requestId: queued?.id, pngDataUrl })
      })
    );
    expect(posted.status).toBe(200);
    const shot = await shotPromise;
    const shotBody = (await shot.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(shotBody.result?.content?.[0]?.text).toContain("canvas-raster");
    expect(shotBody.result?.content?.[0]?.text).toContain(pngDataUrl);
    expect(shotBody.result?.content?.[0]?.text).not.toContain("bounds-preview");
    const pngExportPromise = projectApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-live",
          "content-type": "application/json",
          "mcp-session-id": projectSession.headers.get("mcp-session-id") ?? ""
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 17,
          method: "tools/call",
          params: { name: "export_frame", arguments: { id: projectId, frameId: "shape:frame", format: "png" } }
        })
      })
    );
    let exportRequest: { id?: string } | null = null;
    for (let attempt = 0; attempt < 20 && !exportRequest?.id; attempt += 1) {
      const status = await projectApp.fetch(
        new Request("http://127.0.0.1/api/mcp-screenshot?studioToken=test-token", {
          headers: { origin: "http://127.0.0.1" }
        })
      );
      exportRequest = ((await status.json()) as { request?: { id?: string } | null }).request ?? null;
      if (!exportRequest?.id) await new Promise((resolve) => setTimeout(resolve, 15));
    }
    await projectApp.fetch(
      new Request("http://127.0.0.1/api/mcp-screenshot?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ requestId: exportRequest?.id, pngDataUrl })
      })
    );
    const pngExport = await pngExportPromise;
    const pngExportBody = (await pngExport.json()) as { result?: { content?: Array<{ text: string }> } };
    expect(pngExportBody.result?.content?.[0]?.text).toContain('"format":"png"');
    expect(pngExportBody.result?.content?.[0]?.text).toContain(pngDataUrl);
    const invalid = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", authorization: "Bearer token-live", "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );
    expect(invalid.status).toBe(403);
    const applyApp = createStudioApp(
      path.join(tmpdir(), "studio-mcp-schema"),
      "test-token",
      undefined,
      undefined,
      undefined,
      [
        {
          id: "client-apply",
          name: "Codex Apply",
          permission: "apply",
          token: "token-apply",
          revoked: false,
          lastSeen: null
        }
      ]
    );
    const schema = await applyApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      })
    );
    expect(schema.status).toBe(400);
    expect(((await schema.json()) as { error: string }).error).toContain("shapes");
    const first = await applyApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json"
        },
        body: JSON.stringify({ shapes: [{ type: "rectangle" }], baseRevision: 0 })
      })
    );
    expect(first.status).toBe(200);
    const stale = await applyApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=update_shapes", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-apply",
          "content-type": "application/json"
        },
        body: JSON.stringify({ updates: [], baseRevision: 0 })
      })
    );
    expect(stale.status).toBe(409);
    const proposeApp = createStudioApp(
      path.join(tmpdir(), "studio-mcp-propose"),
      "test-token",
      undefined,
      undefined,
      undefined,
      [
        {
          id: "client-propose",
          permission: "propose",
          token: "token-propose",
          name: "Claude Code",
          revoked: false,
          lastSeen: null
        }
      ]
    );
    const proposal = await proposeApp.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=create_shapes", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1",
          authorization: "Bearer token-propose",
          "content-type": "application/json"
        },
        body: JSON.stringify({ shapes: [{ type: "rectangle" }], baseRevision: 0 })
      })
    );
    expect(proposal.status).toBe(202);
    expect(await proposal.json()).toMatchObject({ proposal: true, badge: "Claude Code", undo: false });
    const staged = await proposeApp.fetch(
      new Request("http://127.0.0.1/api/mcp-proposal?studioToken=test-token", {
        headers: { origin: "http://127.0.0.1" }
      })
    );
    expect(await staged.json()).toMatchObject({ proposal: { badge: "Claude Code", name: "create_shapes" } });
  });

  it("issues, renames, and revokes an MCP client without listing the token", async () => {
    const clients: Array<{
      id: string;
      name: string;
      token: string;
      permission: "read" | "propose" | "apply";
      revoked: boolean;
      lastSeen: string | null;
    }> = [];
    const app = createStudioApp(
      path.join(tmpdir(), "studio-mcp-clients"),
      "test-token",
      undefined,
      undefined,
      undefined,
      clients
    );
    const created = await app.fetch(
      new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ name: "Cursor", permission: "read" })
      })
    );
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { token: string; client: { id: string } };
    expect(createdBody.token).toMatch(/^[a-f0-9]{64}$/);
    const listed = await app.fetch(
      new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
        headers: { origin: "http://127.0.0.1" }
      })
    );
    const listedText = await listed.text();
    expect(listedText).not.toContain(createdBody.token);
    await app.fetch(
      new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ action: "rename", id: createdBody.client.id, name: "Cursor laptop" })
      })
    );
    const seen = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=get_selection", {
        headers: { origin: "http://127.0.0.1", authorization: `Bearer ${createdBody.token}` }
      })
    );
    expect(seen.status).toBe(200);
    const permission = await app.fetch(
      new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ action: "permission", id: createdBody.client.id, permission: "apply" })
      })
    );
    expect(await permission.json()).toMatchObject({ client: { permission: "apply" } });
    await app.fetch(
      new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", id: createdBody.client.id })
      })
    );
    const after = await app.fetch(
      new Request("http://127.0.0.1/mcp?studioToken=test-token&tool=get_selection", {
        headers: { origin: "http://127.0.0.1", authorization: `Bearer ${createdBody.token}` }
      })
    );
    expect(after.status).toBe(401);
    const finalList = (await (
      await app.fetch(
        new Request("http://127.0.0.1/api/mcp-clients?studioToken=test-token", {
          headers: { origin: "http://127.0.0.1" }
        })
      )
    ).json()) as { clients: Array<{ name: string; revoked: boolean; lastSeen: string | null }> };
    expect(finalList.clients[0]).toMatchObject({ name: "Cursor laptop", revoked: true });
    expect(finalList.clients[0]?.lastSeen).toEqual(expect.any(String));
  });

  it("serves the OpenRouter catalog over an authenticated standalone socket without returning the key", async () => {
    const root = path.join(tmpdir(), `studio-socket-${Date.now()}`);
    const library = path.join(tmpdir(), `studio-socket-library-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await mkdir(library, { recursive: true });
    let stored: string | null = null;
    const keyring = {
      async get() {
        return stored;
      },
      async set(value: string) {
        stored = value;
      }
    };
    const providerUrls: string[] = [];
    const providerRequest: typeof fetch = async (input, init) => {
      const url = String(input);
      providerUrls.push(url);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-or-test-secret");
      if (url.endsWith("/key")) {
        return new Response(JSON.stringify({ data: { label: "Studio test key", is_management_key: false } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.includes("/models/user?output_modalities=all")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "openai/gpt-4o-mini",
                name: "GPT 4o mini",
                architecture: { input_modalities: ["text"], output_modalities: ["text"] },
                context_length: 128_000,
                pricing: { prompt: "0.15", completion: "0.6" },
                supported_parameters: ["tools"]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected provider request: ${url}`);
    };
    const server = await startStudioServer(0, root, "socket-test-token", keyring, library, providerRequest);
    const address = server.address();
    expect(typeof address === "object" && address).toBeTruthy();
    const port = typeof address === "object" && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const socketUrl = `ws://127.0.0.1:${port}/api/studio`;
    let socket: TestWebSocket | undefined;
    try {
      const page = await fetch(`${origin}/?studioToken=socket-test-token`);
      const cookie = page.headers.get("set-cookie")?.split(";")[0] ?? "";
      const unauthorized = await websocketResponseStatus(socketUrl, {
        headers: { origin: "http://attacker.example", cookie },
        urlSuffix: "?studioToken=socket-test-token"
      });
      expect(unauthorized).toBe(403);

      socket = new TestWebSocket(`${socketUrl}?studioToken=socket-test-token`, { headers: { origin, cookie } });
      socket.on("error", () => undefined);
      const initialStatePromise = waitForSocketMessage(socket, (message) => message.type === "studio:hostState");
      await waitForSocketOpen(socket);
      socket.send(JSON.stringify(createStudioToHostMessage({ type: "studio:ready" })));
      const initialState = await initialStatePromise;
      expect(initialState).toMatchObject({
        type: "studio:hostState",
        host: "standalone",
        workspaceTrusted: true,
        connection: { status: "disconnected" }
      });

      const saved = await fetch(`${origin}/api/openrouter-key?studioToken=socket-test-token`, {
        method: "POST",
        headers: { origin, cookie, "content-type": "application/json" },
        body: JSON.stringify({ key: "sk-or-test-secret" })
      });
      const savedBody = await saved.text();
      expect(saved.status).toBe(200);
      expect(savedBody).not.toContain("sk-or-test-secret");

      const connectedPromise = waitForSocketMessage(
        socket,
        (message) =>
          message.type === "studio:hostState" && (message.connection as { status?: unknown }).status === "connected"
      );
      socket.send(JSON.stringify(createStudioToHostMessage({ type: "studio:openRouterConnection", action: "test" })));
      const connected = await connectedPromise;
      expect(JSON.stringify(connected)).not.toContain("sk-or-test-secret");
      expect(providerUrls).toContain("https://openrouter.ai/api/v1/key");

      const catalogPromise = waitForSocketMessage(
        socket,
        (message) => message.type === "studio:modelCatalog" && message.status === "ready"
      );
      socket.send(JSON.stringify(createStudioToHostMessage({ type: "studio:modelCatalogRequest" })));
      const catalog = await catalogPromise;
      expect(catalog).toMatchObject({
        type: "studio:modelCatalog",
        status: "ready",
        models: [{ id: "openai/gpt-4o-mini", textChatEligible: true }]
      });
      expect(providerUrls).toContain("https://openrouter.ai/api/v1/models/user?output_modalities=all");
      expect(JSON.stringify(catalog)).not.toContain("sk-or-test-secret");
    } finally {
      if (socket && socket.readyState !== TestWebSocket.CLOSED) {
        const closed = new Promise<void>((resolve) => socket?.once("close", () => resolve()));
        socket.close();
        await closed;
      }
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("saves a project through the host and keeps the last good file", async () => {
    const library = path.join(tmpdir(), `studio-library-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const app = createStudioApp(path.join(library, "missing-build"), "test-token", undefined, library);
    const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });
    const headers = { origin: "http://127.0.0.1", "content-type": "application/json" };
    const save = await app.fetch(
      new Request(`http://127.0.0.1/api/projects?studioToken=test-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id, title: "Board", snapshot })
      })
    );
    expect(save.status).toBe(200);
    const opened = await app.fetch(new Request(`http://127.0.0.1/api/projects/${id}?studioToken=test-token`));
    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({ id, title: "Board", formatVersion: 1 });
    const failed = await app.fetch(
      new Request(`http://127.0.0.1/api/projects?studioToken=test-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id, title: "Broken", snapshot: "not-json" })
      })
    );
    expect(failed.status).toBe(400);
    const still = await app.fetch(new Request(`http://127.0.0.1/api/projects/${id}?studioToken=test-token`));
    expect(await still.json()).toMatchObject({ title: "Board" });
    const unconfirmed = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${id}/delete?studioToken=test-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm: false })
      })
    );
    expect(unconfirmed.status).toBe(400);
  });

  it("reopens an atomically saved project after the standalone server restarts", async () => {
    const root = path.join(tmpdir(), `studio-restart-${Date.now()}`);
    const library = path.join(tmpdir(), `studio-restart-library-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "index.html"), "<title>Kurva</title>");
    await mkdir(library, { recursive: true });
    const id = "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6";
    const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });
    let server = await startStudioServer(0, root, "first-launch-token", undefined, library);
    try {
      const firstAddress = server.address();
      const firstOrigin = `http://127.0.0.1:${typeof firstAddress === "object" && firstAddress ? firstAddress.port : 0}`;
      const firstPage = await fetch(`${firstOrigin}/?studioToken=first-launch-token`);
      const firstCookie = firstPage.headers.get("set-cookie")?.split(";")[0] ?? "";
      const saved = await fetch(`${firstOrigin}/api/projects`, {
        method: "POST",
        headers: { origin: firstOrigin, cookie: firstCookie, "content-type": "application/json" },
        body: JSON.stringify({ id, title: "Restart board", snapshot })
      });
      expect(saved.status).toBe(200);

      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      server = await startStudioServer(0, root, "second-launch-token", undefined, library);
      const secondAddress = server.address();
      const secondOrigin = `http://127.0.0.1:${typeof secondAddress === "object" && secondAddress ? secondAddress.port : 0}`;
      const secondPage = await fetch(`${secondOrigin}/?studioToken=second-launch-token`);
      const secondCookie = secondPage.headers.get("set-cookie")?.split(";")[0] ?? "";
      const reopened = await fetch(`${secondOrigin}/api/projects/${id}`, { headers: { cookie: secondCookie } });
      expect(reopened.status).toBe(200);
      expect(await reopened.json()).toMatchObject({ id, title: "Restart board", formatVersion: 1, snapshot });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("stores a PNG thumbnail and serves it back", async () => {
    const library = path.join(tmpdir(), `studio-thumb-host-${Date.now()}`);
    await mkdir(path.join(library, "projects"), { recursive: true });
    const app = createStudioApp(path.join(library, "missing-build"), "test-token", undefined, library);
    const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const headers = { origin: "http://127.0.0.1", "content-type": "image/png" };
    const orphan = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${id}/thumbnail?studioToken=test-token`, {
        method: "POST",
        headers,
        body: png
      })
    );
    expect(orphan.status).toBe(404);
    const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });
    const project = await app.fetch(
      new Request(`http://127.0.0.1/api/projects?studioToken=test-token`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ id, title: "Thumbnail board", snapshot })
      })
    );
    expect(project.status).toBe(200);
    const missing = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${id}/thumbnail?studioToken=test-token`)
    );
    expect(missing.status).toBe(404);
    const saved = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${id}/thumbnail?studioToken=test-token`, {
        method: "POST",
        headers,
        body: png
      })
    );
    expect(saved.status).toBe(200);
    const read = await app.fetch(new Request(`http://127.0.0.1/api/projects/${id}/thumbnail?studioToken=test-token`));
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toContain("image/png");
    const deleted = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${id}/delete?studioToken=test-token`, {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ confirm: true })
      })
    );
    expect(deleted.status).toBe(200);
    const gone = await app.fetch(new Request(`http://127.0.0.1/api/projects/${id}/thumbnail?studioToken=test-token`));
    expect(gone.status).toBe(404);
  });

  it("stores a sanitized SVG asset", async () => {
    const library = path.join(tmpdir(), `studio-asset-host-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const app = createStudioApp(path.join(library, "missing-build"), "test-token", undefined, library);
    const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const saved = await app.fetch(
      new Request(`http://127.0.0.1/assets/${id}?studioToken=test-token`, {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "image/svg+xml" },
        body: "<svg><script>alert(1)</script><rect /></svg>"
      })
    );
    expect(saved.status).toBe(200);
    const read = await app.fetch(new Request(`http://127.0.0.1/assets/${id}?studioToken=test-token`));
    const text = await read.text();
    expect(text).not.toContain("script");
    expect(text).toContain("<svg");
  });

  it("stores a conversation with its model and without a key", async () => {
    const library = path.join(tmpdir(), `studio-conversation-host-${Date.now()}`);
    await mkdir(library, { recursive: true });
    const app = createStudioApp(path.join(library, "missing-build"), "test-token", undefined, library);
    const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const id = "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6";
    const headers = { origin: "http://127.0.0.1", "content-type": "application/json" };
    const saved = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${projectId}/conversations?studioToken=test-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id,
          projectId,
          title: "Landing",
          modelId: "openrouter/auto",
          updatedAt: "2026-09-24T07:00:00.000Z",
          messages: [{ role: "user", content: "Frame a page" }]
        })
      })
    );
    expect(saved.status).toBe(200);
    const listed = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${projectId}/conversations?studioToken=test-token`)
    );
    expect(await listed.json()).toEqual([
      { id, title: "Landing", modelId: "openrouter/auto", updatedAt: "2026-09-24T07:00:00.000Z" }
    ]);
    const read = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${projectId}/conversations/${id}?studioToken=test-token`)
    );
    const body = await read.json();
    expect(body).toMatchObject({ modelId: "openrouter/auto" });
    expect(JSON.stringify(body)).not.toContain("sk-or");
    const rejected = await app.fetch(
      new Request(`http://127.0.0.1/api/projects/${projectId}/conversations?studioToken=test-token`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id,
          projectId,
          title: "Landing",
          modelId: "openrouter/auto",
          updatedAt: "2026-09-24T07:00:00.000Z",
          messages: [{ role: "user", content: "Frame a page" }],
          key: "sk-or-secret"
        })
      })
    );
    expect(rejected.status).toBe(400);
  });

  it("saves an avatar package through the Phase 4 ZIP exporter", async () => {
    const app = createStudioApp(path.join(tmpdir(), "unused-studio-build"), "test-token");
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>Studio avatar</title><path fill="#d2461e" d="M2 2h28v28H2z"/></svg>';
    const response = await app.fetch(
      new Request("http://127.0.0.1/api/avatar-package?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ name: "Cholita 3D", svg })
      })
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status, new TextDecoder().decode(bytes)).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(response.headers.get("content-disposition")).toContain("cholita-3d-1.0.0.codex-avatar.zip");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const entries = readStoredZipEntries(Buffer.from(bytes));
    expect(entries.get("cholita-3d/svg/avatar.svg")?.toString("utf8")).toBe(svg);
    const manifest = JSON.parse(entries.get("cholita-3d/avatar.manifest.json")?.toString("utf8") ?? "{}");
    expect(manifest.checksums["svg/avatar.svg"]).toHaveLength(64);
  });

  it("sanitizes avatar SVG and rejects malformed or missing artwork", async () => {
    const app = createStudioApp(path.join(tmpdir(), "unused-studio-build"), "test-token");
    const request = (body: unknown) =>
      app.fetch(
        new Request("http://127.0.0.1/api/avatar-package?studioToken=test-token", {
          method: "POST",
          headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
          body: JSON.stringify(body)
        })
      );
    const missing = await request({ name: "Avatar" });
    expect(missing.status).toBe(400);
    const invalid = await request({ name: "Avatar", svg: "<svg><path></svg>" });
    expect(invalid.status).toBe(400);

    const unsafeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><script>alert(1)</script><path onload="alert(1)" fill="#d2461e" d="M2 2h28v28H2z"/></svg>';
    const response = await request({ name: "Safe Avatar", svg: unsafeSvg });
    const entries = readStoredZipEntries(Buffer.from(await response.arrayBuffer()));
    const exportedSvg = entries.get("safe-avatar/svg/avatar.svg")?.toString("utf8") ?? "";
    expect(response.status).toBe(200);
    expect(exportedSvg).toContain('fill="#d2461e"');
    expect(exportedSvg).not.toContain("script");
    expect(exportedSvg).not.toContain("onload");
  });

  it("rejects a non-loopback Host header", async () => {
    const app = createStudioApp(path.join(tmpdir(), "unused-studio-build"));
    const response = await app.fetch(new Request("http://evil.test/"));
    expect(response.status).toBe(421);
  });
});

function waitForSocketOpen(socket: TestWebSocket): Promise<void> {
  if (socket.readyState === TestWebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
}

function waitForSocketMessage(
  socket: TestWebSocket,
  predicate: (message: { type: string; [key: string]: unknown }) => boolean
): Promise<{ type: string; [key: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for a standalone Studio socket message."));
    }, 5_000);
    const onMessage = (data: Buffer) => {
      let message: { type: string; [key: string]: unknown };
      try {
        message = JSON.parse(data.toString()) as { type: string; [key: string]: unknown };
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.off("message", onMessage);
      reject(error);
    });
  });
}

function websocketResponseStatus(
  url: string,
  options: { headers: Record<string, string>; urlSuffix?: string }
): Promise<number> {
  const socket = new TestWebSocket(`${url}${options.urlSuffix ?? ""}`, { headers: options.headers });
  socket.on("error", () => undefined);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for the rejected Studio socket."));
    }, 5_000);
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    socket.once("open", () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error("The Studio host accepted a cross-origin socket."));
    });
  });
}

function exportReport(mode: "glb" | "png", input: string, output: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    mode,
    sourceFile: path.basename(input),
    outputFile: path.basename(output),
    collection: "Export",
    objectCount: 1,
    guidance: "Preview only."
  });
}

function png8(): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  const raw = Buffer.alloc(8 * 9);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) raw[y * 9 + 1 + x] = x < 4 ? 0 : 255;
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

function minimalGlb(): Buffer {
  const json = Buffer.from(`${JSON.stringify({ asset: { version: "2.0" } })}   `);
  const total = 20 + json.length;
  const buffer = Buffer.alloc(total);
  buffer.write("glTF", 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(total, 8);
  buffer.writeUInt32LE(json.length, 12);
  buffer.write("JSON", 16);
  json.copy(buffer, 20);
  return buffer;
}

function readStoredZipEntries(archive: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 4 <= archive.byteLength && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    if (method !== 0) throw new Error("Expected stored ZIP entries in Studio avatar package.");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, archive.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

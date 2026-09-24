import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

  it("does not expose a browser endpoint that accepts provider keys", async () => {
    const root = path.join(tmpdir(), `studio-no-key-route-${Date.now()}`);
    const app = createStudioApp(root, "test-token");
    const response = await app.fetch(
      new Request("http://127.0.0.1/api/openrouter-key?studioToken=test-token", {
        method: "POST",
        headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
        body: JSON.stringify({ key: "sk-or-test-secret" })
      })
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("sk-or-test-secret");
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
    await mkdir(library, { recursive: true });
    const app = createStudioApp(path.join(library, "missing-build"), "test-token", undefined, library);
    const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const headers = { origin: "http://127.0.0.1", "content-type": "image/png" };
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

  it("rejects a non-loopback Host header", async () => {
    const app = createStudioApp(path.join(tmpdir(), "unused-studio-build"));
    const response = await app.fetch(new Request("http://evil.test/"));
    expect(response.status).toBe(421);
  });
});

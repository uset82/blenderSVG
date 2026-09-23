import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  trusted: true,
  readyDuringHtmlLoad: false,
  selectedFiles: undefined as Array<{ scheme: string; fsPath: string }> | undefined,
  revealedPaths: [] as string[],
  handlers: [] as Array<(message: unknown) => void>,
  messages: [] as unknown[]
}));
vi.mock("vscode", () => ({
  Uri: {
    file: (fsPath: string) => ({ scheme: "file", fsPath }),
    joinPath: (base: { fsPath: string }, ...parts: string[]) => ({ fsPath: path.join(base.fsPath, ...parts) })
  },
  commands: {
    executeCommand: vi.fn(async (command: string, uri: { fsPath: string }) => {
      if (command === "revealFileInOS") state.revealedPaths.push(uri.fsPath);
    })
  },
  ViewColumn: { Active: 1 },
  workspace: {
    get isTrusted() {
      return state.trusted;
    }
  },
  window: {
    showInputBox: vi.fn(),
    showOpenDialog: vi.fn(async () => state.selectedFiles),
    showErrorMessage: vi.fn(),
    createWebviewPanel: vi.fn(() => ({
      webview: {
        set html(_value: string) {
          if (state.readyDuringHtmlLoad) state.handlers[0]?.({ protocolVersion: 1, type: "studio:ready" });
        },
        cspSource: "vscode-webview://studio",
        asWebviewUri: (uri: { fsPath: string }) => ({
          toString: () => `vscode-webview://studio/${path.basename(uri.fsPath)}`
        }),
        postMessage: async (message: unknown) => {
          state.messages.push(message);
        },
        onDidReceiveMessage: (handler: (message: unknown) => void) => {
          state.handlers.push(handler);
        }
      },
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
      dispose: vi.fn()
    }))
  }
}));

import { buildStudioHtml, StudioWebviewPanel } from "../src/StudioWebviewPanel.js";

const directories: string[] = [];
afterEach(() => {
  state.trusted = true;
  state.readyDuringHtmlLoad = false;
  state.selectedFiles = undefined;
  state.revealedPaths.length = 0;
  state.handlers.length = 0;
  state.messages.length = 0;
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function studioFixture(
  html = '<link rel="stylesheet" href="./assets/index-abc.css"><script type="module" src="./assets/index-abc.js"></script>'
) {
  const extensionRoot = mkdtempSync(path.join(os.tmpdir(), "studio-webview-test-"));
  directories.push(extensionRoot);
  const studioRoot = path.join(extensionRoot, "media", "studio");
  mkdirSync(studioRoot, { recursive: true });
  writeFileSync(path.join(studioRoot, "index.html"), html);
  return { fsPath: extensionRoot };
}

const fakeWebview = {
  cspSource: "vscode-webview://studio",
  asWebviewUri: (uri: { fsPath: string }) => ({
    toString: () => `vscode-webview://studio/${path.basename(uri.fsPath)}`
  })
};

describe("Studio editor panel", () => {
  it("builds a local-only CSP document and rejects remote or escaping entrypoints", () => {
    const root = studioFixture();
    const html = buildStudioHtml(fakeWebview as never, { fsPath: path.join(root.fsPath, "media", "studio") } as never);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src vscode-webview://studio");
    expect(html).toContain("img-src vscode-webview://studio data: blob:");
    expect(html).not.toContain("https://");
    expect(html).toContain("vscode-webview://studio/index-abc.js");

    const remote = studioFixture(
      '<link rel="stylesheet" href="https://example.com/a.css"><script type="module" src="./assets/a.js"></script>'
    );
    expect(() =>
      buildStudioHtml(fakeWebview as never, { fsPath: path.join(remote.fsPath, "media", "studio") } as never)
    ).toThrow();
    const escaping = studioFixture(
      '<link rel="stylesheet" href="./assets/a.css"><script type="module" src="./assets/../../evil.js"></script>'
    );
    expect(() =>
      buildStudioHtml(fakeWebview as never, { fsPath: path.join(escaping.fsPath, "media", "studio") } as never)
    ).toThrow();
  });

  it("accepts ready and rejects invalid or untrusted connection actions", async () => {
    const root = studioFixture();
    const secrets = {
      get: vi.fn(async () => undefined),
      store: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined)
    };
    const panel = new StudioWebviewPanel(root as never, secrets as never);
    panel.open();
    expect(state.handlers).toHaveLength(1);

    state.handlers[0]?.({ protocolVersion: 1, type: "studio:ready" });
    await vi.waitFor(() => expect(state.messages).toHaveLength(1));
    expect(state.messages[0]).toMatchObject({ type: "studio:hostState", host: "vscode", workspaceTrusted: true });

    state.handlers[0]?.({ protocolVersion: 1, type: "studio:openRouterConnection", action: "connect", apiKey: "leak" });
    await Promise.resolve();
    expect(state.messages).toHaveLength(1);

    state.trusted = false;
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:openRouterConnection", action: "test" });
    await vi.waitFor(() => expect(state.messages).toHaveLength(2));
    expect(state.messages[1]).toMatchObject({ workspaceTrusted: false, connection: { status: "error" } });
    expect(secrets.get).toHaveBeenCalledTimes(1);
  });

  it("handles ready arriving while the Webview HTML is assigned", async () => {
    const root = studioFixture();
    const secrets = {
      get: vi.fn(async () => undefined),
      store: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined)
    };
    state.readyDuringHtmlLoad = true;
    new StudioWebviewPanel(root as never, secrets as never).open();
    await vi.waitFor(() => expect(state.messages).toHaveLength(1));
    expect(state.messages[0]).toMatchObject({ type: "studio:hostState" });
  });

  it("traces bounded local image bytes through VTracer and returns an SVG", async () => {
    const root = studioFixture();
    const panel = new StudioWebviewPanel(root as never, { get: vi.fn(async () => undefined) } as never);
    panel.open();
    expect(state.handlers).toHaveLength(1);
    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:traceImage",
      requestId: "trace-1234",
      mediaType: "image/png",
      dataBase64: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg=="
    });
    await vi.waitFor(
      () => expect(state.messages.some((message) => (message as { type?: string }).type === "studio:imageTraced")).toBe(true),
      { timeout: 10_000 }
    );
    const response = state.messages.find(
      (message) => (message as { type?: string }).type === "studio:imageTraced"
    ) as { svg: string };
    expect(response.svg).toMatch(/^<svg\b/);
    expect(response.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("imports a selected local project under a new ID and reports cancellation", async () => {
    const root = studioFixture();
    const selectedPath = path.join(root.fsPath, "selected.json");
    writeFileSync(
      selectedPath,
      JSON.stringify({
        id: "44a4252c-5bc5-41e6-b7b7-68a79736c7d5",
        title: "Imported canvas",
        createdAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-01-03T03:04:05.000Z",
        formatVersion: 1,
        snapshot: JSON.stringify({ document: { schema: {}, store: {} } })
      })
    );
    const secrets = { get: vi.fn(async () => undefined), store: vi.fn(), delete: vi.fn() };
    const panel = new StudioWebviewPanel(root as never, secrets as never, () => root.fsPath);
    panel.open();
    state.selectedFiles = [{ scheme: "file", fsPath: selectedPath }];
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectImportRequest", requestId: "import-1234" });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(expect.objectContaining({ type: "studio:projectImported" }))
    );
    const result = state.messages.find(
      (message) => (message as { type?: string }).type === "studio:projectImported"
    ) as {
      requestId: string;
      project: { id: string; title: string };
    };
    expect(result.requestId).toBe("import-1234");
    expect(result.project.id).not.toBe("44a4252c-5bc5-41e6-b7b7-68a79736c7d5");
    expect(result.project.title).toBe("Imported canvas");

    state.selectedFiles = undefined;
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectImportRequest", requestId: "import-5678" });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({
          type: "studio:projectError",
          requestId: "import-5678",
          code: "cancelled"
        })
      )
    );

    state.selectedFiles = [{ scheme: "https", fsPath: selectedPath }];
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectImportRequest", requestId: "import-9012" });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectError", requestId: "import-9012", code: "corrupt" })
      )
    );

    state.trusted = false;
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectImportRequest", requestId: "import-3456" });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectError", requestId: "import-3456", code: "workspace" })
      )
    );
  });

  it("provisions Scratchpad once through the typed bridge without replacing edits", async () => {
    const root = studioFixture();
    const secrets = { get: vi.fn(async () => undefined), store: vi.fn(), delete: vi.fn() };
    const panel = new StudioWebviewPanel(root as never, secrets as never, () => root.fsPath);
    panel.open();
    const scratchpadId = "00000000-0000-4000-8000-000000000001";
    const blankSnapshot = JSON.stringify({ document: { schema: {}, store: {} } });
    const editedSnapshot = JSON.stringify({ document: { schema: { version: 1 }, store: {} } });

    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:ensureScratchpad",
      requestId: "scratch-1234",
      snapshot: blankSnapshot
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:scratchpadEnsured", requestId: "scratch-1234" })
      )
    );
    expect(state.messages.at(-1)).toMatchObject({ project: { id: scratchpadId, snapshot: blankSnapshot } });

    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:projectSave",
      requestId: "save-1234",
      projectId: scratchpadId,
      title: "Scratchpad",
      snapshot: editedSnapshot
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectSaved", requestId: "save-1234" })
      )
    );
    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:ensureScratchpad",
      requestId: "scratch-5678",
      snapshot: blankSnapshot
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:scratchpadEnsured", requestId: "scratch-5678" })
      )
    );
    expect(state.messages.at(-1)).toMatchObject({ project: { id: scratchpadId, snapshot: editedSnapshot } });
  });

  it("renames a stored project and reveals only its verified local path", async () => {
    const root = studioFixture();
    const secrets = { get: vi.fn(async () => undefined), store: vi.fn(), delete: vi.fn() };
    new StudioWebviewPanel(root as never, secrets as never, () => root.fsPath).open();
    const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });

    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:projectSave",
      requestId: "save-1234",
      projectId,
      title: "Original",
      snapshot
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectSaved", requestId: "save-1234" })
      )
    );

    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:projectRename",
      requestId: "rename-1234",
      projectId,
      title: "New title"
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({
          type: "studio:projectRenamed",
          requestId: "rename-1234",
          project: expect.objectContaining({ id: projectId, title: "New title" })
        })
      )
    );

    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectReveal", requestId: "reveal-1234", projectId });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectRevealed", requestId: "reveal-1234", projectId })
      )
    );
    expect(state.revealedPaths).toEqual([
      path.join(root.fsPath, ".codex-avatar", "studio", "projects", `${projectId}.json`)
    ]);

    state.handlers[0]?.({
      protocolVersion: 1,
      type: "studio:projectRename",
      requestId: "rename-5678",
      projectId,
      title: " "
    });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectError", requestId: "rename-5678", code: "invalid-title" })
      )
    );

    state.trusted = false;
    state.handlers[0]?.({ protocolVersion: 1, type: "studio:projectReveal", requestId: "reveal-5678", projectId });
    await vi.waitFor(() =>
      expect(state.messages).toContainEqual(
        expect.objectContaining({ type: "studio:projectError", requestId: "reveal-5678", code: "workspace" })
      )
    );
    expect(state.revealedPaths).toHaveLength(1);
  });
});

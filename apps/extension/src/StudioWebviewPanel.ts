import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createHostToStudioMessage,
  type HostToStudioMessageInput,
  parseStudioToHostMessage,
  type StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { traceImageBuffer } from "@codex-avatar-studio/asset-pipeline/trace-pixels";
import * as vscode from "vscode";
import { OpenRouterChatController } from "./openRouterChat.js";
import { OpenRouterConnectionController, type OpenRouterConnectionState } from "./openRouterConnection.js";
import { SCRATCHPAD_PROJECT_ID, StudioProjectStore, StudioProjectStoreError } from "./studioProjectStore.js";

type StudioProjectMessage = Extract<
  StudioToHostMessage,
  {
    type:
      | "studio:projectListRequest"
      | "studio:ensureScratchpad"
      | "studio:projectImportRequest"
      | "studio:projectOpen"
      | "studio:projectSave"
      | "studio:projectDuplicate"
      | "studio:projectRename"
      | "studio:projectReveal"
      | "studio:projectDelete";
  }
>;

export class StudioWebviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly connection: OpenRouterConnectionController;
  private readonly chat: OpenRouterChatController;
  private readonly projects: StudioProjectStore;
  private readonly projectWrites = new Map<string, Promise<unknown>>();
  private boundProjectWorkspace: string | undefined;
  private projectWorkspaceBound = false;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage,
    workspaceRoot: () => string | undefined
  ) {
    this.connection = new OpenRouterConnectionController(
      secrets,
      (options) => vscode.window.showInputBox(options),
      (state) => this.postHostState(state)
    );
    this.chat = new OpenRouterChatController(secrets, (message) => this.postMessage(message));
    this.projects = new StudioProjectStore(() => this.boundProjectWorkspace);
    this.workspaceRoot = workspaceRoot;
  }

  private readonly workspaceRoot: () => string | undefined;

  public open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const studioRoot = vscode.Uri.joinPath(this.extensionUri, "media", "studio");
    const panel = vscode.window.createWebviewPanel(
      "codexAvatar.studio",
      "blenderSVG Studio",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [studioRoot],
        retainContextWhenHidden: true
      }
    );

    this.panel = panel;
    panel.webview.onDidReceiveMessage((raw: unknown) => {
      const parsed = parseStudioToHostMessage(raw);
      if (!parsed.success) return;
      void this.handleMessage(parsed.data);
    });
    panel.onDidDispose(() => {
      if (this.panel === panel) this.panel = undefined;
      this.connection.dispose();
      this.chat.dispose();
    });

    try {
      panel.webview.html = buildStudioHtml(panel.webview, studioRoot);
    } catch {
      panel.dispose();
      vscode.window.showErrorMessage(
        "The Studio build is missing or invalid. Run the workspace build and reopen Studio."
      );
    }
  }

  public refreshWorkspaceTrust(): void {
    if (this.panel) void this.sendCurrentState();
  }

  public dispose(): void {
    this.connection.dispose();
    this.chat.dispose();
    this.panel?.dispose();
    this.panel = undefined;
  }

  private async handleMessage(message: StudioToHostMessage): Promise<void> {
    if (message.type === "studio:ready") {
      await this.sendCurrentState();
      return;
    }

    if (message.type === "studio:traceImage") {
      try {
        const svg = traceImageBuffer(Buffer.from(message.dataBase64, "base64"));
        this.postMessage({ type: "studio:imageTraced", requestId: message.requestId, svg });
      } catch {
        this.postMessage({
          type: "studio:traceError",
          requestId: message.requestId,
          message: "Studio could not trace this image locally. Choose a smaller PNG and try again."
        });
      }
      return;
    }

    if (isStudioProjectMessage(message)) {
      await this.handleProjectMessage(message);
      return;
    }

    if (!vscode.workspace.isTrusted) {
      if (message.type === "studio:chatRequest") {
        this.postMessage({
          type: "studio:chatError",
          requestId: message.requestId,
          code: "not-connected",
          message: "Trust this workspace before using OpenRouter."
        });
      } else if (message.type === "studio:modelCatalogRequest") {
        this.postMessage({
          type: "studio:modelCatalog",
          status: "error",
          message: "Trust this workspace before loading the OpenRouter model catalog.",
          models: []
        });
      } else {
        this.postHostState({ status: "error", message: "Trust this workspace before connecting OpenRouter." });
      }
      return;
    }

    if (message.type === "studio:modelCatalogRequest") {
      this.postMessage(await this.chat.refreshModels());
      return;
    }

    if (message.type === "studio:chatRequest") {
      void this.chat.send(message);
      return;
    }

    if (message.type === "studio:chatCancel") {
      this.chat.cancel(message.requestId);
      return;
    }

    if (message.type !== "studio:openRouterConnection") return;
    if (message.action === "disconnect" || message.action === "replace") this.chat.cancelAll();
    const state = await this.connection.run(message.action);
    this.postHostState(state);
  }

  private async handleProjectMessage(message: StudioProjectMessage): Promise<void> {
    if (message.type === "studio:projectListRequest") {
      if (!vscode.workspace.isTrusted) {
        this.postMessage({
          type: "studio:projectList",
          status: "error",
          message: "Trust a local workspace to open or save Studio projects.",
          projects: [],
          corruptCount: 0
        });
        return;
      }
      try {
        this.ensureProjectWorkspace();
        const result = await this.projects.list();
        this.postMessage({
          type: "studio:projectList",
          status: "ready",
          message: result.corruptCount
            ? `${result.corruptCount} damaged project file${result.corruptCount === 1 ? " was" : "s were"} left in place for recovery.`
            : "Projects are stored in .codex-avatar/studio/projects.",
          projects: result.projects,
          corruptCount: result.corruptCount
        });
      } catch (error) {
        this.postMessage({
          type: "studio:projectList",
          status: "error",
          message: projectErrorMessage(error),
          projects: [],
          corruptCount: 0
        });
      }
      return;
    }

    if (!vscode.workspace.isTrusted) {
      this.postMessage({
        type: "studio:projectError",
        requestId: message.requestId,
        code: "workspace",
        message: "Trust a local workspace before changing Studio projects."
      });
      return;
    }

    try {
      this.ensureProjectWorkspace();
      if (message.type === "studio:ensureScratchpad") {
        const project = await this.queueProjectWrite(SCRATCHPAD_PROJECT_ID, async () => {
          await this.projects.ensureScratchpad(message.snapshot);
          return this.projects.open(SCRATCHPAD_PROJECT_ID);
        });
        this.postMessage({ type: "studio:scratchpadEnsured", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectImportRequest") {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { "Studio projects": ["json"] },
          openLabel: "Import project",
          title: "Import Studio project"
        });
        const source = selected?.[0];
        if (!source) {
          this.postMessage({
            type: "studio:projectError",
            requestId: message.requestId,
            code: "cancelled",
            message: "Project import was cancelled."
          });
          return;
        }
        if (source.scheme !== "file") {
          throw new StudioProjectStoreError("corrupt", "Choose a local Studio project JSON file.");
        }
        if (!vscode.workspace.isTrusted) {
          throw new StudioProjectStoreError("workspace", "Trust a local workspace before importing Studio projects.");
        }
        this.ensureProjectWorkspace();
        const project = await this.projects.importFromFile(source.fsPath);
        this.postMessage({ type: "studio:projectImported", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectOpen") {
        await this.waitForProjectWrites(message.projectId);
        const project = await this.projects.open(message.projectId);
        this.postMessage({ type: "studio:projectOpened", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectSave") {
        const project = await this.queueProjectWrite(message.projectId, () =>
          this.projects.save(message.projectId, message.title, message.snapshot)
        );
        this.postMessage({ type: "studio:projectSaved", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectDuplicate") {
        await this.waitForProjectWrites(message.projectId);
        const project = await this.projects.duplicate(message.projectId);
        this.postMessage({ type: "studio:projectSaved", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectRename") {
        const project = await this.queueProjectWrite(message.projectId, () => {
          this.ensureProjectWorkspace();
          if (!vscode.workspace.isTrusted) {
            throw new StudioProjectStoreError("workspace", "Trust a local workspace before renaming Studio projects.");
          }
          return this.projects.rename(message.projectId, message.title);
        });
        this.postMessage({ type: "studio:projectRenamed", requestId: message.requestId, project });
        return;
      }
      if (message.type === "studio:projectReveal") {
        await this.waitForProjectWrites(message.projectId);
        this.ensureProjectWorkspace();
        if (!vscode.workspace.isTrusted) {
          throw new StudioProjectStoreError("workspace", "Trust a local workspace before revealing Studio projects.");
        }
        const projectPath = await this.projects.revealPath(message.projectId);
        await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(projectPath));
        this.postMessage({ type: "studio:projectRevealed", requestId: message.requestId, projectId: message.projectId });
        return;
      }
      if (message.type === "studio:projectDelete") {
        const confirmation = await vscode.window.showWarningMessage(
          "Delete this Studio project and its local canvas data? This cannot be undone.",
          { modal: true },
          "Delete project"
        );
        if (confirmation !== "Delete project") {
          this.postMessage({
            type: "studio:projectError",
            requestId: message.requestId,
            code: "cancelled",
            message: "Project deletion was cancelled."
          });
          return;
        }
        await this.queueProjectWrite(message.projectId, () => this.projects.delete(message.projectId));
        this.postMessage({ type: "studio:projectDeleted", requestId: message.requestId, projectId: message.projectId });
        return;
      }
    } catch (error) {
      this.postMessage({
        type: "studio:projectError",
        requestId: message.requestId,
        code: projectErrorCode(error),
        message: projectErrorMessage(error)
      });
    }
  }

  private async queueProjectWrite<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.projectWrites.get(projectId);
    const current = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(operation);
    this.projectWrites.set(projectId, current);
    try {
      return await current;
    } finally {
      if (this.projectWrites.get(projectId) === current) this.projectWrites.delete(projectId);
    }
  }

  private async waitForProjectWrites(projectId: string): Promise<void> {
    await this.projectWrites.get(projectId)?.catch(() => undefined);
  }

  private ensureProjectWorkspace(): void {
    const current = this.workspaceRoot();
    if (!this.projectWorkspaceBound) {
      if (current) {
        this.boundProjectWorkspace = path.resolve(current);
        this.projectWorkspaceBound = true;
      }
      return;
    }
    const normalizedCurrent = current ? path.resolve(current) : undefined;
    const workspaceMatches =
      normalizedCurrent && this.boundProjectWorkspace && process.platform === "win32"
        ? normalizedCurrent.toLowerCase() === this.boundProjectWorkspace.toLowerCase()
        : normalizedCurrent === this.boundProjectWorkspace;
    if (!workspaceMatches) {
      throw new StudioProjectStoreError(
        "workspace",
        "The workspace changed while Studio was open. Close and reopen Studio to use project storage here."
      );
    }
  }

  private async sendCurrentState(): Promise<void> {
    this.postHostState(await this.connection.currentState());
  }

  private postHostState(connection: OpenRouterConnectionState): void {
    this.postMessage({
      type: "studio:hostState",
      host: "vscode",
      workspaceTrusted: vscode.workspace.isTrusted,
      connection
    });
  }

  private postMessage(message: HostToStudioMessageInput): void {
    if (!this.panel) return;
    void this.panel.webview.postMessage(createHostToStudioMessage(message));
  }
}

/** Only Vite's bundled local JS/CSS enters the editor tab. The source HTML is not trusted as markup. */
export function buildStudioHtml(webview: vscode.Webview, studioRoot: vscode.Uri): string {
  const indexPath = vscode.Uri.joinPath(studioRoot, "index.html").fsPath;
  const builtHtml = readFileSync(indexPath, "utf8");
  const scripts = [...builtHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(
    (match) => match[1] ?? ""
  );
  const styles = [...builtHtml.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"[^>]*>/gi)].map(
    (match) => match[1] ?? ""
  );
  const script = scripts[0];
  if (scripts.length !== 1 || !script || styles.length === 0) throw new Error("Studio build entrypoints are missing.");

  const scriptUri = localAssetUri(webview, studioRoot, script);
  const cssUris = styles.map((asset) => localAssetUri(webview, studioRoot, asset));
  const source = webview.cspSource;
  const csp = [
    "default-src 'none'",
    `img-src ${source} data: blob:`,
    `font-src ${source} data:`,
    `media-src ${source} blob:`,
    `script-src ${source}`,
    `style-src ${source} 'unsafe-inline'`,
    `worker-src ${source} blob:`,
    `connect-src ${source}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
  <title>blenderSVG Studio</title>
  ${cssUris.map((uri) => `<link rel="stylesheet" href="${escapeAttribute(uri)}">`).join("\n  ")}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${escapeAttribute(scriptUri)}"></script>
</body>
</html>`;
}

function localAssetUri(webview: vscode.Webview, studioRoot: vscode.Uri, asset: string): string {
  if (!/^\.?\/?assets\/[a-zA-Z0-9._/-]+$/.test(asset)) throw new Error("Studio build contains a nonlocal asset.");
  const relative = asset.replace(/^\.\//, "");
  const normalized = path.posix.normalize(relative);
  if (!normalized.startsWith("assets/") || normalized.includes("../")) {
    throw new Error("Studio build asset escapes its directory.");
  }
  return webview.asWebviewUri(vscode.Uri.joinPath(studioRoot, ...normalized.split("/"))).toString();
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function projectErrorCode(error: unknown): "workspace" | "missing" | "corrupt" | "too-large" | "invalid-title" | "io" | "cancelled" {
  if (error instanceof StudioProjectStoreError) return error.code;
  return "io";
}

function projectErrorMessage(error: unknown): string {
  if (error instanceof StudioProjectStoreError) return error.message;
  return "Studio could not complete this project action. Check workspace permissions and try again.";
}

function isStudioProjectMessage(message: StudioToHostMessage): message is StudioProjectMessage {
  return (
    message.type === "studio:projectListRequest" ||
    message.type === "studio:ensureScratchpad" ||
    message.type === "studio:projectImportRequest" ||
    message.type === "studio:projectOpen" ||
    message.type === "studio:projectSave" ||
    message.type === "studio:projectDuplicate" ||
    message.type === "studio:projectRename" ||
    message.type === "studio:projectReveal" ||
    message.type === "studio:projectDelete"
  );
}

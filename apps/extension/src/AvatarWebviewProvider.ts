import * as vscode from "vscode";
import path from "node:path";
import type {
  AvatarManifest,
  AvatarState,
  AvatarTrigger,
  ExtensionToWebviewMessageInput,
  JsonValue,
  WebviewToExtensionMessage
} from "./avatarState.js";
import { createExtensionToWebviewMessage, parseWebviewToExtensionMessage } from "./avatarState.js";
import { getAvatarConfig, updateAvatarConfig } from "./settings.js";
import type { AvatarPackage, AvatarPackageRegistry } from "./avatarPackages.js";

export class AvatarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codexAvatar.assistantView";

  private view?: vscode.WebviewView;
  private currentState: AvatarState = "welcome";

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly packageRegistry?: AvatarPackageRegistry
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        ...(this.packageRegistry?.getAssetRoot()
          ? [vscode.Uri.file(this.packageRegistry.getAssetRoot() as string)]
          : [])
      ]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const parsed = parseWebviewToExtensionMessage(message);
      if (!parsed.success) {
        console.warn("[Codex Avatar] Rejected Webview message", parsed.error.issues);
        return;
      }

      void this.handleWebviewMessage(parsed.data);
    });
  }

  public postMessage(message: ExtensionToWebviewMessageInput): void {
    void this.view?.webview.postMessage(createExtensionToWebviewMessage(message));
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
    this.postMessage({ type: "avatar:setState", state });
  }

  public trigger(trigger: AvatarTrigger): void {
    this.postMessage({ type: "avatar:trigger", trigger });
  }

  public debugEvent(event: string, payload?: unknown): void {
    const safePayload = toJsonValue(payload);
    this.postMessage(
      safePayload === undefined ? { type: "debug:event", event } : { type: "debug:event", event, payload: safePayload }
    );
  }

  public refreshSettings(): void {
    this.postMessage({ type: "settings:update", config: getAvatarConfig() });
  }

  public async reloadAssets(): Promise<void> {
    await this.postActiveManifest();
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "webview:ready":
        this.refreshSettings();
        await this.postActiveManifest();
        this.setState(this.currentState);
        break;
      case "command:toggleAssistant":
        await vscode.commands.executeCommand("codexAvatar.toggleAssistant");
        break;
      case "command:resetSettings":
        await vscode.commands.executeCommand("codexAvatar.resetSettings");
        break;
      case "command:openAssetsFolder":
        await vscode.commands.executeCommand("codexAvatar.openAssetsFolder");
        break;
      case "command:reloadAvatar":
        await vscode.commands.executeCommand("codexAvatar.reloadAvatar");
        break;
      case "command:vectorizeImage":
        await vscode.commands.executeCommand("codexAvatar.vectorizeImage");
        break;
      case "command:exportBlender":
        await vscode.commands.executeCommand("codexAvatar.exportBlenderScene");
        break;
      case "settings:update":
        await updateAvatarConfig(message.config);
        this.refreshSettings();
        break;
      case "debug:log":
        console.log("[Codex Avatar]", message.message, message.payload ?? "");
        break;
    }
  }

  private async postActiveManifest(): Promise<void> {
    const view = this.view;
    if (!view) return;

    try {
      const activePackage = await this.packageRegistry?.getActivePackage();
      const manifest = activePackage
        ? createWebviewManifest(activePackage, view.webview)
        : this.createDefaultManifest(view.webview);
      this.postMessage({ type: "assets:manifestLoaded", manifest });
    } catch (error) {
      this.debugEvent("avatar_package_invalid", { message: error instanceof Error ? error.message : String(error) });
      this.postMessage({ type: "assets:manifestLoaded", manifest: this.createDefaultManifest(view.webview) });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.css"));
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; connect-src ${cspSource}; style-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource};">
  <title>Codex Avatar Studio</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private createDefaultManifest(webview: vscode.Webview): AvatarManifest {
    const avatarUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "svg", "placeholder-avatar.svg")
    );
    const pixiManifestUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "pixi", "placeholder-spritesheet.json")
    );

    return {
      schemaVersion: 1,
      version: "0.1.0",
      id: "default-coder-orb",
      name: "Default Coder Orb",
      author: "Codex Avatar Studio contributors",
      license: "Original project placeholder",
      preferredRuntime: "svg",
      fallbackRuntime: "svg",
      entrypoints: {
        svg: avatarUri.toString(),
        pixi: pixiManifestUri.toString()
      },
      capabilities: ["state-animation", "one-shot-triggers", "speech-level", "reduced-motion"],
      states: {
        idle: "idle_loop",
        welcome: "greet_once",
        listening: "listen_loop",
        thinking: "think_loop",
        speaking: "talk_loop",
        coding: "type_loop",
        reviewing: "inspect_loop",
        debugging: "debug_loop",
        building: "scan_loop",
        success: "celebrate_once",
        warning: "concerned_loop",
        error: "error_once",
        sleeping: "sleep_loop"
      },
      triggers: {
        blink: "blink_once",
        nod: "nod_once",
        celebrate: "celebrate_once",
        shake: "shake_once",
        point: "point_once",
        "start-speaking": "talk_start",
        "stop-speaking": "talk_stop"
      },
      runtimePriority: ["svg", "pixi"],
      assets: {
        svg: avatarUri.toString(),
        pixi: pixiManifestUri.toString()
      }
    };
  }
}

function getNonce(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : (JSON.parse(serialized) as JsonValue);
  } catch {
    return String(value);
  }
}

function createWebviewManifest(avatarPackage: AvatarPackage, webview: vscode.Webview): AvatarManifest {
  const toWebviewUri = (relativePath: string): string =>
    webview.asWebviewUri(vscode.Uri.file(path.resolve(avatarPackage.rootPath, relativePath))).toString();
  const mapPaths = (paths: Partial<Record<string, string>>): Partial<Record<string, string>> =>
    Object.fromEntries(Object.entries(paths).flatMap(([key, value]) => (value ? [[key, toWebviewUri(value)]] : [])));

  return {
    ...avatarPackage.manifest,
    entrypoints: mapPaths(avatarPackage.manifest.entrypoints),
    assets: avatarPackage.manifest.assets ? mapPaths(avatarPackage.manifest.assets) : undefined,
    previewImage: avatarPackage.manifest.previewImage ? toWebviewUri(avatarPackage.manifest.previewImage) : undefined
  };
}

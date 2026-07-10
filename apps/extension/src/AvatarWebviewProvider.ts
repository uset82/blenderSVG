import * as vscode from "vscode";
import type {
  AvatarManifest,
  AvatarState,
  AvatarTrigger,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "./avatarState.js";
import { avatarStates } from "./avatarState.js";
import { getAvatarConfig, updateAvatarConfig } from "./settings.js";

export class AvatarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codexAvatar.assistantView";

  private view?: vscode.WebviewView;
  private currentState: AvatarState = "welcome";

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      void this.handleWebviewMessage(message);
    });
  }

  public postMessage(message: ExtensionToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
    this.postMessage({ type: "avatar:setState", state });
  }

  public trigger(trigger: AvatarTrigger): void {
    this.postMessage({ type: "avatar:trigger", trigger });
  }

  public debugEvent(event: string, payload?: unknown): void {
    this.postMessage({ type: "debug:event", event, payload });
  }

  public refreshSettings(): void {
    this.postMessage({ type: "settings:update", config: getAvatarConfig() });
  }

  public reloadAssets(): void {
    if (!this.view) {
      return;
    }

    this.postMessage({ type: "assets:manifestLoaded", manifest: this.createDefaultManifest(this.view.webview) });
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "webview:ready":
        this.refreshSettings();
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

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;
    const avatarUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "svg", "placeholder-avatar.svg")
    );
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.css"));
    const bootstrap = JSON.stringify({
      config: getAvatarConfig(),
      placeholderAvatarUri: avatarUri.toString(),
      manifest: this.createDefaultManifest(webview)
    }).replace(/</g, "\\u003c");

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
  <script nonce="${nonce}">
    window.__CODEX_AVATAR_BOOTSTRAP__ = ${bootstrap};
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private createDefaultManifest(webview: vscode.Webview): AvatarManifest {
    const avatarUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "svg", "placeholder-avatar.svg")
    );

    return {
      version: "0.1.0",
      id: "default-coder-orb",
      name: "Default Coder Orb",
      runtimePriority: ["rive", "svg"],
      assets: {
        svg: avatarUri.toString()
      },
      rive: {
        stateMachine: "CodexAssistant",
        inputs: {
          state: "state",
          cursorX: "cursorX",
          cursorY: "cursorY",
          mouthOpen: "mouthOpen",
          scrollProgress: "scrollProgress",
          isSpeaking: "isSpeaking",
          isThinking: "isThinking",
          wave: "wave",
          celebrate: "celebrate",
          confused: "confused",
          point: "point"
        }
      },
      states: [...avatarStates]
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

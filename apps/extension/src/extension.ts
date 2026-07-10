import * as vscode from "vscode";
import * as path from "node:path";
import { vectorizeImageToSvg } from "@codex-avatar-studio/asset-pipeline";
import { AvatarWebviewProvider } from "./AvatarWebviewProvider.js";
import { avatarStates, isAvatarState, type AvatarState } from "./avatarState.js";
import { findBlenderExecutable, runBlenderExports, type BlenderExportMode } from "./blenderRunner.js";
import { IdeEventsController } from "./ideEvents.js";
import { getAvatarConfig, resetAvatarConfig, toggleAssistantEnabled } from "./settings.js";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new AvatarWebviewProvider(context.extensionUri);
  const ideEvents = new IdeEventsController(provider);
  const blenderOutputChannel = vscode.window.createOutputChannel("Codex Avatar Blender");
  ideEvents.start();

  context.subscriptions.push(
    ideEvents,
    blenderOutputChannel,
    vscode.window.registerWebviewViewProvider(AvatarWebviewProvider.viewType, provider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("codexAvatar")) {
        provider.refreshSettings();
      }
    }),
    registerCommand("codexAvatar.openAssistant", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codexAvatar");
    }),
    registerCommand("codexAvatar.toggleAssistant", async () => {
      const enabled = await toggleAssistantEnabled();
      const nextState: AvatarState = enabled ? "welcome" : "sleeping";
      provider.setState(nextState);
      vscode.window.showInformationMessage(`Codex Avatar ${enabled ? "enabled" : "disabled"}.`);
    }),
    registerCommand("codexAvatar.resetSettings", async () => {
      await resetAvatarConfig();
      provider.refreshSettings();
      provider.setState("welcome");
      provider.trigger("nod");
      vscode.window.showInformationMessage("Codex Avatar settings reset.");
    }),
    registerCommand("codexAvatar.openSettings", async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:codex-avatar-studio.codex-avatar-studio-extension"
      );
    }),
    registerCommand("codexAvatar.showDebugPanel", () => {
      provider.debugEvent("debug_panel_requested");
      vscode.window.showInformationMessage("Codex Avatar debug events are shown in the assistant panel.");
    }),
    registerCommand("codexAvatar.openAssetsFolder", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Open a workspace folder before opening avatar assets.");
        return;
      }

      const config = getAvatarConfig();
      const assetWorkspacePath = path.isAbsolute(config.assetWorkspace)
        ? config.assetWorkspace
        : path.join(workspaceFolder.uri.fsPath, config.assetWorkspace);
      const assetWorkspaceUri = vscode.Uri.file(assetWorkspacePath);

      await vscode.workspace.fs.createDirectory(assetWorkspaceUri);
      await vscode.commands.executeCommand("revealFileInOS", assetWorkspaceUri);
    }),
    registerCommand("codexAvatar.reloadAvatar", () => {
      provider.reloadAssets();
      provider.setState("success");
      provider.trigger("nod");
      vscode.window.showInformationMessage("Codex Avatar assets reloaded.");
    }),
    registerCommand("codexAvatar.setState", async () => {
      const selected = await vscode.window.showQuickPick([...avatarStates], {
        title: "Codex Avatar: Set State",
        placeHolder: "Choose a state to preview"
      });

      if (selected && isAvatarState(selected)) {
        ideEvents.setManualState(selected);
      }
    }),
    registerCommand("codexAvatar.startThinking", () => {
      ideEvents.setManualState("thinking");
    }),
    registerCommand("codexAvatar.startSpeaking", () => {
      ideEvents.setManualState("speaking");
    }),
    registerCommand("codexAvatar.markSuccess", () => {
      ideEvents.setManualState("success", "celebrate");
    }),
    registerCommand("codexAvatar.markError", () => {
      ideEvents.setManualState("error", "shake");
    }),
    ...(
      [
        "blink",
        "look-left",
        "look-right",
        "nod",
        "shake",
        "celebrate",
        "point",
        "start-speaking",
        "stop-speaking",
        "show-particles",
        "clear-effects"
      ] as const
    ).map((trigger) =>
      registerCommand(`codexAvatar.trigger.${trigger.replaceAll("-", "")}`, () => provider.trigger(trigger))
    ),
    registerCommand("codexAvatar.vectorizeImage", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Open a workspace folder before vectorizing avatar assets.");
        return;
      }

      const selectedFiles = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Vectorize Image to SVG",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          Images: ["png", "jpg", "jpeg", "webp"]
        }
      });
      const selectedFile = selectedFiles?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        provider.setState("building");
        const result = await vectorizeImageToSvg({
          inputPath: selectedFile.fsPath,
          workspaceRoot: workspaceFolder.uri.fsPath,
          assetWorkspace: getAvatarConfig().assetWorkspace
        });
        provider.setState("success");
        provider.trigger("celebrate");

        const warningSuffix = result.warnings.length > 0 ? ` ${result.warnings.length} warning(s).` : "";
        vscode.window.showInformationMessage(`Created optimized SVG: ${result.optimizedSvgPath}.${warningSuffix}`);
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(result.optimizedSvgPath));
        await vscode.window.showTextDocument(document, { preview: false });
      } catch (error) {
        provider.setState("error");
        provider.trigger("shake");
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    registerCommand("codexAvatar.exportBlenderScene", async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Open a workspace folder before exporting Blender avatar assets.");
        return;
      }

      const config = getAvatarConfig();
      const blenderPath = await findBlenderExecutable(config, blenderOutputChannel);
      if (!blenderPath) {
        blenderOutputChannel.show(true);
        vscode.window.showWarningMessage(
          "Blender was not found. Install Blender, add it to PATH, or set codexAvatar.blenderPath."
        );
        return;
      }

      const selectedFiles = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Export Blender Scene",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          "Blender Scene": ["blend"]
        }
      });
      const selectedFile = selectedFiles?.[0];
      if (!selectedFile) {
        return;
      }

      const selectedModes = await vscode.window.showQuickPick(
        [
          { label: "SVG line art", mode: "svg" as const },
          { label: "GLB WebGL asset", mode: "glb" as const },
          { label: "PNG preview", mode: "png" as const }
        ],
        {
          title: "Choose Blender exports",
          canPickMany: true,
          placeHolder: "SVG, GLB, PNG preview"
        }
      );
      const modes = selectedModes?.map((item) => item.mode) satisfies BlenderExportMode[] | undefined;
      if (!modes || modes.length === 0) {
        return;
      }

      try {
        provider.setState("building");
        blenderOutputChannel.show(true);
        const results = await runBlenderExports({
          blenderPath,
          blendPath: selectedFile.fsPath,
          workspaceRoot: workspaceFolder.uri.fsPath,
          assetWorkspace: config.assetWorkspace,
          extensionRoot: context.extensionUri.fsPath,
          modes,
          outputChannel: blenderOutputChannel
        });
        provider.setState("success");
        provider.trigger("celebrate");
        vscode.window.showInformationMessage(`Blender export complete: ${results.length} file(s) created.`);
      } catch (error) {
        provider.setState("error");
        provider.trigger("shake");
        blenderOutputChannel.show(true);
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes registered commands and providers through context subscriptions.
}

function registerCommand(command: string, callback: (...args: unknown[]) => unknown): vscode.Disposable {
  return vscode.commands.registerCommand(command, callback);
}

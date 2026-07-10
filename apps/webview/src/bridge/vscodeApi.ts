import { avatarStates, type WebviewBootstrap, type WebviewToExtensionMessage } from "./messages";
import { isAvatarRuntime } from "@codex-avatar-studio/avatar-core";

type VsCodeApi = {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __CODEX_AVATAR_BOOTSTRAP__?: WebviewBootstrap;
  }
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (!api && typeof window.acquireVsCodeApi === "function") {
    api = window.acquireVsCodeApi();
  }

  return api;
}

export function postToExtension(message: WebviewToExtensionMessage): void {
  getVsCodeApi()?.postMessage(message);
}

export function getBootstrap(): WebviewBootstrap {
  const previewRuntime = getLocalPreviewRuntime();

  return (
    window.__CODEX_AVATAR_BOOTSTRAP__ ?? {
      config: {
        enabled: true,
        runtime: previewRuntime,
        position: "activity-bar-view",
        character: "default",
        animationIntensity: "medium",
        focusMode: false,
        showSpeechBubble: true,
        respectReducedMotion: true,
        blenderPath: "",
        assetWorkspace: ".codex-avatar"
      },
      placeholderAvatarUri: "",
      manifest: {
        version: "0.1.0",
        id: "default-coder-orb",
        name: "Default Coder Orb",
        runtimePriority: ["svg"],
        assets: {},
        states: [...avatarStates]
      }
    }
  );
}

function getLocalPreviewRuntime(): WebviewBootstrap["config"]["runtime"] {
  const runtime = new URLSearchParams(window.location.search).get("runtime");
  return runtime && isAvatarRuntime(runtime) ? runtime : "svg";
}

export {
  avatarStates,
  type AvatarManifest,
  type AvatarRuntime,
  type AvatarState,
  type AvatarTrigger
} from "@codex-avatar-studio/avatar-core";

import type { AvatarManifest, AvatarRuntime, AvatarState, AvatarTrigger } from "@codex-avatar-studio/avatar-core";

export type AvatarPoseInput = {
  cursorX?: number;
  cursorY?: number;
  mouthOpen?: number;
  scrollProgress?: number;
};

export type AvatarConfig = {
  enabled: boolean;
  runtime: AvatarRuntime;
  position: "activity-bar-view" | "side-panel" | "bottom-right" | "bottom-left";
  character: string;
  animationIntensity: "low" | "medium" | "high";
  focusMode: boolean;
  showSpeechBubble: boolean;
  respectReducedMotion: boolean;
  blenderPath: string;
  assetWorkspace: string;
};

export type ExtensionToWebviewMessage =
  | { type: "avatar:setState"; state: AvatarState }
  | { type: "avatar:trigger"; trigger: AvatarTrigger }
  | { type: "avatar:setMessage"; text: string | null }
  | { type: "avatar:setPoseInput"; input: AvatarPoseInput }
  | { type: "settings:update"; config: AvatarConfig }
  | { type: "assets:manifestLoaded"; manifest: AvatarManifest }
  | { type: "debug:event"; event: string; payload?: unknown };

export type WebviewToExtensionMessage =
  | { type: "webview:ready" }
  | { type: "command:toggleAssistant" }
  | { type: "command:resetSettings" }
  | { type: "command:openAssetsFolder" }
  | { type: "command:reloadAvatar" }
  | { type: "command:vectorizeImage" }
  | { type: "command:exportBlender" }
  | { type: "settings:update"; config: Partial<AvatarConfig> }
  | { type: "debug:log"; message: string; payload?: unknown };

export type WebviewBootstrap = {
  config: AvatarConfig;
  placeholderAvatarUri: string;
  manifest: AvatarManifest;
};

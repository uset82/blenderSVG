import * as vscode from "vscode";
import type { AvatarExtensionConfig } from "./avatarState.js";
import { isAvatarRuntime } from "./avatarState.js";

export const defaultAvatarConfig: AvatarExtensionConfig = {
  enabled: true,
  runtime: "svg",
  position: "activity-bar-view",
  character: "default",
  animationIntensity: "medium",
  focusMode: false,
  showSpeechBubble: true,
  respectReducedMotion: true,
  blenderPath: "",
  assetWorkspace: ".codex-avatar"
};

const avatarConfigKeys = Object.keys(defaultAvatarConfig) as Array<keyof AvatarExtensionConfig>;
const positions = ["activity-bar-view", "side-panel", "bottom-right", "bottom-left"] as const;
const animationIntensities = ["low", "medium", "high"] as const;

export function getAvatarConfig(): AvatarExtensionConfig {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const runtime = config.get<string>("runtime", defaultAvatarConfig.runtime);
  const position = config.get<string>("position", defaultAvatarConfig.position);
  const animationIntensity = config.get<string>("animationIntensity", defaultAvatarConfig.animationIntensity);

  return {
    enabled: config.get("enabled", defaultAvatarConfig.enabled),
    runtime: isAvatarRuntime(runtime) ? runtime : defaultAvatarConfig.runtime,
    position: isPosition(position) ? position : defaultAvatarConfig.position,
    character: config.get("character", defaultAvatarConfig.character),
    animationIntensity: isAnimationIntensity(animationIntensity) ? animationIntensity : defaultAvatarConfig.animationIntensity,
    focusMode: config.get("focusMode", defaultAvatarConfig.focusMode),
    showSpeechBubble: config.get("showSpeechBubble", defaultAvatarConfig.showSpeechBubble),
    respectReducedMotion: config.get("respectReducedMotion", defaultAvatarConfig.respectReducedMotion),
    blenderPath: config.get("blenderPath", defaultAvatarConfig.blenderPath),
    assetWorkspace: config.get("assetWorkspace", defaultAvatarConfig.assetWorkspace)
  };
}

export async function toggleAssistantEnabled(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const nextEnabled = !config.get("enabled", true);
  await config.update("enabled", nextEnabled, vscode.ConfigurationTarget.Global);
  return nextEnabled;
}

export async function updateAvatarConfig(nextConfig: Partial<AvatarExtensionConfig>): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const entries = Object.entries(sanitizeAvatarConfigPatch(nextConfig)) as [
    keyof AvatarExtensionConfig,
    AvatarExtensionConfig[keyof AvatarExtensionConfig]
  ][];

  await Promise.all(
    entries.map(([key, value]) => config.update(key, value, vscode.ConfigurationTarget.Global))
  );
}

export async function resetAvatarConfig(): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexAvatar");

  await Promise.all(avatarConfigKeys.map(key => config.update(key, undefined, vscode.ConfigurationTarget.Global)));
}

function sanitizeAvatarConfigPatch(nextConfig: Partial<AvatarExtensionConfig>): Partial<AvatarExtensionConfig> {
  const sanitized: Partial<AvatarExtensionConfig> = {};

  if (typeof nextConfig.enabled === "boolean") {
    sanitized.enabled = nextConfig.enabled;
  }
  if (typeof nextConfig.runtime === "string" && isAvatarRuntime(nextConfig.runtime)) {
    sanitized.runtime = nextConfig.runtime;
  }
  if (typeof nextConfig.position === "string" && isPosition(nextConfig.position)) {
    sanitized.position = nextConfig.position;
  }
  if (typeof nextConfig.character === "string" && nextConfig.character.trim().length > 0) {
    sanitized.character = nextConfig.character.trim();
  }
  if (typeof nextConfig.animationIntensity === "string" && isAnimationIntensity(nextConfig.animationIntensity)) {
    sanitized.animationIntensity = nextConfig.animationIntensity;
  }
  if (typeof nextConfig.focusMode === "boolean") {
    sanitized.focusMode = nextConfig.focusMode;
  }
  if (typeof nextConfig.showSpeechBubble === "boolean") {
    sanitized.showSpeechBubble = nextConfig.showSpeechBubble;
  }
  if (typeof nextConfig.respectReducedMotion === "boolean") {
    sanitized.respectReducedMotion = nextConfig.respectReducedMotion;
  }
  if (typeof nextConfig.blenderPath === "string") {
    sanitized.blenderPath = nextConfig.blenderPath;
  }
  if (typeof nextConfig.assetWorkspace === "string" && nextConfig.assetWorkspace.trim().length > 0) {
    sanitized.assetWorkspace = nextConfig.assetWorkspace.trim();
  }

  return sanitized;
}

function isPosition(value: string): value is AvatarExtensionConfig["position"] {
  return (positions as readonly string[]).includes(value);
}

function isAnimationIntensity(value: string): value is AvatarExtensionConfig["animationIntensity"] {
  return (animationIntensities as readonly string[]).includes(value);
}

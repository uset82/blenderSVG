export const avatarRuntimes = ["svg", "rive", "live2d", "webgl", "webgpu"] as const;
export type AvatarRuntime = (typeof avatarRuntimes)[number];

export const avatarStates = [
  "idle",
  "welcome",
  "listening",
  "thinking",
  "speaking",
  "coding",
  "reviewing",
  "debugging",
  "building",
  "success",
  "warning",
  "error",
  "sleeping"
] as const;
export type AvatarState = (typeof avatarStates)[number];

export const avatarTriggers = [
  "blink",
  "wave",
  "nod",
  "shakeHead",
  "celebrate",
  "confused",
  "point",
  "sleep",
  "wake",
  "pulse"
] as const;
export type AvatarTrigger = (typeof avatarTriggers)[number];

export const ideAssistantEvents = [
  "extension_ready",
  "active_editor_changed",
  "text_document_changed",
  "file_saved",
  "diagnostics_changed",
  "terminal_started",
  "terminal_finished",
  "task_started",
  "task_finished",
  "debug_started",
  "debug_stopped",
  "codex_task_started",
  "codex_task_thinking",
  "codex_task_streaming",
  "codex_task_finished",
  "codex_task_failed",
  "user_message_started",
  "user_message_sent",
  "assistant_message_started",
  "assistant_message_streaming",
  "assistant_message_finished"
] as const;
export type IdeAssistantEvent = (typeof ideAssistantEvents)[number];

export type AvatarMood = "neutral" | "focused" | "curious" | "happy" | "concerned" | "confused" | "sleepy";

export type AvatarMessage = {
  id: string;
  text: string;
  tone?: AvatarMood;
  createdAt: number;
  ttlMs?: number;
};

export type AvatarPoseInput = {
  cursorX?: number;
  cursorY?: number;
  mouthOpen?: number;
  scrollProgress?: number;
  audioLevel?: number;
};

export const live2dParameterChannels = ["mouthOpen", "angleX", "angleY", "breath"] as const;
export type Live2DParameterChannel = (typeof live2dParameterChannels)[number];
export type Live2DParameterMap = Partial<Record<Live2DParameterChannel, string>>;
export type Live2DStateMap = Partial<Record<AvatarState, string>>;

export type AvatarConfig = {
  enabled: boolean;
  runtime: AvatarRuntime;
  character: string;
  reducedMotion: boolean;
  showSpeechBubble: boolean;
  intensity: "low" | "medium" | "high";
  position: "bottom-right" | "bottom-left" | "side-panel" | "activity-bar-view";
};

export type AvatarManifest = {
  version: string;
  id: string;
  name: string;
  runtimePriority: AvatarRuntime[];
  assets: Partial<Record<AvatarRuntime, string>>;
  states: AvatarState[];
  rive?: {
    stateMachine: string;
    inputs: Partial<
      Record<
        "state" | "cursorX" | "cursorY" | "mouthOpen" | "scrollProgress" | "isSpeaking" | "isThinking" | AvatarTrigger,
        string
      >
    >;
  };
  live2d?: {
    model3: string;
    model?: string;
    parameters?: Live2DParameterMap;
    motions?: Live2DStateMap;
    expressions?: Live2DStateMap;
  };
};

export type AvatarManifestValidationResult = {
  valid: boolean;
  manifest?: AvatarManifest;
  errors: string[];
  warnings: string[];
};

export function isAvatarRuntime(value: string): value is AvatarRuntime {
  return (avatarRuntimes as readonly string[]).includes(value);
}

export function isAvatarState(value: string): value is AvatarState {
  return (avatarStates as readonly string[]).includes(value);
}

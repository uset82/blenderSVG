import type { AvatarState, AvatarTrigger } from "@codex-avatar-studio/avatar-core";

export type SpriteClip = {
  name: string;
  frames: readonly number[];
  fps?: number | undefined;
  loop?: boolean | undefined;
  priority?: number | undefined;
};

export type SpriteSheetManifest = {
  schemaVersion: 1;
  image: string;
  frameWidth: number;
  frameHeight: number;
  clips: Readonly<Record<string, SpriteClip>>;
};

export type SpriteSheetValidation = { valid: boolean; errors: string[] };

const stateClipMap: Record<AvatarState, string> = {
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
};

const triggerClipMap: Partial<Record<AvatarTrigger, string>> = {
  blink: "blink_once",
  "look-left": "look_left_once",
  "look-right": "look_right_once",
  nod: "nod_once",
  shake: "shake_once",
  celebrate: "celebrate_once",
  point: "point_once",
  "start-speaking": "talk_start",
  "stop-speaking": "talk_stop",
  "show-particles": "particles_success",
  "clear-effects": "clear_effects"
};

export function validateSpriteSheetManifest(value: unknown): SpriteSheetValidation {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return { valid: false, errors: ["Manifest must be an object."] };
  const manifest = value as Partial<SpriteSheetManifest>;
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (typeof manifest.image !== "string" || manifest.image.length === 0) errors.push("image is required.");
  if (typeof manifest.frameWidth !== "number" || !Number.isInteger(manifest.frameWidth) || manifest.frameWidth <= 0) {
    errors.push("frameWidth must be positive.");
  }
  if (
    typeof manifest.frameHeight !== "number" ||
    !Number.isInteger(manifest.frameHeight) ||
    manifest.frameHeight <= 0
  ) {
    errors.push("frameHeight must be positive.");
  }
  if (!manifest.clips || typeof manifest.clips !== "object") errors.push("clips are required.");
  for (const [name, clip] of Object.entries(manifest.clips ?? {})) {
    if (
      !clip ||
      !Array.isArray(clip.frames) ||
      clip.frames.length === 0 ||
      clip.frames.some((frame) => !Number.isInteger(frame) || frame < 0)
    ) {
      errors.push(`Clip "${name}" must contain non-negative integer frames.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function clipForState(manifest: SpriteSheetManifest, state: AvatarState): SpriteClip {
  return (
    manifest.clips[stateClipMap[state]] ?? manifest.clips.idle_loop ?? { name: "fallback", frames: [0], loop: true }
  );
}

export function clipForTrigger(manifest: SpriteSheetManifest, trigger: AvatarTrigger): SpriteClip | undefined {
  const name = triggerClipMap[trigger];
  return name ? manifest.clips[name] : undefined;
}

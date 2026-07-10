import type { AvatarManifest, AvatarPoseInput, AvatarRuntime, AvatarState, AvatarTrigger } from "./types.js";

export type AvatarRuntimeAdapter = {
  id: string;
  mount: (element: HTMLElement) => Promise<void> | void;
  unmount: () => Promise<void> | void;
  setState: (state: AvatarState) => void;
  trigger: (trigger: AvatarTrigger) => void;
  setPoseInput: (input: AvatarPoseInput) => void;
  setMessage?: (text: string | null) => void;
};

export type RuntimeSupport = Partial<Record<AvatarRuntime, boolean>>;

export function resolveAvatarRuntime(
  preferredRuntime: AvatarRuntime,
  manifest: Pick<AvatarManifest, "runtimePriority" | "assets">,
  support: RuntimeSupport = {}
): AvatarRuntime {
  const candidates = uniqueRuntimes([preferredRuntime, ...manifest.runtimePriority, "svg"]);

  for (const runtime of candidates) {
    const supported = support[runtime] ?? true;
    const hasAsset = runtime === "svg" || Boolean(manifest.assets[runtime]);
    if (supported && hasAsset) {
      return runtime;
    }
  }

  return "svg";
}

function uniqueRuntimes(runtimes: AvatarRuntime[]): AvatarRuntime[] {
  return [...new Set(runtimes)];
}

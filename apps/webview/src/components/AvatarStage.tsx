import type { AvatarConfig, AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";
import { SvgAvatarRenderer } from "../renderers/SvgAvatarRenderer";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useSystemReducedMotion } from "../hooks/useSystemReducedMotion";

type AvatarStageProps = {
  state: AvatarState;
  config: AvatarConfig;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

/**
 * The Phase 1 base Webview intentionally renders the SVG runtime only.
 * Preserved optional adapters stay outside the active import graph until their
 * numbered implementation phases reintroduce them through isolated packages.
 */
export function AvatarStage({ state, config, poseInput }: AvatarStageProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const pageVisible = usePageVisibility();
  const reducedMotion = !pageVisible || (config.respectReducedMotion && systemReducedMotion);
  const effectiveIntensity = config.focusMode ? "low" : config.animationIntensity;

  return (
    <section className="avatar-stage" data-page-visible={String(pageVisible)} aria-label="Avatar status">
      <SvgAvatarRenderer
        state={state}
        poseInput={poseInput}
        reducedMotion={reducedMotion}
        intensity={effectiveIntensity}
        focusMode={config.focusMode}
      />
      <div className="state-line">
        <span className="state-dot" data-avatar-state={state} aria-hidden="true" />
        <span>{state}</span>
      </div>
    </section>
  );
}

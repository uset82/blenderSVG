import { useCallback, useState } from "react";
import type { AvatarConfig, AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";
import { PixiAvatarRenderer } from "../renderers/PixiAvatarRenderer";
import { RuntimeBoundary } from "../renderers/RuntimeBoundary";
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
 * PixiJS is loaded only when selected. SVG remains the immediate fallback for
 * unsupported environments or initialization failures.
 */
export function AvatarStage({ state, config, poseInput, manifest, triggerEvent }: AvatarStageProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const pageVisible = usePageVisibility();
  const reducedMotion = config.noAnimation || !pageVisible || (config.respectReducedMotion && systemReducedMotion);
  const effectiveIntensity = config.noAnimation || config.focusMode ? "low" : config.animationIntensity;
  const runtimeKey = `${config.runtime}:${manifest.id}`;
  const [pixiFailureKey, setPixiFailureKey] = useState<string | null>(null);
  const pixiFailed = pixiFailureKey === runtimeKey;
  const handlePixiError = useCallback(() => setPixiFailureKey(runtimeKey), [runtimeKey]);

  const svgFallback = (
    <SvgAvatarRenderer
      state={state}
      poseInput={poseInput}
      reducedMotion={reducedMotion}
      intensity={effectiveIntensity}
      focusMode={config.focusMode}
      lipSyncEnabled={config.lipSyncEnabled}
    />
  );
  const usePixi = config.runtime === "pixi" && !pixiFailed;

  return (
    <section className="avatar-stage" data-page-visible={String(pageVisible)} aria-label="Avatar status">
      {usePixi ? (
        <RuntimeBoundary fallback={svgFallback} resetKey={`${config.runtime}:${manifest.id}`}>
          <PixiAvatarRenderer
            key={runtimeKey}
            state={state}
            config={config}
            manifest={manifest}
            poseInput={poseInput}
            triggerEvent={triggerEvent}
            pageVisible={pageVisible}
            reducedMotion={reducedMotion}
            intensity={effectiveIntensity}
            focusMode={config.focusMode}
            onError={handlePixiError}
          />
        </RuntimeBoundary>
      ) : (
        svgFallback
      )}
      <div className="state-line">
        <span className="state-dot" data-avatar-state={state} aria-hidden="true" />
        <span>{state}</span>
      </div>
    </section>
  );
}

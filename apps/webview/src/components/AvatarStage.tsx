import { lazy, Suspense } from "react";
import type { AvatarConfig, AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";
import { RuntimeBoundary } from "../renderers/RuntimeBoundary";
import { SvgAvatarRenderer } from "../renderers/SvgAvatarRenderer";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useSystemReducedMotion } from "../hooks/useSystemReducedMotion";

const LazyRiveAvatarRenderer = lazy(() =>
  import("../renderers/RiveAvatarRenderer").then(module => ({ default: module.RiveAvatarRenderer }))
);
const LazyLive2DAvatarRenderer = lazy(() =>
  import("../renderers/Live2DAvatarRenderer").then(module => ({ default: module.Live2DAvatarRenderer }))
);
const LazyWebGLAvatarRenderer = lazy(() =>
  import("../renderers/WebGLAvatarRenderer").then(module => ({ default: module.WebGLAvatarRenderer }))
);

type AvatarStageProps = {
  state: AvatarState;
  config: AvatarConfig;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

export function AvatarStage({ state, config, poseInput, manifest, triggerEvent }: AvatarStageProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const pageVisible = usePageVisibility();
  const reducedMotion = !pageVisible || (config.respectReducedMotion && systemReducedMotion);
  const effectiveIntensity = config.focusMode ? "low" : config.animationIntensity;
  const fallback = (
    <SvgAvatarRenderer
      state={state}
      poseInput={poseInput}
      reducedMotion={reducedMotion}
      intensity={effectiveIntensity}
      focusMode={config.focusMode}
    />
  );
  const riveAsset = manifest.assets.rive;
  const gpuRuntime = config.runtime === "webgl" || config.runtime === "webgpu" ? config.runtime : null;

  return (
    <section className="avatar-stage" data-page-visible={String(pageVisible)} aria-label="Avatar status">
      {gpuRuntime ? (
        <RuntimeBoundary fallback={fallback} resetKey={`${config.runtime}:${manifest.assets.webgl ?? ""}:${manifest.assets.webgpu ?? ""}`}>
          <Suspense fallback={fallback}>
            <LazyWebGLAvatarRenderer
              requestedRuntime={gpuRuntime}
              state={state}
              poseInput={poseInput}
              manifest={manifest}
              triggerEvent={triggerEvent}
              fallback={fallback}
            />
          </Suspense>
        </RuntimeBoundary>
      ) : config.runtime === "live2d" ? (
        <RuntimeBoundary
          fallback={fallback}
          resetKey={`${config.runtime}:${manifest.live2d?.model3 ?? manifest.live2d?.model ?? manifest.assets.live2d ?? ""}`}
        >
          <Suspense fallback={fallback}>
            <LazyLive2DAvatarRenderer
              state={state}
              poseInput={poseInput}
              manifest={manifest}
              triggerEvent={triggerEvent}
              fallback={fallback}
            />
          </Suspense>
        </RuntimeBoundary>
      ) : config.runtime === "rive" && riveAsset ? (
        <RuntimeBoundary fallback={fallback} resetKey={`${config.runtime}:${riveAsset}`}>
          <Suspense fallback={fallback}>
            <LazyRiveAvatarRenderer
              state={state}
              poseInput={poseInput}
              manifest={manifest}
              triggerEvent={triggerEvent}
              fallback={fallback}
            />
          </Suspense>
        </RuntimeBoundary>
      ) : (
        fallback
      )}
      <div className="state-line">
        <span className="state-dot" data-avatar-state={state} aria-hidden="true" />
        <span>{state}</span>
      </div>
    </section>
  );
}

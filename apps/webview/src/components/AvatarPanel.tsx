import { postToExtension } from "../bridge/vscodeApi";
import { AssetManagerPanel } from "./AssetManagerPanel";
import { AssistantBubble } from "./AssistantBubble";
import { AvatarStage } from "./AvatarStage";
import { SettingsPanel } from "./SettingsPanel";
import { StatusDebugPanel } from "./StatusDebugPanel";
import type { BridgeState } from "../bridge/useExtensionBridge";
import { useAvatarBehavior } from "../hooks/useAvatarBehavior";
import { AvatarRuntimeBoundary } from "./AvatarRuntimeBoundary";

type AvatarPanelProps = BridgeState;

export function AvatarPanel({
  avatarState,
  config,
  message,
  poseInput,
  manifest,
  triggerEvent,
  debugEvents
}: AvatarPanelProps) {
  const behavior = useAvatarBehavior({
    externalState: avatarState,
    externalMessage: message,
    externalPoseInput: poseInput,
    config,
    triggerEvent
  });

  return (
    <main
      className="avatar-panel"
      data-enabled={String(config.enabled)}
      data-focus-mode={String(config.focusMode)}
      data-no-animation={String(config.noAnimation)}
      data-intensity={config.noAnimation || config.focusMode ? "low" : config.animationIntensity}
      data-position={config.position}
    >
      <AvatarRuntimeBoundary>
        <AvatarStage
          state={behavior.displayState}
          config={config}
          poseInput={behavior.poseInput}
          manifest={manifest}
          triggerEvent={behavior.triggerEvent}
        />
      </AvatarRuntimeBoundary>
      <AssistantBubble text={behavior.displayMessage} />
      <nav className="action-row" aria-label="Avatar actions">
        <button type="button" onClick={() => postToExtension({ type: "command:toggleAssistant" })}>
          Toggle
        </button>
        <button type="button" onClick={() => postToExtension({ type: "command:vectorizeImage" })}>
          Vectorize
        </button>
        <button type="button" onClick={() => postToExtension({ type: "command:exportBlender" })}>
          Blender
        </button>
      </nav>
      <SettingsPanel config={config} />
      <AssetManagerPanel config={config} manifest={manifest} />
      {config.debugOverlay ? <StatusDebugPanel events={debugEvents} /> : null}
    </main>
  );
}

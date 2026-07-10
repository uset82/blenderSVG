import { useEffect, useMemo, useState } from "react";
import type {
  AvatarConfig,
  AvatarManifest,
  AvatarPoseInput,
  AvatarState,
  AvatarTrigger,
  ExtensionToWebviewMessage
} from "./messages";
import { getBootstrap, postToExtension } from "./vscodeApi";

export type BridgeState = {
  avatarState: AvatarState;
  config: AvatarConfig;
  message: string | null;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  debugEvents: string[];
};

export function useExtensionBridge(): BridgeState {
  const bootstrap = useMemo(() => getBootstrap(), []);
  const [avatarState, setAvatarState] = useState<AvatarState>("welcome");
  const [config, setConfig] = useState<AvatarConfig>(bootstrap.config);
  const [message, setMessage] = useState<string | null>("Ready to build.");
  const [poseInput, setPoseInput] = useState<AvatarPoseInput>({});
  const [manifest, setManifest] = useState<AvatarManifest>(bootstrap.manifest);
  const [triggerEvent, setTriggerEvent] = useState<{ trigger: AvatarTrigger; sequence: number } | null>(null);
  const [debugEvents, setDebugEvents] = useState<string[]>([]);

  useEffect(() => {
    postToExtension({ type: "webview:ready" });

    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const nextMessage = event.data;

      switch (nextMessage.type) {
        case "avatar:setState":
          setAvatarState(nextMessage.state);
          setMessage(messageForState(nextMessage.state));
          break;
        case "avatar:setMessage":
          setMessage(nextMessage.text);
          break;
        case "avatar:setPoseInput":
          setPoseInput(nextMessage.input);
          break;
        case "assets:manifestLoaded":
          setManifest(nextMessage.manifest);
          break;
        case "settings:update":
          setConfig(nextMessage.config);
          break;
        case "debug:event":
          setDebugEvents((previous) => [nextMessage.event, ...previous].slice(0, 5));
          break;
        case "avatar:trigger":
          setTriggerEvent((previous) => ({
            trigger: nextMessage.trigger,
            sequence: (previous?.sequence ?? 0) + 1
          }));
          setDebugEvents((previous) => [`trigger:${nextMessage.trigger}`, ...previous].slice(0, 5));
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return { avatarState, config, message, poseInput, manifest, triggerEvent, debugEvents };
}

function messageForState(state: AvatarState): string {
  const messages: Record<AvatarState, string> = {
    idle: "Ready.",
    welcome: "Ready to build.",
    listening: "Listening.",
    thinking: "Thinking.",
    speaking: "Answering.",
    coding: "Coding.",
    reviewing: "Reviewing.",
    debugging: "Debugging.",
    building: "Building.",
    success: "Done.",
    warning: "Needs attention.",
    error: "Error detected.",
    sleeping: "Quiet mode."
  };

  return messages[state];
}

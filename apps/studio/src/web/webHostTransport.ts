import {
  createHostToStudioMessage,
  createStudioToHostMessage,
  type HostToStudioMessage,
  parseHostToStudioMessage,
  type StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { OpenRouterChatController } from "@codex-avatar-studio/studio-host-core/openRouterChat";
import {
  OpenRouterConnectionController,
  type SecretStore
} from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import type { StudioTransport } from "../bridge/studioTransports.js";
import { browserOpenRouterSecretStore } from "./webSecretStore.js";

export interface WebHostTransportOptions {
  secrets?: SecretStore;
  request?: typeof fetch;
}

/** Runs the OpenRouter controllers in the page. Messages are validated on the way in and out. */
export function createWebHostTransport(options: WebHostTransportOptions = {}): StudioTransport {
  const listeners = new Set<(message: HostToStudioMessage) => void>();
  const secrets = options.secrets ?? browserOpenRouterSecretStore();
  const request = options.request ?? fetch;
  const deliver = (message: Parameters<typeof createHostToStudioMessage>[0]) => {
    const parsed = parseHostToStudioMessage(createHostToStudioMessage(message));
    if (!parsed.success) return;
    for (const listener of listeners) listener(parsed.data);
  };
  const sendHostState = (connection: Extract<HostToStudioMessage, { type: "studio:hostState" }>["connection"]) => {
    deliver({ type: "studio:hostState", host: "web", workspaceTrusted: true, connection });
  };
  const chat = new OpenRouterChatController(secrets, deliver, request, { title: "Kurva" });
  const connection = new OpenRouterConnectionController(
    secrets,
    async () => undefined,
    sendHostState,
    request,
    "this browser"
  );
  return {
    kind: "web",
    send(message) {
      void handleWebHostMessage(createStudioToHostMessage(message), chat, connection, deliver, sendHostState);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

async function handleWebHostMessage(
  message: StudioToHostMessage,
  chat: OpenRouterChatController,
  connection: OpenRouterConnectionController,
  deliver: (message: Parameters<typeof createHostToStudioMessage>[0]) => void,
  sendHostState: (connection: Extract<HostToStudioMessage, { type: "studio:hostState" }>["connection"]) => void
): Promise<void> {
  if (message.type === "studio:ready") {
    sendHostState(await connection.currentState());
  } else if (message.type === "studio:modelCatalogRequest") {
    deliver(await chat.refreshModels());
  } else if (message.type === "studio:chatRequest") {
    void chat.send(message);
  } else if (message.type === "studio:chatCancel" || message.type === "studio:agentStop") {
    chat.cancel(message.requestId);
  } else if (message.type === "studio:toolPermission") {
    chat.resolveToolPermission(message.requestId, message.callId, message.granted);
  } else if (message.type === "studio:toolExecutionResult") {
    chat.resolveToolExecutionResult(message.requestId, message.callId, {
      ok: message.ok,
      content: message.content,
      ...(message.imageDataUrl ? { imageDataUrl: message.imageDataUrl } : {})
    });
  } else if (message.type === "studio:openRouterConnection") {
    if (message.action === "connect" || message.action === "replace") {
      sendHostState(await connection.currentState());
      return;
    }
    if (message.action === "disconnect") chat.cancelAll();
    sendHostState(await connection.run(message.action));
  }
}

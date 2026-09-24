import {
  createStudioToHostMessage,
  type HostToStudioMessage,
  parseHostToStudioMessage,
  type StudioToHostMessageInput
} from "@codex-avatar-studio/avatar-core";

export const OFFLINE_HOST_MESSAGE = "Offline preview – nothing is saved";

export type StudioTransportKind = "vscode" | "websocket" | "fixture";

export interface StudioTransport {
  kind: StudioTransportKind;
  send(message: StudioToHostMessageInput): void;
  subscribe(listener: (message: HostToStudioMessage) => void): () => void;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export function createVsCodeTransport(api: VsCodeApi): StudioTransport {
  return {
    kind: "vscode",
    send(message) {
      api.postMessage(createStudioToHostMessage(message));
    },
    subscribe(listener) {
      const onMessage = (event: MessageEvent<unknown>) => {
        const parsed = parseHostToStudioMessage(event.data);
        if (parsed.success) listener(parsed.data);
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }
  };
}

export function createWebSocketTransport(
  socket: Pick<WebSocket, "send" | "addEventListener" | "removeEventListener">
): StudioTransport {
  return {
    kind: "websocket",
    send(message) {
      socket.send(JSON.stringify(createStudioToHostMessage(message)));
    },
    subscribe(listener) {
      const onMessage = (event: MessageEvent<unknown>) => {
        let payload: unknown = event.data;
        if (typeof event.data === "string") {
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
        }
        const parsed = parseHostToStudioMessage(payload);
        if (parsed.success) listener(parsed.data);
      };
      socket.addEventListener("message", onMessage as EventListener);
      return () => socket.removeEventListener("message", onMessage as EventListener);
    }
  };
}

type SocketLike = Pick<WebSocket, "send" | "addEventListener" | "removeEventListener">;

/** Reopens the socket after a close and sends studio:ready so the host can resync state. */
export function createReconnectingWebSocketTransport(connect: () => SocketLike): StudioTransport & { close(): void } {
  let socket = connect();
  let stopped = false;
  const listeners = new Set<(message: HostToStudioMessage) => void>();
  const attach = (current: SocketLike) => {
    const onMessage = (event: MessageEvent<unknown>) => {
      let payload: unknown = event.data;
      if (typeof event.data === "string") {
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
      }
      const parsed = parseHostToStudioMessage(payload);
      if (parsed.success) for (const listener of listeners) listener(parsed.data);
    };
    const onClose = () => {
      current.removeEventListener("message", onMessage as EventListener);
      current.removeEventListener("close", onClose as EventListener);
      if (stopped) return;
      socket = connect();
      socket.send(JSON.stringify(createStudioToHostMessage({ type: "studio:ready" })));
      attach(socket);
    };
    current.addEventListener("message", onMessage as EventListener);
    current.addEventListener("close", onClose as EventListener);
  };
  attach(socket);
  return {
    kind: "websocket",
    send(message) {
      socket.send(JSON.stringify(createStudioToHostMessage(message)));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      stopped = true;
    }
  };
}

export function createFixtureTransport(): StudioTransport & { sent: unknown[]; deliver(message: unknown): void } {
  const listeners = new Set<(message: HostToStudioMessage) => void>();
  const sent: unknown[] = [];
  return {
    kind: "fixture",
    sent,
    send(message) {
      sent.push(createStudioToHostMessage(message));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    deliver(message) {
      const parsed = parseHostToStudioMessage(message);
      if (!parsed.success) return;
      for (const listener of listeners) listener(parsed.data);
    }
  };
}

export function selectStudioTransport(options?: {
  vscodeApi?: VsCodeApi | null;
  socket?: Pick<WebSocket, "send" | "addEventListener" | "removeEventListener"> | null;
}): StudioTransport {
  if (options?.vscodeApi) return createVsCodeTransport(options.vscodeApi);
  if (options?.socket) return createWebSocketTransport(options.socket);
  return createFixtureTransport();
}

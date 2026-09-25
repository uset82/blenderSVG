import {
  createStudioToHostMessage,
  type HostToStudioMessage,
  parseHostToStudioMessage,
  STUDIO_PROTOCOL_VERSION,
  type StudioToHostMessageInput
} from "@codex-avatar-studio/avatar-core";

export const OFFLINE_HOST_MESSAGE = "Offline preview – nothing is saved";

export type StudioTransportKind = "vscode" | "websocket" | "fixture" | "web";

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

type SocketLike = Pick<WebSocket, "send" | "addEventListener" | "removeEventListener"> & {
  readyState?: number;
  close?: (code?: number, reason?: string) => void;
};

/** Reopens the socket after a close and sends studio:ready so the host can resync state. */
export function createReconnectingWebSocketTransport(connect: () => SocketLike): StudioTransport & { close(): void } {
  let stopped = false;
  let socket: SocketLike | undefined;
  let reconnectTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let reconnectDelay = 250;
  const listeners = new Set<(message: HostToStudioMessage) => void>();
  const queuedReady: string[] = [];
  const isOpen = (current: SocketLike | undefined) =>
    current !== undefined && (current.readyState === undefined || current.readyState === 1);
  const deliver = (message: HostToStudioMessage) => {
    for (const listener of listeners) listener(message);
  };
  const sendReady = (current: SocketLike) => {
    current.send(JSON.stringify(createStudioToHostMessage({ type: "studio:ready" })));
  };
  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) return;
    reconnectTimer = globalThis.setTimeout(() => {
      reconnectTimer = undefined;
      openSocket();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 5_000);
  };
  const openSocket = () => {
    if (stopped) return;
    try {
      socket = connect();
    } catch {
      scheduleReconnect();
      return;
    }
    const current = socket;
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
      if (parsed.success) deliver(parsed.data);
    };
    const onOpen = () => {
      reconnectDelay = 250;
      const queued = queuedReady.splice(0);
      if (queued.length === 0) sendReady(current);
      else for (const message of queued) current.send(message);
    };
    const onClose = () => {
      current.removeEventListener("message", onMessage as EventListener);
      current.removeEventListener("open", onOpen as EventListener);
      current.removeEventListener("close", onClose as EventListener);
      current.removeEventListener("error", onError as EventListener);
      if (stopped) return;
      deliver({
        protocolVersion: STUDIO_PROTOCOL_VERSION,
        type: "studio:hostState",
        host: "standalone",
        workspaceTrusted: true,
        connection: { status: "error", message: "Connection to the local Studio host was interrupted. Reconnecting…" }
      });
      scheduleReconnect();
    };
    const onError = () => current.close?.();
    current.addEventListener("message", onMessage as EventListener);
    current.addEventListener("open", onOpen as EventListener);
    current.addEventListener("close", onClose as EventListener);
    current.addEventListener("error", onError as EventListener, { once: true } as EventListenerOptions);
    if (isOpen(current)) onOpen();
  };
  openSocket();
  return {
    kind: "websocket",
    send(message) {
      const serialized = JSON.stringify(createStudioToHostMessage(message));
      if (isOpen(socket)) socket?.send(serialized);
      else if (message.type === "studio:ready" && queuedReady.length === 0) queuedReady.push(serialized);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      stopped = true;
      if (reconnectTimer !== undefined) globalThis.clearTimeout(reconnectTimer);
      socket?.close?.(1000, "Studio panel closed.");
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

/** In-page web host. W1 validates messages and does not call the network; W3 runs the controllers here. */
export function createWebTransport(): StudioTransport {
  return {
    kind: "web",
    send(message) {
      createStudioToHostMessage(message);
    },
    subscribe() {
      return () => undefined;
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

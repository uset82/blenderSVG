import { describe, expect, it, vi } from "vitest";
import { STUDIO_PROTOCOL_VERSION } from "@codex-avatar-studio/avatar-core";
import {
  createFixtureTransport,
  createReconnectingWebSocketTransport,
  createVsCodeTransport,
  createWebSocketTransport,
  OFFLINE_HOST_MESSAGE
} from "../src/bridge/studioTransports.js";

describe("studio transports", () => {
  it("names the offline fixture state", () => {
    expect(OFFLINE_HOST_MESSAGE).toBe("Offline preview – nothing is saved");
  });

  it("sends a versioned message through the VS Code transport", () => {
    const postMessage = vi.fn();
    const transport = createVsCodeTransport({ postMessage });
    transport.send({ type: "studio:ready" });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "studio:ready", protocolVersion: STUDIO_PROTOCOL_VERSION })
    );
  });

  it("drops an invalid host message on the fixture transport", () => {
    const transport = createFixtureTransport();
    const listener = vi.fn();
    transport.subscribe(listener);
    transport.deliver({ type: "not-a-studio-message" });
    expect(listener).not.toHaveBeenCalled();
    transport.deliver({
      protocolVersion: STUDIO_PROTOCOL_VERSION,
      type: "studio:hostState",
      host: "browser",
      workspaceTrusted: false,
      connection: { status: "disconnected", message: OFFLINE_HOST_MESSAGE }
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("sends JSON on the WebSocket transport and ignores a bad frame", () => {
    const listeners = new Set<(event: MessageEvent<unknown>) => void>();
    const socket = {
      send: vi.fn(),
      addEventListener: (_type: string, listener: EventListener) =>
        listeners.add(listener as (event: MessageEvent<unknown>) => void),
      removeEventListener: (_type: string, listener: EventListener) =>
        listeners.delete(listener as (event: MessageEvent<unknown>) => void)
    };
    const transport = createWebSocketTransport(socket);
    const listener = vi.fn();
    transport.subscribe(listener);
    transport.send({ type: "studio:ready" });
    expect(JSON.parse(String(socket.send.mock.calls[0]?.[0]))).toMatchObject({ type: "studio:ready" });
    for (const handler of listeners) handler({ data: "not-json" } as MessageEvent<unknown>);
    expect(listener).not.toHaveBeenCalled();
  });

  it("reconnects a WebSocket and sends studio:ready for a state resync", () => {
    const sockets: Array<{ send: ReturnType<typeof vi.fn>; emit: (type: string, data?: unknown) => void }> = [];
    const connect = () => {
      const handlers = new Map<string, Set<EventListener>>();
      const socket = {
        send: vi.fn(),
        addEventListener: (type: string, listener: EventListener) => {
          const set = handlers.get(type) ?? new Set<EventListener>();
          set.add(listener);
          handlers.set(type, set);
        },
        removeEventListener: (type: string, listener: EventListener) => handlers.get(type)?.delete(listener),
        emit(type: string, data?: unknown) {
          for (const handler of handlers.get(type) ?? []) handler({ data } as MessageEvent<unknown>);
        }
      };
      sockets.push(socket);
      return socket;
    };
    const transport = createReconnectingWebSocketTransport(connect);
    const listener = vi.fn();
    transport.subscribe(listener);
    sockets[0]?.emit("close");
    expect(JSON.parse(String(sockets[1]?.send.mock.calls[0]?.[0]))).toMatchObject({ type: "studio:ready" });
    sockets[1]?.emit(
      "message",
      JSON.stringify({
        protocolVersion: STUDIO_PROTOCOL_VERSION,
        type: "studio:hostState",
        host: "browser",
        workspaceTrusted: false,
        connection: { status: "disconnected", message: OFFLINE_HOST_MESSAGE }
      })
    );
    expect(listener).toHaveBeenCalledOnce();
    transport.close();
  });
});

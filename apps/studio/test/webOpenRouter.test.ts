import type { StudioToHostMessageInput } from "@codex-avatar-studio/avatar-core";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginWebOpenRouterConnect,
  completeWebOpenRouterConnect,
  disconnectWebOpenRouter
} from "../src/web/openRouterConnect.js";
import { createWebHostTransport } from "../src/web/webHostTransport.js";
import { createMemorySecretRecords, setRememberOpenRouterKey, WebSecretStore } from "../src/web/webSecretStore.js";

const secret = "sk-or-v1-browser-only-secret";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    dump() {
      return JSON.stringify(Object.fromEntries(values));
    }
  };
}

function catalogResponse() {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: "example/text",
          name: "Text",
          architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          description: "Fixture",
          context_length: 8000,
          pricing: { prompt: "0", completion: "0" },
          supported_parameters: ["max_tokens"]
        }
      ]
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("browser OpenRouter", () => {
  afterEach(() => {
    setRememberOpenRouterKey(true);
  });

  it("round-trips a remembered key as ciphertext and a session key only in memory", async () => {
    const records = createMemorySecretRecords();
    let remember = true;
    const store = new WebSecretStore(records, () => remember);
    await store.store(OPENROUTER_SECRET_KEY, secret);
    expect(await store.get(OPENROUTER_SECRET_KEY)).toBe(secret);
    const cipher = await records.readCipher();
    expect(cipher?.data.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(cipher?.data ?? new Uint8Array())).not.toContain(secret);
    remember = false;
    await store.store(OPENROUTER_SECRET_KEY, secret);
    expect(await records.readCipher()).toBeUndefined();
    expect(await store.get(OPENROUTER_SECRET_KEY)).toBe(secret);
    await store.delete(OPENROUTER_SECRET_KEY);
    expect(await store.get(OPENROUTER_SECRET_KEY)).toBeUndefined();
  });

  it("stores the exchanged key outside the address bar and session record", async () => {
    const storage = memoryStorage();
    let assigned = "";
    await beginWebOpenRouterConnect({
      remember: true,
      returnHash: "#/p/board",
      origin: "https://app.kurva.agency",
      storage,
      assign: (url) => {
        assigned = url;
      }
    });
    expect(assigned.startsWith("https://openrouter.ai/auth?")).toBe(true);
    expect(assigned).not.toContain(secret);
    const pending = JSON.parse(storage.dump()) as Record<string, string>;
    expect(Object.values(pending).join("")).not.toContain("sk-or-");
    const state = new URL(assigned).searchParams.get("callback_url");
    const callbackState = new URL(state ?? "").searchParams.get("state");
    const records = createMemorySecretRecords();
    const secrets = new WebSecretStore(records, () => true);
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ key: secret }), { status: 200 }));
    const done = await completeWebOpenRouterConnect({
      search: `?code=auth-code&state=${callbackState}`,
      storage,
      request,
      secrets,
      replaceUrl: (url) => {
        expect(url).not.toContain(secret);
        expect(url).not.toContain("code=");
      }
    });
    expect(done.returnHash).toBe("#/p/board");
    expect(await secrets.get(OPENROUTER_SECRET_KEY)).toBe(secret);
    expect(storage.dump()).not.toContain(secret);
    const links = await disconnectWebOpenRouter(secrets);
    expect(links?.settingsUrl).not.toContain(secret);
    expect(await secrets.get(OPENROUTER_SECRET_KEY)).toBeUndefined();
  });

  it("streams, cancels, and asks to reconnect through the web transport", async () => {
    const secrets: SecretStore = {
      get: async (name) => (name === OPENROUTER_SECRET_KEY ? secret : undefined),
      store: async () => undefined,
      delete: async () => undefined
    };
    const stream = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n', { status: 200 });
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce(stream)
      .mockResolvedValueOnce(new Response("revoked", { status: 401 }));
    const transport = createWebHostTransport({ secrets, request });
    const messages: Array<{ type: string; message?: string; delta?: string; host?: string }> = [];
    transport.subscribe((message) => messages.push(message));
    transport.send({ type: "studio:ready" });
    transport.send({ type: "studio:modelCatalogRequest" });
    await vi.waitFor(() => expect(messages.some((message) => message.type === "studio:modelCatalog")).toBe(true));
    const chat: StudioToHostMessageInput = {
      type: "studio:chatRequest",
      requestId: "chat-request-1",
      modelId: "example/text",
      history: [],
      userMessage: "Hello"
    };
    transport.send(chat);
    await vi.waitFor(() => expect(messages.some((message) => message.delta === "Hi")).toBe(true));
    transport.send({ type: "studio:chatCancel", requestId: "chat-request-1" });
    transport.send({
      type: "studio:chatRequest",
      requestId: "chat-request-2",
      modelId: "example/text",
      history: [],
      userMessage: "Again"
    });
    await vi.waitFor(() => expect(messages.some((message) => message.message?.includes("Reconnect"))).toBe(true));
    const chatCall = request.mock.calls.find((call) => String(call[0]).includes("/chat/completions"));
    expect(String(chatCall?.[0])).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(chatCall?.[1]?.headers).toMatchObject({ "X-Title": "Kurva", Authorization: `Bearer ${secret}` });
    expect(JSON.stringify(messages)).not.toContain(secret);
    expect(messages.some((message) => message.host === "web")).toBe(true);
  });
});

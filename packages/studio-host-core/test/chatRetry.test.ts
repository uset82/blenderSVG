import type { StudioToHostMessage } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it, vi } from "vitest";
import { OpenRouterChatController } from "../src/openRouterChat.js";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "../src/openRouterConnection.js";

type ChatRequest = Extract<StudioToHostMessage, { type: "studio:chatRequest" }>;

const secrets: SecretStore = {
  get: async (name) => (name === OPENROUTER_SECRET_KEY ? "sk-or-v1-test-regular-user-key" : undefined),
  store: async () => undefined,
  delete: async () => undefined
};

function catalog() {
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

describe("chat gateway", () => {
  it("retries a 429 and then accepts the stream", async () => {
    const stream = new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    });
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(stream);
    const messages: unknown[] = [];
    const controller = new OpenRouterChatController(secrets, (message) => messages.push(message), request);
    await controller.refreshModels();
    const chat: ChatRequest = {
      protocolVersion: 1,
      type: "studio:chatRequest",
      requestId: "request-1",
      modelId: "example/text",
      history: [],
      userMessage: "Hello"
    };
    await controller.send(chat);
    const chatCalls = request.mock.calls.filter((call) => String(call[0]).includes("/chat/completions"));
    expect(chatCalls).toHaveLength(2);
    const init = chatCalls[0]?.[1];
    expect(init?.headers).toMatchObject({
      "HTTP-Referer": "http://127.0.0.1",
      "X-Title": "Kurva Studio"
    });
    expect(String(init?.body)).toContain('"include":true');
    expect(messages.some((message) => (message as { type?: string }).type === "studio:chatComplete")).toBe(true);
  });

  it("does not send an image to a text-only model", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(catalog());
    const messages: Array<{ type?: string; message?: string }> = [];
    const controller = new OpenRouterChatController(secrets, (message) => messages.push(message), request);
    await controller.refreshModels();
    await controller.send({
      protocolVersion: 1,
      type: "studio:chatRequest",
      requestId: "request-2",
      modelId: "example/text",
      history: [],
      userMessage: "Look",
      attachment: { dataUrl: "data:image/png;base64,aaaa" }
    });
    expect(request.mock.calls.some((call) => String(call[0]).includes("/chat/completions"))).toBe(false);
    expect(messages.at(-1)?.message).toMatch(/image input/);
  });
});

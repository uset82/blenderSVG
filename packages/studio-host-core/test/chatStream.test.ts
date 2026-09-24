import type { StudioToHostMessage } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it, vi } from "vitest";
import { OpenRouterChatController } from "../src/openRouterChat.js";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "../src/openRouterConnection.js";

type ChatRequest = Extract<StudioToHostMessage, { type: "studio:chatRequest" }>;
type Emitted = {
  type?: string;
  code?: string;
  delta?: string;
  message?: string;
  models?: unknown[];
  ok?: boolean;
  requiresApproval?: boolean;
};

const secrets: SecretStore = {
  get: async (name) => (name === OPENROUTER_SECRET_KEY ? "sk-or-v1-test-regular-user-key" : undefined),
  store: async () => undefined,
  delete: async () => undefined
};

function catalog(next?: string) {
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
          supported_parameters: ["max_tokens", "tools"]
        }
      ],
      ...(next ? { next } : {})
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function chat(requestId: string, modelId = "example/text"): ChatRequest {
  return { protocolVersion: 1, type: "studio:chatRequest", requestId, modelId, history: [], userMessage: "Hello" };
}

function controller(request: typeof fetch) {
  const messages: Emitted[] = [];
  return { messages, chat: new OpenRouterChatController(secrets, (message) => messages.push(message), request) };
}

describe("chat stream and errors", () => {
  it("sends read tools for plan mode and no write tools", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((url) => {
      if (String(url).includes("/chat/completions")) {
        return Promise.resolve(
          new Response('data: {"choices":[{"delta":{"content":"Plan"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "example/text",
                name: "Text",
                architecture: { input_modalities: ["text"], output_modalities: ["text"] },
                description: "Fixture",
                context_length: 8000,
                pricing: { prompt: "0", completion: "0" },
                supported_parameters: ["max_tokens", "tools"]
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });
    const { chat: gateway } = controller(request);
    await gateway.refreshModels();
    await gateway.send({ ...chat("request-plan"), mode: "plan" });
    const body = String(request.mock.calls.find((call) => String(call[0]).includes("/chat/completions"))?.[1]?.body);
    expect(body).toContain("get_selection");
    expect(body).not.toContain("delete_shapes");
    expect(body).toContain('"tool_choice":"auto"');
  });

  it("waits for approval and canvas results, then continues with the selected model", async () => {
    const first =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"get_selection","arguments":"{}"}}]}}]}\n\ndata: [DONE]\n\n';
    const final = 'data: {"choices":[{"delta":{"content":"The selection is empty."}}]}\n\ndata: [DONE]\n\n';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(first, { status: 200 }))
      .mockResolvedValueOnce(new Response(final, { status: 200 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    const pending = gateway.send({ ...chat("request-tool"), mode: "plan" });
    await waitForType(messages, "studio:toolProposed");
    gateway.resolveToolPermission("request-tool", "call-1", true);
    await waitForType(messages, "studio:toolExecute");
    gateway.resolveToolExecutionResult("request-tool", "call-1", { ok: true, content: "No shapes are selected." });
    await pending;
    expect(messages.some((message) => message.type === "studio:toolProposed")).toBe(true);
    expect(messages.some((message) => message.type === "studio:toolExecute")).toBe(true);
    expect(messages.some((message) => message.type === "studio:toolResult" && message.ok === true)).toBe(true);
    expect(messages.some((message) => message.type === "studio:chatComplete")).toBe(true);
    const followup = String(request.mock.calls[2]?.[1]?.body);
    expect(followup).toContain('"role":"tool"');
    expect(followup).toContain("No shapes are selected.");
    expect(gateway.turn("request-tool")?.state).toBe("done");
  });

  it("returns a denial to the model without dispatching any canvas action", async () => {
    const first =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-delete","function":{"name":"delete_shapes","arguments":"{\\"shapeIds\\":[\\"shape:one\\"]}"}}]}}]}\n\ndata: [DONE]\n\n';
    const final = 'data: {"choices":[{"delta":{"content":"I left the canvas unchanged."}}]}\n\ndata: [DONE]\n\n';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(first, { status: 200 }))
      .mockResolvedValueOnce(new Response(final, { status: 200 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    const pending = gateway.send({ ...chat("request-deny"), mode: "build" });
    await waitForType(messages, "studio:toolProposed");
    gateway.resolveToolPermission("request-deny", "call-delete", false);
    await pending;
    expect(messages.some((message) => message.type === "studio:toolExecute")).toBe(false);
    expect(messages.some((message) => message.type === "studio:toolResult" && message.ok === false)).toBe(true);
    const followup = String(request.mock.calls[2]?.[1]?.body);
    expect(followup).toContain("declined this action");
  });

  it("cancels an agent that is waiting for tool approval", async () => {
    const first =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-read","function":{"name":"get_selection","arguments":"{}"}}]}}]}\n\ndata: [DONE]\n\n';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(first, { status: 200 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    const pending = gateway.send({ ...chat("request-cancel-tool"), mode: "plan" });
    await waitForType(messages, "studio:toolProposed");
    gateway.cancel("request-cancel-tool");
    await pending;
    expect(messages.some((message) => message.type === "studio:chatError" && message.code === "cancelled")).toBe(true);
    expect(gateway.turn("request-cancel-tool")?.state).toBe("error");
  });

  it("auto-applies canvas writes but still requests approval before canvas reads", async () => {
    const write =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-frame","function":{"name":"create_frame","arguments":"{\\"name\\":\\"Landing\\",\\"width\\":1440,\\"height\\":900}"}}]}}]}\n\ndata: [DONE]\n\n';
    const final = 'data: {"choices":[{"delta":{"content":"Frame created."}}]}\n\ndata: [DONE]\n\n';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(write, { status: 200 }))
      .mockResolvedValueOnce(new Response(final, { status: 200 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    const pending = gateway.send({ ...chat("request-auto"), mode: "auto" });
    await waitForType(messages, "studio:toolExecute");
    expect(messages.find((message) => message.type === "studio:toolProposed")?.requiresApproval).toBe(false);
    gateway.resolveToolExecutionResult("request-auto", "call-frame", { ok: true, content: "Created frame Landing." });
    await pending;
    expect(messages.some((message) => message.type === "studio:chatComplete")).toBe(true);

    const read =
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-read","function":{"name":"get_selection","arguments":"{}"}}]}}]}\n\ndata: [DONE]\n\n';
    const readRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(read, { status: 200 }));
    const readRun = controller(readRequest);
    await readRun.chat.refreshModels();
    const readPending = readRun.chat.send({ ...chat("request-auto-read"), mode: "auto" });
    await waitForType(readRun.messages, "studio:toolProposed");
    expect(readRun.messages.find((message) => message.type === "studio:toolProposed")?.requiresApproval).toBe(true);
    readRun.chat.cancel("request-auto-read");
    await readPending;
  });

  it("joins a split SSE line, ignores a keepalive comment, and stops at DONE", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(stream) {
        stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"He'));
        stream.enqueue(encoder.encode('llo"}}]}\n\n: keepalive\n\ndata: [DONE]\n\n'));
        stream.close();
      }
    });
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response(body, { status: 200 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    await gateway.send(chat("request-split"));
    expect(
      messages
        .filter((message) => message.type === "studio:chatDelta")
        .map((message) => message.delta)
        .join("")
    ).toBe("Hello");
    expect(messages.some((message) => message.type === "studio:chatComplete")).toBe(true);
    expect(gateway.turn("request-split")?.state).toBe("done");
    expect(gateway.turn("request-split")?.text).toBe("Hello");
  });

  it("reports a mid-stream error, an empty reply, and a malformed event", async () => {
    const cases = [
      ['data: {"error":{"message":"no"}}\n\n', "interrupted"],
      ['data: {"choices":[{"delta":{}}]}\n\ndata: [DONE]\n\n', "empty reply"],
      ["data: {\n\n", "interrupted"]
    ] as const;
    for (const [body, expected] of cases) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(catalog())
        .mockResolvedValueOnce(new Response(body, { status: 200 }));
      const { messages, chat: gateway } = controller(request);
      await gateway.refreshModels();
      await gateway.send(chat(`request-${expected}`));
      expect(messages.at(-1)?.message ?? "").toMatch(new RegExp(expected, "i"));
    }
  });

  it("maps 401, 402, and a repeated 500", async () => {
    const statuses: Array<[number, string]> = [
      [401, "rejected the saved key"],
      [402, "credits"]
    ];
    for (const [status, expected] of statuses) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(catalog())
        .mockResolvedValueOnce(new Response("no", { status }));
      const { messages, chat: gateway } = controller(request);
      await gateway.refreshModels();
      await gateway.send(chat(`request-${status}`));
      expect(messages.at(-1)?.message ?? "").toMatch(new RegExp(expected, "i"));
    }
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response("down", { status: 500 }))
      .mockResolvedValueOnce(new Response("down", { status: 500 }))
      .mockResolvedValueOnce(new Response("down", { status: 500 }));
    const { messages, chat: gateway } = controller(request);
    await gateway.refreshModels();
    await gateway.send(chat("request-500"));
    expect(messages.at(-1)?.message).toContain("HTTP 500");
    expect(request.mock.calls.filter((call) => String(call[0]).includes("/chat/completions"))).toHaveLength(3);
  });

  it("reports offline, an unavailable model, and cancel", async () => {
    const offline = vi.fn<typeof fetch>().mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error("offline"));
    const offlineRun = controller(offline);
    await offlineRun.chat.refreshModels();
    await offlineRun.chat.send(chat("request-offline"));
    expect(offlineRun.messages.at(-1)?.code).toBe("offline");

    const missing = vi.fn<typeof fetch>().mockResolvedValue(catalog());
    const missingRun = controller(missing);
    await missingRun.chat.refreshModels();
    await missingRun.chat.send(chat("request-missing", "missing/model"));
    expect(missingRun.messages.at(-1)?.code).toBe("model-unavailable");

    const hanging = vi.fn<typeof fetch>().mockImplementation((url, init) => {
      if (String(url).includes("/chat/completions")) {
        const signal = init?.signal;
        if (signal?.aborted) return Promise.reject(new Error("aborted"));
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      }
      return Promise.resolve(catalog());
    });
    const cancelRun = controller(hanging);
    await cancelRun.chat.refreshModels();
    const pending = cancelRun.chat.send(chat("request-cancel"));
    await Promise.resolve();
    cancelRun.chat.cancel("request-cancel");
    await pending;
    expect(cancelRun.messages.at(-1)?.code).toBe("cancelled");
  });

  it("follows a catalog next page", async () => {
    const second = new Response(
      JSON.stringify({
        data: [
          {
            id: "example/next",
            name: "Next",
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            description: "Fixture",
            context_length: 8000,
            pricing: { prompt: "0", completion: "0" },
            supported_parameters: []
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog("https://openrouter.ai/api/v1/models?output_modalities=all&page=2"))
      .mockResolvedValueOnce(second);
    const { messages, chat: gateway } = controller(request);
    const catalogMessage = await gateway.refreshModels();
    expect(catalogMessage.models?.map((model) => (model as { id: string }).id)).toEqual([
      "example/text",
      "example/next"
    ]);
    expect(messages).toEqual([]);
  });
});

async function waitForType(messages: Emitted[], type: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (messages.some((message) => message.type === type)) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${type}.`);
}

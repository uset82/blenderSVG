import { describe, expect, it, vi } from "vitest";
import { createStudioToHostMessage } from "@codex-avatar-studio/avatar-core";
import { OpenRouterChatController } from "../src/openRouterChat.js";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "../src/openRouterConnection.js";

const PRIVATE_API_KEY = "sk-or-v1-test-regular-user-key";

function createSecrets(): SecretStore {
  return {
    get: async (name) => (name === OPENROUTER_SECRET_KEY ? PRIVATE_API_KEY : undefined),
    store: async () => undefined,
    delete: async () => undefined
  };
}

function model(id: string, input: string[], output: string[]) {
  return {
    id,
    name: id.split("/").at(-1),
    architecture: {
      modality: `${input.join("+")}->${output.join("+")}`,
      input_modalities: input,
      output_modalities: output
    },
    description: "Model fixture",
    context_length: 64_000,
    pricing: { prompt: "0.000001", completion: "0.000002" },
    supported_parameters: ["max_tokens"]
  };
}

describe("OpenRouter model catalog", () => {
  it("falls back to the public full catalog when account-filtered access is forbidden", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Management key required" } }), { status: 403 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [model("openai/text-model", ["text"], ["text"]), model("example/image-model", ["text"], ["image"])],
            total_count: 2
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const controller = new OpenRouterChatController(createSecrets(), () => undefined, request);

    const catalog = await controller.refreshModels();

    expect(catalog.status).toBe("ready");
    expect(catalog.message).toContain("public OpenRouter models");
    expect(catalog.message).toContain("Account-specific provider preferences could not be read");
    expect(catalog.models.map((entry) => entry.id)).toEqual(["openai/text-model", "example/image-model"]);
    expect(catalog.models[0]?.textChatEligible).toBe(true);
    expect(catalog.models[1]?.textChatEligible).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/models/user?output_modalities=all");
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: `Bearer ${PRIVATE_API_KEY}`,
      Accept: "application/json"
    });
    expect(request.mock.calls[1]?.[0]).toBe("https://openrouter.ai/api/v1/models?output_modalities=all");
    expect(request.mock.calls[1]?.[1]?.headers).toEqual({ Accept: "application/json" });
    expect(JSON.stringify(catalog)).not.toContain(PRIVATE_API_KEY);
  });

  it("keeps account-filtered availability when the user's endpoint succeeds", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [model("anthropic/account-model", ["text", "image"], ["text"])]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const controller = new OpenRouterChatController(createSecrets(), () => undefined, request);

    const catalog = await controller.refreshModels();

    expect(catalog.status).toBe("ready");
    expect(catalog.message).toContain("account-available models");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not hide an invalid key behind the public catalog fallback", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 }));
    const controller = new OpenRouterChatController(createSecrets(), () => undefined, request);

    const catalog = await controller.refreshModels();

    expect(catalog.status).toBe("error");
    expect(catalog.message).toContain("rejected the saved key");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("sends a reviewed local screenshot as a base64 image part to the chosen vision model", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [model("openai/vision-model", ["text", "image"], ["text"])] }), {
        status: 200
      })
    ).mockResolvedValueOnce(
      new Response('data: {"choices":[{"delta":{"content":"I can see the screenshot."}}]}\n\ndata: [DONE]\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      })
    );
    const emitted: unknown[] = [];
    const controller = new OpenRouterChatController(createSecrets(), (message) => emitted.push(message), request);
    await controller.refreshModels();
    const chat = createStudioToHostMessage({
      type: "studio:chatRequest",
      requestId: "chat-vision1",
      modelId: "openai/vision-model",
      history: [],
      userMessage: "Recreate this screenshot.",
      attachment: { dataUrl: "data:image/png;base64,iVBORw0KGgo=" }
    });

    await controller.send(chat);

    const body = JSON.parse(String(request.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Recreate this screenshot." },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } }
      ]
    });
    expect(emitted).toContainEqual(expect.objectContaining({ type: "studio:chatComplete", requestId: "chat-vision1" }));
    expect(String(request.mock.calls[1]?.[1]?.body)).not.toContain(PRIVATE_API_KEY);
  });

  it("rejects screenshot sends to models without image input", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [model("openai/text-model", ["text"], ["text"])] }), { status: 200 })
    );
    const emitted: unknown[] = [];
    const controller = new OpenRouterChatController(createSecrets(), (message) => emitted.push(message), request);
    await controller.refreshModels();
    const chat = createStudioToHostMessage({
      type: "studio:chatRequest",
      requestId: "chat-image1",
      modelId: "openai/text-model",
      history: [],
      userMessage: "Describe this image.",
      attachment: { dataUrl: "data:image/png;base64,iVBORw0KGgo=" }
    });

    await controller.send(chat);

    expect(request).toHaveBeenCalledTimes(1);
    expect(emitted).toContainEqual(expect.objectContaining({ type: "studio:chatError", code: "invalid-request" }));
  });
});

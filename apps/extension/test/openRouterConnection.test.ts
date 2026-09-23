import { describe, expect, it, vi } from "vitest";
import {
  OPENROUTER_SECRET_KEY,
  OpenRouterConnectionController,
  type PasswordPrompt,
  type SecretStore
} from "../src/openRouterConnection.js";

function fixture(key?: string) {
  const values = new Map<string, string>();
  if (key) values.set(OPENROUTER_SECRET_KEY, key);
  const secrets: SecretStore = {
    get: vi.fn(async (name) => values.get(name)),
    store: vi.fn(async (name, value) => {
      values.set(name, value);
    }),
    delete: vi.fn(async (name) => {
      values.delete(name);
    })
  };
  const prompt = vi.fn<PasswordPrompt>(async () => undefined);
  const emitted: unknown[] = [];
  return { values, secrets, prompt, emitted };
}

describe("OpenRouter secret connection", () => {
  it("validates a native password entry, stores it only after success, and never emits the key", async () => {
    const state = fixture();
    const key = "sk-or-v1-user-private-credential";
    state.prompt.mockResolvedValue(key);
    const request = vi.fn<typeof fetch>(async (_url, options) => {
      expect(state.values.has(OPENROUTER_SECRET_KEY)).toBe(false);
      expect(options?.headers).toEqual({ Authorization: `Bearer ${key}`, Accept: "application/json" });
      return new Response(null, { status: 200 });
    });
    const controller = new OpenRouterConnectionController(
      state.secrets,
      state.prompt,
      (value) => state.emitted.push(value),
      request
    );

    const result = await controller.run("connect");

    expect(state.prompt).toHaveBeenCalledWith(expect.objectContaining({ password: true, ignoreFocusOut: true }));
    expect(request).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", expect.any(Object));
    expect(state.values.get(OPENROUTER_SECRET_KEY)).toBe(key);
    expect(result.status).toBe("connected");
    expect(JSON.stringify([...state.emitted, result])).not.toContain(key);
  });

  it("preserves the previous key if replacement is rejected", async () => {
    const original = "sk-or-v1-original-private-key";
    const state = fixture(original);
    state.prompt.mockResolvedValue("sk-or-v1-invalid-replacement");
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    const controller = new OpenRouterConnectionController(state.secrets, state.prompt, () => undefined, request);

    expect((await controller.run("replace")).status).toBe("error");
    expect(state.values.get(OPENROUTER_SECRET_KEY)).toBe(original);
    expect(state.secrets.store).not.toHaveBeenCalled();
  });

  it("rejects management keys because they cannot call OpenRouter chat", async () => {
    const state = fixture();
    state.prompt.mockResolvedValue("sk-or-v1-management-key-value");
    const request = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ data: { is_management_key: true } }), { status: 200 })
    );
    const controller = new OpenRouterConnectionController(state.secrets, state.prompt, () => undefined, request);

    const result = await controller.run("connect");

    expect(result.status).toBe("error");
    expect(result.message).toContain("regular API key");
    expect(state.secrets.store).not.toHaveBeenCalled();
  });

  it("shows only a masked key label and safe usage limits", async () => {
    const state = fixture();
    const key = "sk-or-v1-user-private-credential";
    state.prompt.mockResolvedValue(key);
    const request = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              is_management_key: false,
              label: key,
              limit: 20,
              limit_remaining: 12.5,
              usage: 7.5
            }
          }),
          { status: 200 }
        )
    );
    const controller = new OpenRouterConnectionController(state.secrets, state.prompt, () => undefined, request);

    const result = await controller.run("connect");

    expect(result.status).toBe("connected");
    expect(result.message).toContain("$12.5 remaining");
    expect(result.message).toContain("$20 key limit");
    expect(result.message).toContain("$7.5 used");
    expect(result.message).not.toContain(key);
  });

  it("tests a saved key and disconnects without returning provider details", async () => {
    const state = fixture("sk-or-v1-saved-private-key");
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 429 }));
    const controller = new OpenRouterConnectionController(state.secrets, state.prompt, () => undefined, request);

    expect((await controller.run("test")).message).toContain("rate limiting");
    expect((await controller.run("disconnect")).status).toBe("disconnected");
    expect(state.values.size).toBe(0);
  });
});

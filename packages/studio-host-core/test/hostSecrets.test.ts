import { describe, expect, it } from "vitest";
import { resolveOpenRouterSecret, saveOpenRouterSecret, type SecretKeyring } from "../src/hostSecrets.js";

function memoryKeyring(initial: string | null = null): SecretKeyring & { value: string | null } {
  return {
    value: initial,
    async get() {
      return this.value;
    },
    async set(value: string) {
      this.value = value;
    }
  };
}

describe("host secrets", () => {
  it("uses the keychain first and the environment only as a fallback", async () => {
    const keyring = memoryKeyring("stored-key");
    await expect(resolveOpenRouterSecret(keyring, { OPENROUTER_API_KEY: "env-key" })).resolves.toEqual({
      configured: true,
      source: "keychain"
    });
    await expect(resolveOpenRouterSecret(memoryKeyring(null), { OPENROUTER_API_KEY: "env-key" })).resolves.toEqual({
      configured: true,
      source: "environment"
    });
    await expect(resolveOpenRouterSecret(memoryKeyring(null), {})).resolves.toEqual({
      configured: false,
      source: "none"
    });
  });

  it("stores a key and returns only a masked status", async () => {
    const keyring = memoryKeyring();
    const status = await saveOpenRouterSecret(keyring, "  new-key  ");
    expect(status).toEqual({ configured: true, source: "keychain" });
    expect(JSON.stringify(status)).not.toContain("new-key");
    expect(keyring.value).toBe("new-key");
  });
});

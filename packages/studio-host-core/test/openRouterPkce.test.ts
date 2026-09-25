import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertPkceState,
  buildOpenRouterAuthUrl,
  clearPkcePending,
  createCodeChallenge,
  exchangeOpenRouterCode,
  openRouterKeyLinks,
  PKCE_SESSION_KEY,
  readPkcePending,
  sha256Hex,
  writePkcePending
} from "../src/openRouterPkce.js";

describe("OpenRouter PKCE", () => {
  it("matches the RFC 7636 S256 test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    await expect(createCodeChallenge(verifier)).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("rejects a state mismatch and leaves no pending record", () => {
    const storage = memoryStorage();
    writePkcePending(storage, {
      verifier: "verifier-value-0123456789",
      state: "expected-state",
      returnHash: "#/p/one",
      remember: true
    });
    expect(() => assertPkceState("expected-state", "other-state")).toThrow(/did not match/);
    clearPkcePending(storage);
    expect(readPkcePending(storage)).toBeNull();
    expect(storage.getItem(PKCE_SESSION_KEY)).toBeNull();
  });

  it("exchanges a code and keeps the key out of the PKCE session record", async () => {
    const storage = memoryStorage();
    const pending = {
      verifier: "verifier-value-0123456789",
      state: "expected-state",
      returnHash: "#/p/one",
      remember: false
    };
    writePkcePending(storage, pending);
    assertPkceState(pending.state, "expected-state");
    const secret = "sk-or-v1-browser-only-secret";
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ key: secret }), { status: 200 }));
    const key = await exchangeOpenRouterCode({ code: "auth-code", verifier: pending.verifier, request });
    expect(key).toBe(secret);
    expect(storage.getItem(PKCE_SESSION_KEY)).not.toContain(secret);
    const body = String(request.mock.calls[0]?.[1]?.body);
    expect(body).toContain("code_challenge_method");
    expect(body).not.toContain(secret);
    clearPkcePending(storage);
    expect(JSON.stringify(storage.dump())).not.toContain(secret);
  });

  it("maps exchange failures and builds the authorize URL", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("expired code", { status: 403 }));
    await expect(
      exchangeOpenRouterCode({ code: "old", verifier: "verifier-value-0123456789", request })
    ).rejects.toThrow(/expired/);
    const url = new URL(
      buildOpenRouterAuthUrl({
        callbackUrl: "https://app.kurva.agency/oauth/openrouter",
        challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        keyLabel: "Kurva web"
      })
    );
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("callback_url")).toBe("https://app.kurva.agency/oauth/openrouter");
    expect(url.search).not.toContain("sk-or-");
  });

  it("hashes a known string and links only the hash", async () => {
    await expect(sha256Hex("abc")).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const links = await openRouterKeyLinks("sk-or-v1-browser-only-secret");
    expect(links.settingsUrl.startsWith("https://openrouter.ai/keys/")).toBe(true);
    expect(links.activityUrl).toContain("api_key_hash=");
    expect(links.settingsUrl).not.toContain("sk-or-");
    expect(links.activityUrl).not.toContain("sk-or-");
  });

  it("keeps the browser OpenRouter modules free of node imports", () => {
    const sources = [
      new URL("../src/openRouterPkce.ts", import.meta.url),
      new URL("../src/openRouterChat.ts", import.meta.url),
      new URL("../src/openRouterConnection.ts", import.meta.url)
    ];
    for (const source of sources) {
      expect(readFileSync(source, "utf8")).not.toMatch(/from ["']node:/);
    }
  });
});

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
      return Object.fromEntries(values);
    }
  };
}

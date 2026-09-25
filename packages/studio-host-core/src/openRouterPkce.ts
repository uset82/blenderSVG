/** Browser-safe OpenRouter PKCE. This module has no node: imports and never stores an API key. */

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_KEY_EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_CALLBACK_PATH = "/oauth/openrouter";
export const PKCE_SESSION_KEY = "kurva-openrouter-pkce";
export const PKCE_VERIFIER_BYTES = 32;

export interface PkcePending {
  verifier: string;
  state: string;
  returnHash: string;
  remember: boolean;
}

export interface PkceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function createCodeChallenge(
  verifier: string,
  digest: (data: Uint8Array) => Promise<ArrayBuffer> = (data) => crypto.subtle.digest("SHA-256", data)
): Promise<string> {
  const hash = new Uint8Array(await digest(new TextEncoder().encode(verifier)));
  return base64UrlEncode(hash);
}

export function createPkceMaterial(randomBytes: (size: number) => Uint8Array = cryptoRandomBytes): {
  verifier: string;
  state: string;
} {
  return {
    verifier: base64UrlEncode(randomBytes(PKCE_VERIFIER_BYTES)),
    state: base64UrlEncode(randomBytes(PKCE_VERIFIER_BYTES))
  };
}

export function buildOpenRouterAuthUrl(input: { callbackUrl: string; challenge: string; keyLabel: string }): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", input.callbackUrl);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("key_label", input.keyLabel);
  return url.toString();
}

export function writePkcePending(storage: PkceStorage, pending: PkcePending): void {
  storage.setItem(PKCE_SESSION_KEY, JSON.stringify(pending));
}

export function readPkcePending(storage: PkceStorage): PkcePending | null {
  const raw = storage.getItem(PKCE_SESSION_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Partial<PkcePending>;
  if (
    typeof record.verifier !== "string" ||
    typeof record.state !== "string" ||
    typeof record.returnHash !== "string"
  ) {
    return null;
  }
  return {
    verifier: record.verifier,
    state: record.state,
    returnHash: record.returnHash.startsWith("#") ? record.returnHash : "#/",
    remember: record.remember === true
  };
}

export function clearPkcePending(storage: PkceStorage): void {
  storage.removeItem(PKCE_SESSION_KEY);
}

export function assertPkceState(expected: string, actual: string | null): void {
  if (!actual || actual !== expected) {
    throw new Error("The OpenRouter return did not match this browser session.");
  }
}

export function openRouterExchangeError(status: number, body: string): string {
  if (status === 400) return "OpenRouter rejected the code challenge method. Start the connection again.";
  if (status === 403 && /expired/i.test(body)) {
    return "The OpenRouter authorization code expired. Start the connection again.";
  }
  if (status === 403) return "OpenRouter rejected the authorization code. Start the connection again.";
  if (status === 405) return "OpenRouter refused the key exchange method.";
  return `OpenRouter could not finish the connection (HTTP ${status}).`;
}

export async function exchangeOpenRouterCode(input: {
  code: string;
  verifier: string;
  request?: typeof fetch;
}): Promise<string> {
  const request = input.request ?? fetch;
  const response = await request(OPENROUTER_KEY_EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code: input.code,
      code_verifier: input.verifier,
      code_challenge_method: "S256"
    })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(openRouterExchangeError(response.status, body));
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("OpenRouter did not return a key.");
  }
  const key = parsed && typeof parsed === "object" ? (parsed as { key?: unknown }).key : undefined;
  if (typeof key !== "string" || key.trim().length < 16) throw new Error("OpenRouter did not return a key.");
  return key.trim();
}

export async function sha256Hex(
  value: string,
  digest: (data: Uint8Array) => Promise<ArrayBuffer> = (data) => crypto.subtle.digest("SHA-256", data)
): Promise<string> {
  const hash = new Uint8Array(await digest(new TextEncoder().encode(value)));
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function openRouterKeyLinks(key: string): Promise<{ settingsUrl: string; activityUrl: string }> {
  const hash = await sha256Hex(key);
  return {
    settingsUrl: `https://openrouter.ai/keys/${hash}`,
    activityUrl: `https://openrouter.ai/logs?api_key_hash=${hash}`
  };
}

function cryptoRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export interface SecretKeyring {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

export interface SecretStatus {
  configured: boolean;
  source: "keychain" | "environment" | "none";
}

/** Status for the browser. The secret itself is never included. */
export function secretStatus(secret: string | null, source: SecretStatus["source"]): SecretStatus {
  if (!secret) return { configured: false, source: "none" };
  return { configured: true, source };
}

export async function resolveOpenRouterSecret(
  keyring: SecretKeyring,
  env: NodeJS.ProcessEnv = process.env
): Promise<SecretStatus> {
  const stored = await keyring.get();
  if (stored && stored.trim()) return secretStatus(stored, "keychain");
  const fromEnv = env.OPENROUTER_API_KEY?.trim();
  if (fromEnv) return secretStatus(fromEnv, "environment");
  return secretStatus(null, "none");
}

export async function saveOpenRouterSecret(keyring: SecretKeyring, value: string): Promise<SecretStatus> {
  const key = value.trim();
  if (!key) throw new Error("The OpenRouter key was empty.");
  await keyring.set(key);
  return { configured: true, source: "keychain" };
}

export async function openSystemKeyring(account = "openrouter"): Promise<SecretKeyring> {
  const loaded = (await import("@napi-rs/keyring")) as {
    Entry: new (service: string, account: string) => { getPassword(): string | null; setPassword(value: string): void };
  };
  return napiKeyring(new loaded.Entry("blenderSVG Studio", account));
}

export function napiKeyring(entry: { getPassword(): string | null; setPassword(value: string): void }): SecretKeyring {
  return {
    async get() {
      return entry.getPassword();
    },
    async set(value) {
      entry.setPassword(value);
    }
  };
}

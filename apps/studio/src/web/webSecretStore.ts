import { OPENROUTER_SECRET_KEY, type SecretStore } from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import { openKurvaLibrary } from "./browserLibrary.js";

const CRYPTO_KEY = "openrouter-crypto-key";
const CIPHER_KEY = "openrouter-cipher";

export interface SecretCipher {
  iv: Uint8Array;
  data: Uint8Array;
}

export interface SecretRecordStore {
  readCryptoKey(): Promise<CryptoKey | undefined>;
  writeCryptoKey(key: CryptoKey): Promise<void>;
  readCipher(): Promise<SecretCipher | undefined>;
  writeCipher(cipher: SecretCipher): Promise<void>;
  clear(): Promise<void>;
}

export function createMemorySecretRecords(): SecretRecordStore {
  let cryptoKey: CryptoKey | undefined;
  let cipher: SecretCipher | undefined;
  return {
    async readCryptoKey() {
      return cryptoKey;
    },
    async writeCryptoKey(key) {
      cryptoKey = key;
    },
    async readCipher() {
      return cipher;
    },
    async writeCipher(next) {
      cipher = next;
    },
    async clear() {
      cryptoKey = undefined;
      cipher = undefined;
    }
  };
}

export class WebSecretStore implements SecretStore {
  private sessionKey: string | undefined;

  public constructor(
    private readonly records: SecretRecordStore,
    private readonly remember: () => boolean
  ) {}

  public async get(name: string): Promise<string | undefined> {
    if (name !== OPENROUTER_SECRET_KEY) return undefined;
    if (!this.remember()) return this.sessionKey;
    const [key, cipher] = await Promise.all([this.records.readCryptoKey(), this.records.readCipher()]);
    if (!key || !cipher) return undefined;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: cipher.iv as BufferSource },
      key,
      cipher.data as BufferSource
    );
    return new TextDecoder().decode(plain);
  }

  public async store(name: string, value: string): Promise<void> {
    if (name !== OPENROUTER_SECRET_KEY) return;
    if (!this.remember()) {
      this.sessionKey = value;
      await this.records.clear();
      return;
    }
    this.sessionKey = undefined;
    let key = await this.records.readCryptoKey();
    if (!key) {
      key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await this.records.writeCryptoKey(key);
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value))
    );
    await this.records.writeCipher({ iv, data });
  }

  public async delete(name: string): Promise<void> {
    if (name !== OPENROUTER_SECRET_KEY) return;
    this.sessionKey = undefined;
    await this.records.clear();
  }
}

export function createIndexedDbSecretRecords(): SecretRecordStore {
  return {
    async readCryptoKey() {
      return readMeta<CryptoKey>(CRYPTO_KEY);
    },
    async writeCryptoKey(key) {
      await writeMeta(CRYPTO_KEY, key);
    },
    async readCipher() {
      const stored = await readMeta<{ iv: ArrayBuffer; data: ArrayBuffer }>(CIPHER_KEY);
      if (!stored) return undefined;
      return { iv: new Uint8Array(stored.iv), data: new Uint8Array(stored.data) };
    },
    async writeCipher(cipher) {
      await writeMeta(CIPHER_KEY, {
        iv: cipher.iv.buffer.slice(cipher.iv.byteOffset, cipher.iv.byteOffset + cipher.iv.byteLength),
        data: cipher.data.buffer.slice(cipher.data.byteOffset, cipher.data.byteOffset + cipher.data.byteLength)
      });
    },
    async clear() {
      const database = await openKurvaLibrary();
      const transaction = database.transaction("meta", "readwrite");
      transaction.objectStore("meta").delete(CRYPTO_KEY);
      transaction.objectStore("meta").delete(CIPHER_KEY);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
  };
}

let rememberOnDevice = true;

export function setRememberOpenRouterKey(remember: boolean): void {
  rememberOnDevice = remember;
}

export function rememberOpenRouterKey(): boolean {
  return rememberOnDevice;
}

let browserStore: WebSecretStore | null = null;

export function browserOpenRouterSecretStore(): WebSecretStore {
  if (!browserStore) browserStore = new WebSecretStore(createIndexedDbSecretRecords(), rememberOpenRouterKey);
  return browserStore;
}

async function readMeta<T>(key: string): Promise<T | undefined> {
  const database = await openKurvaLibrary();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction("meta").objectStore("meta").get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
  return value;
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const database = await openKurvaLibrary();
  const transaction = database.transaction("meta", "readwrite");
  transaction.objectStore("meta").put(value, key);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

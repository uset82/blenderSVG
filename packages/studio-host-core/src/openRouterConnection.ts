import type { HostToStudioMessage } from "@codex-avatar-studio/avatar-core";

type Thenable<T> = PromiseLike<T>;

export const OPENROUTER_SECRET_KEY = "codexAvatar.openRouterApiKey";
const KEY_ENDPOINT = "https://openrouter.ai/api/v1/key";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_KEY_RESPONSE_BYTES = 16_384;

export type OpenRouterConnectionState = Extract<HostToStudioMessage, { type: "studio:hostState" }>["connection"];
export type OpenRouterConnectionAction = "connect" | "replace" | "test" | "disconnect";

export interface SecretStore {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
}

export type PasswordPrompt = (options: {
  title: string;
  prompt: string;
  password: true;
  ignoreFocusOut: true;
  validateInput: (value: string) => string | undefined;
}) => Thenable<string | undefined>;

/** The only owner of the OpenRouter credential in the extension. */
export class OpenRouterConnectionController {
  private busy = false;
  private abortController: AbortController | undefined;

  public constructor(
    private readonly secrets: SecretStore,
    private readonly prompt: PasswordPrompt,
    private readonly emit: (state: OpenRouterConnectionState) => void,
    private readonly request: typeof fetch = fetch,
    private readonly storageLabel = "VS Code secret storage"
  ) {}

  public async currentState(): Promise<OpenRouterConnectionState> {
    try {
      const key = await this.secrets.get(OPENROUTER_SECRET_KEY);
      return key
        ? {
            status: "connected",
            message: `An OpenRouter key is saved in ${this.storageLabel}. Test to verify it is still valid.`
          }
        : { status: "disconnected", message: "Connect your own OpenRouter key to use text chat." };
    } catch {
      return { status: "error", message: `The host could not read ${this.storageLabel}.` };
    }
  }

  public async run(action: OpenRouterConnectionAction): Promise<OpenRouterConnectionState> {
    if (this.busy) return { status: "checking", message: "An OpenRouter connection action is already running." };
    this.busy = true;
    try {
      if (action === "disconnect") {
        await this.secrets.delete(OPENROUTER_SECRET_KEY);
        return { status: "disconnected", message: `OpenRouter key removed from ${this.storageLabel}.` };
      }

      if (action === "test") {
        const key = await this.secrets.get(OPENROUTER_SECRET_KEY);
        if (!key) return { status: "disconnected", message: "Connect an OpenRouter key before testing it." };
        this.emit({ status: "checking", message: "Checking the saved OpenRouter key." });
        return await this.validate(key);
      }

      const input = await this.prompt({
        title: action === "replace" ? "Replace OpenRouter API Key" : "Connect OpenRouter API Key",
        prompt: `The key stays in ${this.storageLabel}. Text you choose to send to OpenRouter leaves this device.`,
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) =>
          validKey(value) ? undefined : "Enter an API key of 16–512 characters without spaces."
      });
      if (input === undefined) return await this.currentState();
      const key = input.trim();
      if (!validKey(key)) return { status: "error", message: "The entered OpenRouter key is not valid." };

      this.emit({ status: "checking", message: "Checking the entered OpenRouter key." });
      const checked = await this.validate(key);
      if (checked.status !== "connected") return checked;
      await this.secrets.store(OPENROUTER_SECRET_KEY, key);
      return { status: "connected", message: `${checked.message} Saved in ${this.storageLabel}.` };
    } catch {
      return { status: "error", message: "The host could not complete the OpenRouter connection action." };
    } finally {
      this.busy = false;
      this.abortController = undefined;
    }
  }

  public dispose(): void {
    this.abortController?.abort();
  }

  private async validate(key: string): Promise<OpenRouterConnectionState> {
    const controller = new AbortController();
    this.abortController = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.request(KEY_ENDPOINT, {
        method: "GET",
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        redirect: "error",
        signal: controller.signal
      });
      if (response.ok) {
        let metadata: OpenRouterKeyMetadata | undefined;
        try {
          metadata = await readKeyMetadata(response);
        } catch {
          return { status: "error", message: "OpenRouter returned unreadable key details. The key was not saved." };
        }
        if (metadata?.isManagementKey) {
          return {
            status: "error",
            message:
              "This is an OpenRouter management key. Management keys cannot send chat requests; enter a regular API key."
          };
        }
        return { status: "connected", message: formatKeySummary(metadata) };
      }
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        return { status: "error", message: "OpenRouter rejected the key. Check it and try again." };
      if (response.status === 429)
        return { status: "error", message: "OpenRouter is rate limiting key checks. Try again later." };
      return { status: "error", message: `OpenRouter key check failed (HTTP ${response.status}).` };
    } catch {
      return controller.signal.aborted
        ? { status: "error", message: "OpenRouter key check timed out or was canceled." }
        : { status: "error", message: "Could not reach OpenRouter to verify the key." };
    } finally {
      clearTimeout(timeout);
      if (this.abortController === controller) this.abortController = undefined;
    }
  }
}

function validKey(value: string): boolean {
  const key = value.trim();
  return key.length >= 16 && key.length <= 512 && !/\s/.test(key);
}

interface OpenRouterKeyMetadata {
  isManagementKey: boolean;
  label?: string;
  limit?: number;
  limitRemaining?: number;
  usage?: number;
}

async function readKeyMetadata(response: Response): Promise<OpenRouterKeyMetadata | undefined> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_KEY_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Key details exceeded the response size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let payload: unknown;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("OpenRouter key details were not valid JSON.");
  }

  if (!isRecord(payload) || !isRecord(payload.data)) return undefined;
  const label = typeof payload.data.label === "string" ? maskKeyLabel(payload.data.label) : undefined;
  const limit = safeAmount(payload.data.limit);
  const limitRemaining = safeAmount(payload.data.limit_remaining);
  const usage = safeAmount(payload.data.usage);
  return {
    isManagementKey: payload.data.is_management_key === true,
    ...(label !== undefined ? { label } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(limitRemaining !== undefined ? { limitRemaining } : {}),
    ...(usage !== undefined ? { usage } : {})
  };
}

function formatKeySummary(metadata?: OpenRouterKeyMetadata): string {
  if (!metadata) return "OpenRouter key verified.";
  const details = [
    metadata.label,
    metadata.limitRemaining !== undefined ? `${formatAmount(metadata.limitRemaining)} remaining` : undefined,
    metadata.limit !== undefined ? `${formatAmount(metadata.limit)} key limit` : undefined,
    metadata.usage !== undefined ? `${formatAmount(metadata.usage)} used` : undefined
  ].filter((value): value is string => Boolean(value));
  return details.length ? `OpenRouter key verified · ${details.join(" · ")}.` : "OpenRouter key verified.";
}

function maskKeyLabel(value: string): string | undefined {
  const label = value.trim().slice(0, 80);
  if (!label) return undefined;
  if (/sk-or-/iu.test(label) || label.length > 32) {
    return `${label.slice(0, 8)}…${label.slice(-4)}`;
  }
  return label;
}

function safeAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function formatAmount(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

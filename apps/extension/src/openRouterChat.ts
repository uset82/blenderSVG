import {
  STUDIO_CHAT_SYSTEM_PROMPT,
  type HostToStudioMessageInput,
  type StudioChatHistoryMessage,
  type StudioChatUsage,
  type StudioModel,
  type StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "./openRouterConnection.js";

const API_ROOT = "https://openrouter.ai/api/v1";
const CATALOG_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 120_000;
const MAX_CATALOG_BYTES = 5_000_000;
const MAX_HISTORY_CHARS = 60_000;
const MAX_REPLY_CHARS = 64_000;

type CatalogMessage = Extract<HostToStudioMessageInput, { type: "studio:modelCatalog" }>;
type ChatRequest = Extract<StudioToHostMessage, { type: "studio:chatRequest" }>;
type ChatErrorMessage = Extract<HostToStudioMessageInput, { type: "studio:chatError" }>;
type ChatCompleteMessage = Extract<HostToStudioMessageInput, { type: "studio:chatComplete" }>;

interface ActiveChat {
  controller: AbortController;
  cancelled: boolean;
}

interface ChatStreamResult {
  finishReason?: string;
  usage?: StudioChatUsage;
  textLength: number;
}

/** Owns catalog, chat requests, timeout, cancellation, and provider error redaction. */
export class OpenRouterChatController {
  private readonly activeChats = new Map<string, ActiveChat>();
  private availableModels = new Map<string, StudioModel>();
  private catalogController: AbortController | undefined;
  private busy = false;

  public constructor(
    private readonly secrets: SecretStore,
    private readonly emit: (message: HostToStudioMessageInput) => void,
    private readonly request: typeof fetch = fetch
  ) {}

  public async refreshModels(): Promise<CatalogMessage> {
    if (this.busy) return catalogError("Another OpenRouter request is still running. Try again shortly.");
    this.busy = true;
    const controller = new AbortController();
    this.catalogController = controller;
    const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
    try {
      const key = await this.secrets.get(OPENROUTER_SECRET_KEY);
      if (!key) {
        this.availableModels.clear();
        return catalogError("Connect an OpenRouter key before loading available models.");
      }

      const accountResponse = await this.request(`${API_ROOT}/models/user?output_modalities=all`, {
        method: "GET",
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        redirect: "error",
        signal: controller.signal
      });
      let response = accountResponse;
      let catalogScope: "account" | "public" = "account";
      if (accountResponse.status === 403) {
        await accountResponse.body?.cancel().catch(() => undefined);
        response = await this.request(`${API_ROOT}/models?output_modalities=all`, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: controller.signal
        });
        catalogScope = "public";
      }
      if (!response.ok) {
        this.availableModels.clear();
        return catalogError(catalogStatusMessage(response.status));
      }

      const payload = await readBoundedJson(response, MAX_CATALOG_BYTES);
      const rawModels = isRecord(payload) && Array.isArray(payload.data) ? payload.data : null;
      if (!rawModels) {
        this.availableModels.clear();
        return catalogError("OpenRouter returned an unreadable model catalog.");
      }

      const models = rawModels.map(normalizeModel).filter((value): value is StudioModel => value !== null);
      if (models.length === 0) {
        this.availableModels.clear();
        return catalogError("OpenRouter returned no models available to this account.");
      }
      this.availableModels = new Map(
        models.filter((entry) => entry.textChatEligible).map((entry) => [entry.id, entry])
      );
      return {
        type: "studio:modelCatalog",
        status: "ready",
        message:
          catalogScope === "account"
            ? `${models.length} account-available models loaded. Only text-chat models can send messages.`
            : `${models.length} public OpenRouter models loaded. Account-specific provider preferences could not be read with this key; the selected model is checked again when sent. Only text-chat models can send messages.`,
        models,
        refreshedAt: new Date().toISOString()
      };
    } catch {
      this.availableModels.clear();
      return catalogError(
        controller.signal.aborted
          ? "Loading the OpenRouter catalog timed out. Try again."
          : "Could not reach OpenRouter to load models."
      );
    } finally {
      clearTimeout(timeout);
      if (this.catalogController === controller) this.catalogController = undefined;
      this.busy = false;
    }
  }

  public async send(request: ChatRequest): Promise<void> {
    const { requestId, modelId } = request;
    if (this.activeChats.has(requestId)) {
      this.emitChatError(requestId, "invalid-request", "That chat request is already running.");
      return;
    }

    const historySize = request.history.reduce(
      (sum, message) => sum + message.content.length,
      request.userMessage.length
    );
    if (historySize > MAX_HISTORY_CHARS || !request.userMessage.trim()) {
      this.emitChatError(
        requestId,
        "invalid-request",
        "The message or conversation is too long. Start a new conversation or shorten the prompt."
      );
      return;
    }

    const selectedModel = this.availableModels.get(modelId);
    if (!selectedModel) {
      this.emitChatError(
        requestId,
        "model-unavailable",
        "Refresh the model list and choose an available text-chat model."
      );
      return;
    }
    if (request.attachment && !selectedModel.inputModalities.includes("image")) {
      this.emitChatError(
        requestId,
        "invalid-request",
        "Choose a model that supports image input before sending this attachment."
      );
      return;
    }

    let key: string | undefined;
    try {
      key = await this.secrets.get(OPENROUTER_SECRET_KEY);
    } catch {
      this.emitChatError(requestId, "provider", "VS Code could not read the saved OpenRouter key.");
      return;
    }
    if (!key) {
      this.emitChatError(requestId, "not-connected", "Connect an OpenRouter key before sending a message.");
      return;
    }

    const active: ActiveChat = { controller: new AbortController(), cancelled: false };
    this.activeChats.set(requestId, active);
    const timeout = setTimeout(() => active.controller.abort(), CHAT_TIMEOUT_MS);
    try {
      const response = await this.request(`${API_ROOT}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "text/event-stream",
          "Content-Type": "application/json"
        },
        redirect: "error",
        signal: active.controller.signal,
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: STUDIO_CHAT_SYSTEM_PROMPT },
            ...request.history.map((message: StudioChatHistoryMessage) => ({
              role: message.role,
              content: message.content
            })),
            {
              role: "user",
              content: request.attachment
                ? [
                    { type: "text", text: request.userMessage },
                    { type: "image_url", image_url: { url: request.attachment.dataUrl } }
                  ]
                : request.userMessage
            }
          ],
          stream: true,
          stream_options: { include_usage: true },
          ...(selectedModel.supportedParameters.includes("max_completion_tokens")
            ? { max_completion_tokens: 2048 }
            : selectedModel.supportedParameters.includes("max_tokens")
              ? { max_tokens: 2048 }
              : {})
        })
      });

      if (!response.ok) {
        await response.body?.cancel();
        const failure = chatStatus(response.status);
        this.emitChatError(requestId, failure.code, failure.message);
        return;
      }
      if (!response.body) {
        this.emitChatError(requestId, "provider", "OpenRouter returned an empty response stream.");
        return;
      }

      const result = await consumeChatStream(response.body, active.controller.signal, (delta) => {
        if (!active.cancelled) this.emit({ type: "studio:chatDelta", requestId, delta });
      });
      if (active.cancelled) {
        this.emitChatError(requestId, "cancelled", "Generation stopped.");
      } else if (result.textLength === 0) {
        this.emitChatError(requestId, "provider", "The selected model returned an empty reply.");
      } else {
        const complete: ChatCompleteMessage = {
          type: "studio:chatComplete",
          requestId,
          modelId,
          ...(result.finishReason ? { finishReason: result.finishReason } : {}),
          ...(result.usage ? { usage: result.usage } : {})
        };
        this.emit(complete);
      }
    } catch (error) {
      if (active.cancelled) this.emitChatError(requestId, "cancelled", "Generation stopped.");
      else if (active.controller.signal.aborted)
        this.emitChatError(requestId, "timeout", "The model response timed out. Try again.");
      else if (error instanceof OpenRouterStreamError)
        this.emitChatError(
          requestId,
          "provider",
          "OpenRouter interrupted the streaming response. Retry to start a fresh request."
        );
      else
        this.emitChatError(
          requestId,
          "offline",
          "Could not complete the OpenRouter request. Check the connection and retry."
        );
    } finally {
      clearTimeout(timeout);
      this.activeChats.delete(requestId);
    }
  }

  public cancel(requestId: string): void {
    const active = this.activeChats.get(requestId);
    if (!active) return;
    active.cancelled = true;
    active.controller.abort();
  }

  public cancelAll(): void {
    this.catalogController?.abort();
    this.catalogController = undefined;
    for (const [requestId, active] of this.activeChats) {
      active.cancelled = true;
      active.controller.abort();
      this.emitChatError(requestId, "cancelled", "Generation stopped because the OpenRouter connection changed.");
    }
    this.activeChats.clear();
    this.availableModels.clear();
  }

  public dispose(): void {
    this.cancelAll();
  }

  private emitChatError(requestId: string, code: ChatErrorMessage["code"], message: string): void {
    this.emit({ type: "studio:chatError", requestId, code, message });
  }
}

function catalogError(message: string): CatalogMessage {
  return { type: "studio:modelCatalog", status: "error", message, models: [] };
}

function catalogStatusMessage(status: number): string {
  if (status === 401) return "OpenRouter rejected the saved key. Replace it and try again.";
  if (status === 403) return "OpenRouter denied access to the model catalog. Test the saved key and try again.";
  if (status === 429) return "OpenRouter is rate limiting catalog requests. Try again shortly.";
  if (status >= 500) return "OpenRouter is temporarily unavailable. Try again shortly.";
  return `OpenRouter could not load models (HTTP ${status}).`;
}

function chatStatus(status: number): { code: ChatErrorMessage["code"]; message: string } {
  if (status === 401 || status === 403)
    return { code: "provider", message: "OpenRouter rejected the saved key. Replace it and try again." };
  if (status === 402)
    return { code: "credits", message: "The OpenRouter account has no available credits for this request." };
  if (status === 429)
    return { code: "rate-limited", message: "OpenRouter is rate limiting requests. Wait briefly and retry." };
  if (status === 404)
    return {
      code: "model-unavailable",
      message: "The selected model is unavailable. Refresh the catalog and choose another model."
    };
  if (status === 400)
    return {
      code: "invalid-request",
      message: "OpenRouter could not accept this request. Check the selected model and shorten the conversation."
    };
  return { code: "provider", message: `OpenRouter could not complete the request (HTTP ${status}).` };
}

function normalizeModel(value: unknown): StudioModel | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.includes("/")) return null;
  const id = value.id.slice(0, 200);
  const architecture = isRecord(value.architecture) ? value.architecture : {};
  const modality = typeof architecture.modality === "string" ? architecture.modality : "";
  const [inferredInput = "", inferredOutput = ""] = modality.split("->", 2);
  const inputModalities = stringArray(architecture.input_modalities, inferredInput ? inferredInput.split("+") : []);
  const outputModalities = stringArray(architecture.output_modalities, inferredOutput ? inferredOutput.split("+") : []);
  const pricing = isRecord(value.pricing) ? value.pricing : {};
  const author = id.split("/", 1)[0] ?? "";
  const supportedParameters = stringArray(value.supported_parameters, []);
  const contextLength =
    typeof value.context_length === "number" && Number.isFinite(value.context_length)
      ? Math.max(0, Math.min(Math.floor(value.context_length), 10_000_000))
      : 0;
  const promptPrice = priceString(pricing.prompt);
  const completionPrice = priceString(pricing.completion);

  return {
    id,
    name: boundedString(value.name, 300) || id,
    author: author.slice(0, 120),
    description: boundedString(value.description, 1600),
    inputModalities,
    outputModalities,
    contextLength,
    promptPrice,
    completionPrice,
    supportedParameters,
    textChatEligible: inputModalities.includes("text") && outputModalities.includes("text")
  };
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback.slice(0, 32).map((item) => item.slice(0, 80));
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 32)
    .map((item) => item.slice(0, 80));
}

function priceString(value: unknown): string {
  if (typeof value === "string" && value.length <= 64) return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return String(value);
  return "";
}

function boundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class OpenRouterStreamError extends Error {}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new Error("OpenRouter returned an empty catalog response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Catalog response exceeded its size limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onDelta: (delta: string) => void
): Promise<ChatStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventSize = 0;
  let dataLines: string[] = [];
  let textLength = 0;
  let finishReason: string | undefined;
  let usage: StudioChatUsage | undefined;

  const dispatch = () => {
    if (dataLines.length === 0) return false;
    const payload = dataLines.join("\n");
    dataLines = [];
    eventSize = 0;
    if (payload === "[DONE]") return true;
    let event: unknown;
    try {
      event = JSON.parse(payload) as unknown;
    } catch {
      throw new OpenRouterStreamError();
    }
    if (!isRecord(event)) return false;
    if (Object.prototype.hasOwnProperty.call(event, "error")) throw new OpenRouterStreamError();
    if (isRecord(event.usage)) usage = normalizeUsage(event.usage);
    if (Array.isArray(event.choices) && isRecord(event.choices[0])) {
      const choice = event.choices[0];
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason.slice(0, 80);
      if (isRecord(choice.delta)) {
        const delta = extractText(choice.delta.content);
        if (delta) {
          textLength += delta.length;
          if (textLength > MAX_REPLY_CHARS) throw new OpenRouterStreamError();
          onDelta(delta);
        }
      }
    }
    return false;
  };

  try {
    while (true) {
      if (signal.aborted) throw new Error("Request aborted.");
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let lineBreak = buffer.indexOf("\n");
      while (lineBreak >= 0) {
        let line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          if (dispatch()) return { textLength, ...(finishReason ? { finishReason } : {}), ...(usage ? { usage } : {}) };
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const fieldValue = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "data") {
            eventSize += fieldValue.length;
            if (eventSize > 64_000) throw new OpenRouterStreamError();
            dataLines.push(fieldValue);
          }
        }
        lineBreak = buffer.indexOf("\n");
      }
      if (buffer.length > 64_000) throw new OpenRouterStreamError();
      if (done) {
        if (buffer.trim()) {
          dataLines.push(buffer.startsWith("data:") ? buffer.slice(5).trimStart() : buffer);
        }
        dispatch();
        return { textLength, ...(finishReason ? { finishReason } : {}), ...(usage ? { usage } : {}) };
      }
    }
  } finally {
    if (signal.aborted) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .filter(isRecord)
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("");
}

function normalizeUsage(value: Record<string, unknown>): StudioChatUsage | undefined {
  const promptTokens = safeTokenCount(value.prompt_tokens);
  const completionTokens = safeTokenCount(value.completion_tokens);
  const totalTokens = safeTokenCount(value.total_tokens);
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;
  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {})
  };
}

function safeTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 200_000_000)
    : undefined;
}

import {
  type HostToStudioMessageInput,
  STUDIO_CHAT_SYSTEM_PROMPT,
  type StudioChatHistoryMessage,
  type StudioChatUsage,
  type StudioModel,
  type StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { parseCanvasToolArguments } from "@codex-avatar-studio/studio-agent/agentGuards";
import { canvasTool, toolsForComposerMode } from "@codex-avatar-studio/studio-agent/canvasTools";
import {
  createTurn,
  reduceTurn,
  type TurnSnapshot,
  toolTimeoutMs
} from "@codex-avatar-studio/studio-agent/turnMachine";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "./openRouterConnection.js";

const API_ROOT = "https://openrouter.ai/api/v1";
const CATALOG_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 10 * 60_000;
const MAX_CATALOG_BYTES = 5_000_000;
const MAX_HISTORY_CHARS = 60_000;
const MAX_REPLY_CHARS = 64_000;
const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS_PER_ROUND = 6;
const MAX_TOOL_OUTPUT_CHARS = 16_384;
const TOOL_PERMISSION_TIMEOUT_MS = 120_000;

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
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

interface ToolExecutionResult {
  ok: boolean;
  content: string;
  imageDataUrl?: string;
}

interface PendingReply<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface OpenRouterAttribution {
  title: string;
  referer?: string;
}

const DESKTOP_ATTRIBUTION: OpenRouterAttribution = { title: "Kurva Studio", referer: "http://127.0.0.1" };

export function attributionHeaders(attribution: OpenRouterAttribution): Record<string, string> {
  const headers: Record<string, string> = { "X-Title": attribution.title };
  if (attribution.referer) headers["HTTP-Referer"] = attribution.referer;
  return headers;
}

class ToolTurnError extends Error {
  public constructor(
    public readonly code: ChatErrorMessage["code"],
    message: string
  ) {
    super(message);
  }
}

/** Owns catalog, chat requests, timeout, cancellation, and provider error redaction. */
export class OpenRouterChatController {
  private readonly activeChats = new Map<string, ActiveChat>();
  private availableModels = new Map<string, StudioModel>();
  private catalogController: AbortController | undefined;
  private catalogFlight: Promise<CatalogMessage> | null = null;
  private readonly turns = new Map<string, TurnSnapshot>();
  private readonly pendingPermissions = new Map<string, PendingReply<boolean>>();
  private readonly pendingToolResults = new Map<string, PendingReply<ToolExecutionResult>>();

  public turn(requestId: string): TurnSnapshot | undefined {
    return this.turns.get(requestId);
  }

  public resolveToolPermission(requestId: string, callId: string, granted: boolean): void {
    this.pendingPermissions.get(toolWaitKey(requestId, callId))?.resolve(granted);
  }

  public resolveToolExecutionResult(requestId: string, callId: string, result: ToolExecutionResult): void {
    const imageDataUrl = result.imageDataUrl;
    if (
      imageDataUrl &&
      (imageDataUrl.length > 2_100_000 ||
        !/^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageDataUrl))
    ) {
      this.pendingToolResults
        .get(toolWaitKey(requestId, callId))
        ?.resolve({ ok: false, content: "The canvas returned an invalid PNG image." });
      return;
    }
    this.pendingToolResults.get(toolWaitKey(requestId, callId))?.resolve({
      ok: result.ok,
      content: result.content.slice(0, MAX_TOOL_OUTPUT_CHARS),
      ...(imageDataUrl ? { imageDataUrl } : {})
    });
  }

  public constructor(
    private readonly secrets: SecretStore,
    private readonly emit: (message: HostToStudioMessageInput) => void,
    private readonly request: typeof fetch = fetch,
    private readonly attribution: OpenRouterAttribution = DESKTOP_ATTRIBUTION
  ) {}

  public refreshModels(): Promise<CatalogMessage> {
    if (this.catalogFlight) return this.catalogFlight;
    this.catalogFlight = this.loadModels().finally(() => {
      this.catalogFlight = null;
    });
    return this.catalogFlight;
  }

  private async loadModels(): Promise<CatalogMessage> {
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
      const rawModels = await this.readCatalogPages(payload, response.url, controller.signal);
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
    }
  }

  private async postChat(active: ActiveChat, init: RequestInit): Promise<Response> {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await this.request(`${API_ROOT}/chat/completions`, init);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || active.cancelled || active.controller.signal.aborted || attempt === 2) return response;
      await response.body?.cancel().catch(() => undefined);
      await waitForRetry(retryAfterMs(attempt), active.controller.signal);
    }
    return response ?? new Response(null, { status: 503 });
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

    let selectedModel = this.availableModels.get(modelId);
    if (!selectedModel) {
      await this.refreshModels();
      selectedModel = this.availableModels.get(modelId);
    }
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
      this.emitChatError(requestId, "provider", "The saved OpenRouter key could not be read.");
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
      this.turns.set(requestId, reduceTurn(createTurn(), { type: "start" }));
      this.emitTurnState(requestId, "model", "Sending the request to the selected model.");
      const allowedTools = toolsForComposerMode(request.mode ?? "ask").filter(
        (entry) => entry.function.name !== "screenshot_frame" || selectedModel.inputModalities.includes("image")
      );
      const toolSupport = selectedModel.supportedParameters.includes("tools") && allowedTools.length > 0;
      const messages: Array<Record<string, unknown>> = [
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
      ];
      let finalReason: string | undefined;
      let combinedUsage: StudioChatUsage | undefined;
      let totalTextLength = 0;
      let finished = false;

      for (let round = 0; round <= MAX_TOOL_ROUNDS && !finished; round += 1) {
        const response = await this.postChat(active, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            ...attributionHeaders(this.attribution)
          },
          redirect: "error",
          signal: active.controller.signal,
          body: JSON.stringify({
            model: modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            usage: { include: true },
            ...(toolSupport ? { tools: allowedTools, tool_choice: "auto" } : {}),
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
          this.emitTurnState(requestId, "error", failure.message);
          this.emitChatError(requestId, failure.code, failure.message);
          return;
        }
        if (!response.body) throw new OpenRouterStreamError();

        this.emitTurnState(requestId, "streaming", "Receiving the model response.");
        const result = await consumeChatStream(
          response.body,
          active.controller.signal,
          (delta) => {
            if (active.cancelled) return;
            totalTextLength += delta.length;
            if (totalTextLength > MAX_REPLY_CHARS) throw new OpenRouterStreamError();
            this.emit({ type: "studio:chatDelta", requestId, delta });
            const current = this.turns.get(requestId);
            if (current) this.turns.set(requestId, reduceTurn(current, { type: "text", text: delta }));
          },
          (delta) => {
            if (!active.cancelled) this.emit({ type: "studio:chatReasoning", requestId, delta });
          },
          (tool) => {
            if (active.cancelled) return;
            const current = this.turns.get(requestId);
            if (current) this.turns.set(requestId, reduceTurn(current, { type: "tool-delta", ...tool }));
          }
        );
        finalReason = result.finishReason ?? finalReason;
        combinedUsage = addUsage(combinedUsage, result.usage);
        const current = this.turns.get(requestId);
        if (current)
          this.turns.set(
            requestId,
            reduceTurn(current, active.cancelled ? { type: "cancel" } : { type: "stream-end" })
          );

        if (active.cancelled) throw new ToolTurnError("cancelled", "Generation stopped.");
        if (result.toolCalls.length === 0) {
          finished = true;
          break;
        }
        if (!toolSupport || round >= MAX_TOOL_ROUNDS) {
          throw new ToolTurnError(
            "invalid-request",
            "The model requested more canvas tool calls than this turn allows."
          );
        }
        if (result.toolCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
          throw new ToolTurnError("invalid-request", "The model requested too many canvas actions at once.");
        }
        if (result.toolCalls.filter((call) => call.name === "screenshot_frame").length > 1) {
          throw new ToolTurnError("invalid-request", "Approve at most one frame screenshot per model round.");
        }

        this.emitTurnState(requestId, "schedule-tools", "Review the proposed canvas actions.");
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: result.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments }
          }))
        });

        for (const call of result.toolCalls) {
          if (!allowedTools.some((entry) => entry.function.name === call.name)) {
            throw new ToolTurnError(
              "invalid-request",
              "The model requested an action that is not enabled in this mode."
            );
          }
          const parsedArguments = parseCanvasToolArguments(call.name, call.arguments);
          if (!parsedArguments.success) throw new ToolTurnError("invalid-request", parsedArguments.error);
          const metadata = canvasTool(call.name);
          if (!metadata) throw new ToolTurnError("invalid-request", "The model requested an unknown canvas action.");

          const requiresApproval = metadata.readOnly || request.mode !== "auto";
          if (requiresApproval)
            this.emitTurnState(requestId, "await-permission", `Waiting for approval: ${call.name}.`);
          this.emit({
            type: "studio:toolProposed",
            requestId,
            callId: call.id,
            name: call.name,
            summary: metadata.description,
            requiresApproval,
            arguments: JSON.stringify(parsedArguments.data)
          });
          const granted = requiresApproval
            ? await this.waitForReply(
                this.pendingPermissions,
                requestId,
                call.id,
                active.controller.signal,
                TOOL_PERMISSION_TIMEOUT_MS
              )
            : true;
          if (!granted) {
            const content = "The user declined this action. No canvas changes were made.";
            this.emit({
              type: "studio:toolResult",
              requestId,
              callId: call.id,
              ok: false,
              summary: "Declined by user."
            });
            messages.push({ role: "tool", tool_call_id: call.id, content });
            continue;
          }

          this.emitTurnState(
            requestId,
            "execute",
            `${requiresApproval ? "Applying approved action" : "Auto mode applying canvas action"}: ${call.name}.`
          );
          this.emit({
            type: "studio:toolExecute",
            requestId,
            callId: call.id,
            name: call.name,
            arguments: JSON.stringify(parsedArguments.data)
          });
          const execution = await this.waitForReply(
            this.pendingToolResults,
            requestId,
            call.id,
            active.controller.signal,
            toolTimeoutMs(call.name)
          );
          const content = execution.content.slice(0, MAX_TOOL_OUTPUT_CHARS);
          this.emit({
            type: "studio:toolResult",
            requestId,
            callId: call.id,
            ok: execution.ok,
            summary: content.slice(0, 500) || (execution.ok ? "Completed." : "The canvas action failed.")
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: execution.imageDataUrl
              ? [
                  { type: "text", text: content },
                  { type: "image_url", image_url: { url: execution.imageDataUrl } }
                ]
              : content
          });
        }
        this.emitTurnState(requestId, "aggregate", "Sending approved canvas results to the selected model.");
        this.emitTurnState(requestId, "model", "Continuing with the selected model.");
      }

      if (active.cancelled) {
        this.emitChatError(requestId, "cancelled", "Generation stopped.");
      } else if (!finished || totalTextLength === 0) {
        const message =
          totalTextLength === 0 ? "The selected model returned an empty reply." : "The turn did not finish.";
        this.emitTurnState(requestId, "error", message);
        this.emitChatError(requestId, "provider", message);
      } else {
        this.emitTurnState(requestId, "done", "The model response is complete.");
        const complete: ChatCompleteMessage = {
          type: "studio:chatComplete",
          requestId,
          modelId,
          ...(finalReason ? { finishReason: finalReason } : {}),
          ...(combinedUsage ? { usage: combinedUsage } : {})
        };
        this.emit(complete);
      }
    } catch (error) {
      if (active.cancelled) {
        this.emitTurnState(requestId, "error", "Generation stopped.");
        this.emitChatError(requestId, "cancelled", "Generation stopped.");
      } else if (active.controller.signal.aborted) {
        this.emitTurnState(requestId, "error", "The model response timed out.");
        this.emitChatError(requestId, "timeout", "The model response timed out. Try again.");
      } else if (error instanceof ToolTurnError) {
        this.emitTurnState(requestId, "error", error.message);
        this.emitChatError(requestId, error.code, error.message);
      } else if (error instanceof OpenRouterStreamError) {
        this.emitTurnState(requestId, "error", "OpenRouter interrupted the response stream.");
        this.emitChatError(
          requestId,
          "provider",
          "OpenRouter interrupted the streaming response. Retry to start a fresh request."
        );
      } else {
        this.emitTurnState(requestId, "error", "The OpenRouter request could not be completed.");
        this.emitChatError(
          requestId,
          "offline",
          "Could not complete the OpenRouter request. Check the connection and retry."
        );
      }
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
    this.rejectPending(requestId, new Error("The chat request was cancelled."));
  }

  public cancelAll(): void {
    this.catalogController?.abort();
    this.catalogController = undefined;
    for (const [requestId, active] of this.activeChats) {
      active.cancelled = true;
      active.controller.abort();
      this.rejectPending(requestId, new Error("The OpenRouter connection changed."));
      this.emitChatError(requestId, "cancelled", "Generation stopped because the OpenRouter connection changed.");
    }
    this.activeChats.clear();
    this.availableModels.clear();
  }

  private async readCatalogPages(
    firstPayload: unknown,
    firstUrl: string,
    signal: AbortSignal
  ): Promise<unknown[] | null> {
    if (!isRecord(firstPayload) || !Array.isArray(firstPayload.data)) return null;
    const pages = [...firstPayload.data];
    let next = nextOpenRouterCatalogUrl(firstPayload);
    const seen = new Set<string>([firstUrl]);
    for (let page = 0; next && page < 4; page += 1) {
      if (seen.has(next)) break;
      seen.add(next);
      const response = await this.request(next, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal
      });
      if (!response.ok) break;
      const payload = await readBoundedJson(response, MAX_CATALOG_BYTES);
      if (!isRecord(payload) || !Array.isArray(payload.data)) break;
      pages.push(...payload.data);
      next = nextOpenRouterCatalogUrl(payload);
    }
    return pages;
  }

  public dispose(): void {
    this.cancelAll();
  }

  private emitTurnState(
    requestId: string,
    state: NonNullable<Extract<HostToStudioMessageInput, { type: "studio:turnEvent" }>["state"]>,
    text: string
  ): void {
    const current = this.turns.get(requestId);
    if (current) this.turns.set(requestId, { ...current, state });
    this.emit({ type: "studio:turnEvent", requestId, state, text: text.slice(0, 8_000) });
  }

  private waitForReply<T>(
    map: Map<string, PendingReply<T>>,
    requestId: string,
    callId: string,
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<T> {
    const key = toolWaitKey(requestId, callId);
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, value?: T) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        map.delete(key);
        if (error) reject(error);
        else resolve(value as T);
      };
      const onAbort = () => finish(new Error("The tool request was cancelled."));
      const timer = setTimeout(() => finish(new ToolTurnError("timeout", "The canvas action timed out.")), timeoutMs);
      if (signal.aborted) {
        finish(new Error("The tool request was cancelled."));
        return;
      }
      map.set(key, { resolve: (value) => finish(undefined, value), reject: finish });
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private rejectPending(requestId: string, error: Error): void {
    const prefix = `${requestId}:`;
    for (const [key, pending] of this.pendingPermissions) if (key.startsWith(prefix)) pending.reject(error);
    for (const [key, pending] of this.pendingToolResults) if (key.startsWith(prefix)) pending.reject(error);
  }

  private emitChatError(requestId: string, code: ChatErrorMessage["code"], message: string): void {
    this.emit({ type: "studio:chatError", requestId, code, message });
  }
}

export function retryAfterMs(attempt: number): number {
  return Math.min(4_000, 500 * 2 ** attempt);
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Request aborted."));
      },
      { once: true }
    );
  });
}

export function nextOpenRouterCatalogUrl(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.next !== "string") return null;
  let url: URL;
  try {
    url = new URL(payload.next);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "openrouter.ai") return null;
  if (url.pathname !== "/api/v1/models" && url.pathname !== "/api/v1/models/user") return null;
  return url.toString();
}

function catalogError(message: string): CatalogMessage {
  return { type: "studio:modelCatalog", status: "error", message, models: [] };
}

function catalogStatusMessage(status: number): string {
  if (status === 401) return "OpenRouter rejected the saved key. Reconnect and try again.";
  if (status === 403) return "OpenRouter denied access to the model catalog. Test the saved key and try again.";
  if (status === 429) return "OpenRouter is rate limiting catalog requests. Try again shortly.";
  if (status >= 500) return "OpenRouter is temporarily unavailable. Try again shortly.";
  return `OpenRouter could not load models (HTTP ${status}).`;
}

function chatStatus(status: number): { code: ChatErrorMessage["code"]; message: string } {
  if (status === 401)
    return { code: "provider", message: "OpenRouter rejected the saved key. Reconnect and try again." };
  if (status === 403)
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
  onDelta: (delta: string) => void,
  onReasoning: (delta: string) => void,
  onTool: (tool: { index: number; id?: string; name?: string; arguments?: string }) => void
): Promise<ChatStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventSize = 0;
  let dataLines: string[] = [];
  let textLength = 0;
  let reasoningLength = 0;
  let finishReason: string | undefined;
  let usage: StudioChatUsage | undefined;
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

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
    if (Object.hasOwn(event, "error")) throw new OpenRouterStreamError();
    if (isRecord(event.usage)) usage = normalizeUsage(event.usage);
    if (Array.isArray(event.choices) && isRecord(event.choices[0])) {
      const choice = event.choices[0];
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason.slice(0, 80);
      if (isRecord(choice.delta)) {
        const reasoning = reasoningDelta(choice.delta);
        if (reasoning) {
          reasoningLength += reasoning.length;
          if (reasoningLength > MAX_REPLY_CHARS) throw new OpenRouterStreamError();
          onReasoning(reasoning);
        }
        for (const tool of toolCallDeltas(choice.delta)) {
          const existing = toolCalls.get(tool.index) ?? { id: "", name: "", arguments: "" };
          if (tool.id) existing.id = tool.id.slice(0, 80);
          if (tool.name) {
            existing.name += tool.name;
            if (existing.name.length > 80) throw new OpenRouterStreamError();
          }
          if (tool.arguments) {
            existing.arguments += tool.arguments;
            if (existing.arguments.length > 16_384) throw new OpenRouterStreamError();
          }
          toolCalls.set(tool.index, existing);
          if (toolCalls.size > MAX_TOOL_CALLS_PER_ROUND) throw new OpenRouterStreamError();
          onTool(tool);
        }
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
          if (dispatch())
            return {
              textLength,
              toolCalls: finalizeToolCalls(toolCalls),
              ...(finishReason ? { finishReason } : {}),
              ...(usage ? { usage } : {})
            };
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
        return {
          textLength,
          toolCalls: finalizeToolCalls(toolCalls),
          ...(finishReason ? { finishReason } : {}),
          ...(usage ? { usage } : {})
        };
      }
    }
  } finally {
    if (signal.aborted) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function finalizeToolCalls(
  toolCalls: Map<number, { id: string; name: string; arguments: string }>
): ChatStreamResult["toolCalls"] {
  return [...toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, call]) => ({
      id: /^[A-Za-z0-9_-]{1,80}$/.test(call.id) ? call.id : `call-${index}-${crypto.randomUUID()}`,
      name: call.name.slice(0, 80),
      arguments: call.arguments
    }));
}

export function toolCallDeltas(
  delta: Record<string, unknown>
): Array<{ index: number; id?: string; name?: string; arguments?: string }> {
  if (!Array.isArray(delta.tool_calls)) return [];
  return delta.tool_calls.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.index !== "number" ||
      !Number.isSafeInteger(item.index) ||
      item.index < 0 ||
      item.index >= MAX_TOOL_CALLS_PER_ROUND
    ) {
      return [];
    }
    const fn = isRecord(item.function) ? item.function : {};
    return [
      {
        index: item.index,
        ...(typeof item.id === "string" ? { id: item.id } : {}),
        ...(typeof fn.name === "string" ? { name: fn.name } : {}),
        ...(typeof fn.arguments === "string" ? { arguments: fn.arguments } : {})
      }
    ];
  });
}

export function reasoningDelta(delta: Record<string, unknown>): string {
  if (typeof delta.reasoning === "string") return delta.reasoning.slice(0, 16_384);
  if (typeof delta.reasoning_content === "string") return delta.reasoning_content.slice(0, 16_384);
  return "";
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
  const cost =
    typeof value.cost === "number" && Number.isFinite(value.cost) && value.cost >= 0 ? value.cost : undefined;
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined && cost === undefined)
    return undefined;
  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cost !== undefined ? { cost } : {})
  };
}

function addUsage(
  current: StudioChatUsage | undefined,
  next: StudioChatUsage | undefined
): StudioChatUsage | undefined {
  if (!current) return next;
  if (!next) return current;
  return {
    ...(current.promptTokens !== undefined || next.promptTokens !== undefined
      ? { promptTokens: (current.promptTokens ?? 0) + (next.promptTokens ?? 0) }
      : {}),
    ...(current.completionTokens !== undefined || next.completionTokens !== undefined
      ? { completionTokens: (current.completionTokens ?? 0) + (next.completionTokens ?? 0) }
      : {}),
    ...(current.totalTokens !== undefined || next.totalTokens !== undefined
      ? { totalTokens: (current.totalTokens ?? 0) + (next.totalTokens ?? 0) }
      : {}),
    ...(current.cost !== undefined || next.cost !== undefined ? { cost: (current.cost ?? 0) + (next.cost ?? 0) } : {})
  };
}

function toolWaitKey(requestId: string, callId: string): string {
  return `${requestId}:${callId}`;
}

function safeTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 200_000_000)
    : undefined;
}

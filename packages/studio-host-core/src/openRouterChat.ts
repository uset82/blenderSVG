import type {
  HostToStudioMessageInput,
  StudioChatHistoryMessage,
  StudioChatUsage,
  StudioModel,
  StudioToHostMessage
} from "@codex-avatar-studio/avatar-core";
import { CANVAS_TOOLS, type CanvasTool, toolsForComposerMode } from "@codex-avatar-studio/studio-agent/canvasTools";
import { buildSystemPrompt } from "@codex-avatar-studio/studio-agent/designPrompt";
import {
  MAX_DESIGN_RESULT_CHARS,
  MAX_SSE_EVENT_CHARS,
  MAX_TOOL_ARGUMENT_CHARS
} from "@codex-avatar-studio/studio-agent/limits";
import { prepareToolCall } from "@codex-avatar-studio/studio-agent/toolInput";
import {
  affordableCompletionTokens,
  type ComposerMode,
  completionTokenBudget,
  MAX_STREAMED_TOOL_CALLS,
  toolNeedsApproval,
  toolTimeoutMs,
  turnLimits
} from "@codex-avatar-studio/studio-agent/toolPolicy";
import {
  type StudioTurnState,
  studioTurnState,
  ToolScheduler,
  TurnMachine,
  TurnPhase
} from "@codex-avatar-studio/studio-agent/turnMachine";
import { OPENROUTER_SECRET_KEY, type SecretStore } from "./openRouterConnection.js";

const API_ROOT = "https://openrouter.ai/api/v1";
const CATALOG_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 10 * 60_000;
const MAX_CATALOG_BYTES = 5_000_000;
const MAX_HISTORY_CHARS = 60_000;
const MAX_TOOL_OUTPUT_CHARS = MAX_DESIGN_RESULT_CHARS;
const TOOL_PERMISSION_TIMEOUT_MS = 120_000;
/** A toolProgress message goes out each time a streaming call's arguments grow by this much. */
const TOOL_PROGRESS_STEP_CHARS = 4_000;
const READ_ONLY_CANVAS_TOOLS = new Set(CANVAS_TOOLS.filter((tool) => tool.readOnly).map((tool) => tool.name));

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
  private readonly turns = new Map<string, TurnMachine>();
  private readonly pendingPermissions = new Map<string, PendingReply<boolean>>();
  private readonly pendingToolResults = new Map<string, PendingReply<ToolExecutionResult>>();

  /** The current state of a turn: its Studio state, its visible text and ZCode's turn phase. */
  public turn(requestId: string): { state: StudioTurnState; text: string; phase: TurnPhase } | undefined {
    const machine = this.turns.get(requestId);
    if (!machine) return undefined;
    return {
      state: studioTurnState(machine.state.phase),
      text: machine.state.finalResponse ?? machine.state.streamingContent,
      phase: machine.state.phase
    };
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

      // The account-scoped `/models/user` list does not reliably carry
      // `benchmarks.artificial_analysis`, so rows normalise to
      // `intelligence: null` and the Intelligence chip reads zero even though the
      // public `/models` list is publishing scores. Top up any row the primary
      // response left unscored, keyed by id. Only rows actually missing data are
      // touched, so a catalog that already has scores costs one no-op pass.
      const unscored = rawModels.filter((value) => isRecord(value) && !hasArtificialAnalysis(value));
      if (unscored.length > 0) {
        const merged = await this.readBenchmarkScores(controller.signal, key);
        if (merged) {
          for (const value of unscored) {
            if (!isRecord(value)) continue;
            const id = typeof value.id === "string" ? value.id : "";
            const canonicalId = id.startsWith("~") ? id.slice(1) : id.replace(/:batch$/, "");
            const scores = merged.get(id) ?? merged.get(canonicalId);
            if (scores) value.benchmarks = { ...(isRecord(value.benchmarks) ? value.benchmarks : {}), ...scores };
          }
        }
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

    const model = selectedModel;
    const mode: ComposerMode = request.mode ?? "ask";
    const limits = turnLimits(mode);
    const active: ActiveChat = { controller: new AbortController(), cancelled: false };
    this.activeChats.set(requestId, active);
    const timeout = setTimeout(() => active.controller.abort(), CHAT_TIMEOUT_MS);
    const machine = TurnMachine.create(requestId, 1, request.userMessage, requestId);
    this.turns.set(requestId, machine);
    try {
      machine.state = machine.start();
      const allowedTools = toolsForComposerMode(mode).filter(
        (entry) => entry.function.name !== "screenshot_frame" || model.inputModalities.includes("image")
      );
      const toolSupport = model.supportedParameters.includes("tools") && allowedTools.length > 0;
      const allowedNames = new Set(toolSupport ? allowedTools.map((entry) => entry.function.name) : []);
      const messages: Array<Record<string, unknown>> = [
        {
          role: "system",
          content: buildSystemPrompt({
            mode,
            toolSupport,
            skill: request.skill,
            context: request.designContext
          })
        },
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
      let budget = completionTokenBudget(model);
      let finalReason: string | undefined;
      let combinedUsage: StudioChatUsage | undefined;
      let totalTextLength = 0;
      let succeededCalls = 0;
      let failedRounds = 0;
      let toolsClosed = !toolSupport;

      for (let round = 0; ; round += 1) {
        if (round >= limits.maxToolRounds) toolsClosed = true;
        machine.state = machine.startModelRequest(modelId, []);
        this.emitTurnState(
          requestId,
          round === 0
            ? "Sending the request to the selected model."
            : toolsClosed && toolSupport
              ? "Asking the model to sum up what it changed."
              : "Continuing with the selected model."
        );
        const body = (maxTokens: number) =>
          JSON.stringify({
            model: modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            usage: { include: true },
            ...(toolSupport ? { tools: allowedTools, tool_choice: toolsClosed ? "none" : "auto" } : {}),
            ...(model.supportedParameters.includes("max_completion_tokens")
              ? { max_completion_tokens: maxTokens }
              : model.supportedParameters.includes("max_tokens")
                ? { max_tokens: maxTokens }
                : {})
          });
        const init = (maxTokens: number): RequestInit => ({
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: "text/event-stream",
            "Content-Type": "application/json",
            ...attributionHeaders(this.attribution)
          },
          redirect: "error",
          signal: active.controller.signal,
          body: body(maxTokens)
        });
        let response = await this.postChat(active, init(budget));
        if (response.status === 402) {
          // A smaller output budget may still fit the account's credit; try once with what it can afford.
          const affordable = affordableCompletionTokens(await readErrorText(response), budget);
          if (affordable) {
            await response.body?.cancel().catch(() => undefined);
            budget = affordable;
            response = await this.postChat(active, init(budget));
          }
        }

        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          const failure = chatStatus(response.status);
          this.failTurn(requestId, failure.message);
          this.emitChatError(requestId, failure.code, failure.message);
          return;
        }
        if (!response.body) throw new OpenRouterStreamError();

        machine.state = machine.receiveModelResponse("");
        this.emitTurnState(requestId, "Receiving the model response.");
        let roundText = "";
        const progress = new Map<number, { name: string; chars: number; sent: number }>();
        const result = await consumeChatStream(
          response.body,
          active.controller.signal,
          limits.maxReplyChars,
          (delta) => {
            if (active.cancelled) return;
            totalTextLength += delta.length;
            if (totalTextLength > limits.maxReplyChars) throw new OpenRouterStreamError();
            roundText += delta;
            this.emit({ type: "studio:chatDelta", requestId, delta });
            machine.state = machine.addStreamingContent(delta);
          },
          (delta) => {
            if (!active.cancelled) this.emit({ type: "studio:chatReasoning", requestId, delta });
          },
          (tool) => {
            if (active.cancelled) return;
            const entry = progress.get(tool.index) ?? { name: "", chars: 0, sent: 0 };
            if (tool.name) entry.name = (entry.name + tool.name).slice(0, 80);
            if (tool.arguments) entry.chars += tool.arguments.length;
            progress.set(tool.index, entry);
            // Large design calls take a while to stream; report how much has been written so far.
            if (entry.chars - entry.sent >= TOOL_PROGRESS_STEP_CHARS) {
              entry.sent = entry.chars;
              this.emit({
                type: "studio:toolProgress",
                requestId,
                index: tool.index,
                ...(entry.name ? { name: entry.name } : {}),
                chars: entry.chars
              });
            }
          }
        );
        finalReason = result.finishReason ?? finalReason;
        combinedUsage = addUsage(combinedUsage, result.usage);
        if (active.cancelled) throw new ToolTurnError("cancelled", "Generation stopped.");

        const calls = toolsClosed ? [] : result.toolCalls;
        if (calls.length === 0) {
          if (totalTextLength === 0 && succeededCalls === 0) {
            const message =
              result.finishReason === "length"
                ? "The model reached its output limit before replying. Try again or choose another model."
                : "The selected model returned an empty reply.";
            this.failTurn(requestId, message);
            this.emitChatError(requestId, "provider", message);
            return;
          }
          machine.state = machine.complete(machine.state.streamingContent);
          this.emitTurnState(requestId, "The model response is complete.");
          const complete: ChatCompleteMessage = {
            type: "studio:chatComplete",
            requestId,
            modelId,
            ...(finalReason ? { finishReason: finalReason } : {}),
            ...(combinedUsage ? { usage: combinedUsage } : {})
          };
          this.emit(complete);
          return;
        }

        // The assistant message keeps this round's text, so the model sees what it already said.
        messages.push({
          role: "assistant",
          content: roundText || null,
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments }
          }))
        });
        const outcomes = await this.runToolRound(requestId, active, machine, calls, {
          mode,
          allowedNames,
          maxCalls: limits.maxCallsPerRound,
          cutOff: result.finishReason === "length"
        });
        // Every call id gets exactly one answer, in the order the model sent them.
        for (const call of calls) {
          const outcome = outcomes.get(call.id) ?? { ok: false, content: "This call was not run." };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: outcome.imageDataUrl
              ? [
                  { type: "text", text: outcome.content },
                  { type: "image_url", image_url: { url: outcome.imageDataUrl } }
                ]
              : outcome.content
          });
        }
        const succeeded = [...outcomes.values()].filter((outcome) => outcome.ok).length;
        succeededCalls += succeeded;
        failedRounds = succeeded === 0 ? failedRounds + 1 : 0;
        if (failedRounds >= limits.maxFailedRounds) toolsClosed = true;
        machine.state = machine.aggregateResults();
        this.emitTurnState(requestId, "Sending the canvas results to the selected model.");
      }
    } catch (error) {
      if (active.cancelled) {
        this.failTurn(requestId, "Generation stopped.");
        this.emitChatError(requestId, "cancelled", "Generation stopped.");
      } else if (active.controller.signal.aborted) {
        this.failTurn(requestId, "The model response timed out.");
        this.emitChatError(requestId, "timeout", "The model response timed out. Try again.");
      } else if (error instanceof ToolTurnError) {
        this.failTurn(requestId, error.message);
        this.emitChatError(requestId, error.code, error.message);
      } else if (error instanceof OpenRouterStreamError) {
        this.failTurn(requestId, "OpenRouter interrupted the response stream.");
        this.emitChatError(
          requestId,
          "provider",
          "OpenRouter interrupted the streaming response. Retry to start a fresh request."
        );
      } else {
        this.failTurn(requestId, "The OpenRouter request could not be completed.");
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

  /**
   * Runs one round of tool calls. Each call is checked first; a bad call is answered with an error the
   * model can correct. Valid calls follow ZCode's schedule: reads run together, changes one at a time.
   */
  private async runToolRound(
    requestId: string,
    active: ActiveChat,
    machine: TurnMachine,
    calls: ChatStreamResult["toolCalls"],
    options: { mode: ComposerMode; allowedNames: ReadonlySet<string>; maxCalls: number; cutOff: boolean }
  ): Promise<Map<string, ToolExecutionResult>> {
    const outcomes = new Map<string, ToolExecutionResult>();
    const ready: Array<{
      call: ChatStreamResult["toolCalls"][number];
      tool: CanvasTool;
      input: Record<string, unknown>;
    }> = [];
    let screenshots = 0;
    for (const [index, call] of calls.entries()) {
      if (index >= options.maxCalls) {
        outcomes.set(call.id, {
          ok: false,
          content: `<tool_use_error>Only ${options.maxCalls} tool calls run per round, so this one was skipped. Send it again in your next round.</tool_use_error>`
        });
        continue;
      }
      const prepared = prepareToolCall(call, {
        allowed: options.allowedNames,
        mode: options.mode,
        cutOff: options.cutOff
      });
      if (!prepared.ok) {
        outcomes.set(call.id, { ok: false, content: prepared.content });
        continue;
      }
      if (prepared.tool.name === "screenshot_frame" && ++screenshots > 1) {
        outcomes.set(call.id, {
          ok: false,
          content: "<tool_use_error>Only one frame screenshot runs per round.</tool_use_error>"
        });
        continue;
      }
      ready.push({ call, tool: prepared.tool, input: prepared.input });
    }

    const schedule = new ToolScheduler({ readOnlyTools: READ_ONLY_CANVAS_TOOLS }).schedule(
      ready.map(({ call, tool }) => ({
        toolCallId: call.id,
        toolName: tool.name,
        dependsOn: [],
        readOnly: tool.readOnly,
        destructive: tool.destructive,
        concurrentSafe: tool.readOnly && !toolNeedsApproval(options.mode, tool),
        sideEffectScope: tool.readOnly ? "none" : "canvas"
      }))
    );
    machine.state = machine.scheduleTools(
      ready.map(({ call, input }) => ({ id: call.id, name: call.name, input })),
      schedule
    );
    this.emitTurnState(requestId, `Running ${ready.length} canvas ${ready.length === 1 ? "action" : "actions"}.`);
    for (const call of calls) {
      const outcome = outcomes.get(call.id);
      if (!outcome) continue;
      this.emit({
        type: "studio:toolResult",
        requestId,
        callId: call.id,
        ok: false,
        summary: outcome.content.replace(/<\/?tool_use_error>/g, "").slice(0, 500)
      });
    }

    const byId = new Map(ready.map((entry) => [entry.call.id, entry]));
    for (const group of schedule.parallelGroups) {
      await Promise.all(
        group.map(async (callId) => {
          const entry = byId.get(callId);
          if (!entry) return;
          const outcome = await this.runToolCall(requestId, active, machine, entry, options.mode);
          outcomes.set(callId, outcome);
          machine.state = machine.completeTool(callId, { success: outcome.ok, content: outcome.content });
        })
      );
      if (active.cancelled) throw new ToolTurnError("cancelled", "Generation stopped.");
    }
    if (machine.state.phase === TurnPhase.SchedulingTools) machine.state = machine.startToolExecution();
    return outcomes;
  }

  private async runToolCall(
    requestId: string,
    active: ActiveChat,
    machine: TurnMachine,
    entry: { call: ChatStreamResult["toolCalls"][number]; tool: CanvasTool; input: Record<string, unknown> },
    mode: ComposerMode
  ): Promise<ToolExecutionResult> {
    const { call, tool, input } = entry;
    const argumentsJson = JSON.stringify(input);
    const requiresApproval = toolNeedsApproval(mode, tool);
    this.emit({
      type: "studio:toolProposed",
      requestId,
      callId: call.id,
      name: tool.name,
      summary: tool.description,
      requiresApproval,
      arguments: argumentsJson
    });
    if (requiresApproval) {
      machine.state = machine.requestPermission({
        toolCallId: call.id,
        toolName: tool.name,
        riskLevel: tool.destructive ? "high" : tool.readOnly ? "low" : "medium",
        requestedAt: new Date()
      });
      this.emitTurnState(requestId, `Waiting for approval: ${tool.name}.`);
      const granted = await this.waitForReply(
        this.pendingPermissions,
        requestId,
        call.id,
        active.controller.signal,
        TOOL_PERMISSION_TIMEOUT_MS
      ).catch((error: unknown) => {
        if (error instanceof ToolTurnError && error.code === "timeout") return false;
        throw error;
      });
      machine.state = machine.resolvePermission(call.id, granted ? "allow" : "deny");
      if (!granted) {
        this.emit({ type: "studio:toolResult", requestId, callId: call.id, ok: false, summary: "Declined by user." });
        return { ok: false, content: "The user declined this action. No canvas changes were made." };
      }
    }
    if (machine.state.phase !== TurnPhase.ExecutingTools) machine.state = machine.startToolExecution();
    this.emitTurnState(
      requestId,
      `${requiresApproval ? "Applying approved action" : "Applying canvas action"}: ${tool.name}.`
    );
    this.emit({ type: "studio:toolExecute", requestId, callId: call.id, name: tool.name, arguments: argumentsJson });
    const timeoutMs = toolTimeoutMs(tool.name);
    const execution = await this.waitForReply(
      this.pendingToolResults,
      requestId,
      call.id,
      active.controller.signal,
      timeoutMs
    ).catch((error: unknown): ToolExecutionResult => {
      if (error instanceof ToolTurnError && error.code === "timeout") {
        return {
          ok: false,
          content: `The canvas did not finish ${tool.name} within ${Math.round(timeoutMs / 1000)} seconds. Check the canvas with get_canvas_summary before retrying.`
        };
      }
      throw error;
    });
    const content = execution.content.slice(0, MAX_TOOL_OUTPUT_CHARS);
    this.emit({
      type: "studio:toolResult",
      requestId,
      callId: call.id,
      ok: execution.ok,
      summary: content.slice(0, 500) || (execution.ok ? "Completed." : "The canvas action failed.")
    });
    return { ...execution, content };
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

  /**
   * Load Artificial Analysis scores for every model the account can see.
   *
   * `/models/user` does not reliably include `benchmarks.artificial_analysis`,
   * which leaves the Intelligence chip and its sorts empty. This asks the
   * dedicated `/benchmarks` endpoint (the only documented source that publishes
   * `intelligence_index`) and keys the result by model id. A failure here is
   * non-fatal: the catalog still loads, just without scores.
   */
  private async readBenchmarkScores(
    signal: AbortSignal,
    key?: string
  ): Promise<Map<string, ArtificialAnalysisScores> | null> {
    try {
      const response = await this.request(`${API_ROOT}/benchmarks?source=artificial-analysis`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {})
        },
        redirect: "error",
        signal
      });
      if (response.ok) {
        const payload = await readBoundedJson(response, MAX_CATALOG_BYTES);
        if (!isRecord(payload) || !Array.isArray(payload.data)) return null;
        const scores = new Map<string, ArtificialAnalysisScores>();
        for (const row of payload.data) {
          if (!isRecord(row)) continue;
          const parsed = readArtificialAnalysisRow(row);
          const permaslug = typeof row.model_permaslug === "string" ? row.model_permaslug : "";
          const slug = typeof row.model_slug === "string" ? row.model_slug : "";
          const id = typeof row.id === "string" ? row.id : "";
          if (parsed) {
            if (permaslug) scores.set(permaslug, parsed);
            if (slug) scores.set(slug, parsed);
            if (id) scores.set(id, parsed);
          }
        }
        return scores.size > 0 ? scores : null;
      }
      await response.body?.cancel().catch(() => undefined);
    } catch {
      // Proceed to public models fallback only if /benchmarks request failed
    }

    try {
      const publicResponse = await this.request(`${API_ROOT}/models?output_modalities=all`, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal
      });
      if (!publicResponse.ok) {
        await publicResponse.body?.cancel().catch(() => undefined);
        return null;
      }
      const publicPayload = await readBoundedJson(publicResponse, MAX_CATALOG_BYTES);
      if (!isRecord(publicPayload) || !Array.isArray(publicPayload.data)) return null;
      const scores = new Map<string, ArtificialAnalysisScores>();
      for (const row of publicPayload.data) {
        if (!isRecord(row)) continue;
        const benchmarks = isRecord(row.benchmarks) ? row.benchmarks : null;
        if (!benchmarks) continue;
        const aa = isRecord(benchmarks.artificial_analysis) ? benchmarks.artificial_analysis : null;
        if (!aa) continue;
        const id = typeof row.id === "string" ? row.id : "";
        if (!id) continue;
        const intel = typeof aa.intelligence_index === "number" ? aa.intelligence_index : null;
        const coding = typeof aa.coding_index === "number" ? aa.coding_index : null;
        const agentic = typeof aa.agentic_index === "number" ? aa.agentic_index : null;
        if (intel !== null || coding !== null || agentic !== null) {
          scores.set(id, {
            artificial_analysis: { intelligence_index: intel, coding_index: coding, agentic_index: agentic }
          });
        }
      }
      return scores.size > 0 ? scores : null;
    } catch {
      return null;
    }
  }

  public dispose(): void {
    this.cancelAll();
  }

  /** Reports the turn machine's current phase to the panel. */
  private emitTurnState(requestId: string, text: string): void {
    const machine = this.turns.get(requestId);
    if (!machine) return;
    this.emit({
      type: "studio:turnEvent",
      requestId,
      state: studioTurnState(machine.state.phase),
      text: text.slice(0, 8_000)
    });
  }

  private failTurn(requestId: string, message: string): void {
    const machine = this.turns.get(requestId);
    if (!machine) return;
    machine.state = machine.fail({ type: "turn_error", message, recoverable: true });
    this.emitTurnState(requestId, message);
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
  const topProvider = isRecord(value.top_provider) ? value.top_provider : {};
  const maxCompletionTokens =
    typeof topProvider.max_completion_tokens === "number" &&
    Number.isSafeInteger(topProvider.max_completion_tokens) &&
    topProvider.max_completion_tokens > 0
      ? Math.min(topProvider.max_completion_tokens, 10_000_000)
      : null;
  const promptPrice = priceString(pricing.prompt);
  const completionPrice = priceString(pricing.completion);
  const created =
    typeof value.created === "number" && Number.isFinite(value.created) ? Math.floor(value.created) : undefined;
  const benchmarks = isRecord(value.benchmarks) ? value.benchmarks : {};
  const aa = isRecord(benchmarks.artificial_analysis) ? benchmarks.artificial_analysis : {};
  const intelligence =
    typeof aa.intelligence_index === "number" && Number.isFinite(aa.intelligence_index) ? aa.intelligence_index : null;
  const codingIndex = typeof aa.coding_index === "number" && Number.isFinite(aa.coding_index) ? aa.coding_index : null;
  const agenticIndex =
    typeof aa.agentic_index === "number" && Number.isFinite(aa.agentic_index) ? aa.agentic_index : null;
  const designArenaList = Array.isArray(benchmarks.design_arena) ? benchmarks.design_arena : [];
  const firstDa = isRecord(designArenaList[0]) ? designArenaList[0] : null;
  const designArenaElo =
    firstDa && typeof firstDa.elo === "number" && Number.isFinite(firstDa.elo) ? firstDa.elo : null;

  return {
    id,
    name: boundedString(value.name, 300) || id,
    author: author.slice(0, 120),
    description: boundedString(value.description, 1600),
    inputModalities,
    outputModalities,
    contextLength,
    maxCompletionTokens,
    promptPrice,
    completionPrice,
    supportedParameters,
    textChatEligible: inputModalities.includes("text") && outputModalities.includes("text"),
    created,
    intelligence,
    codingIndex,
    agenticIndex,
    designArenaElo
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

/** True when a raw catalog row already carries Artificial Analysis scores. */
function hasArtificialAnalysis(value: Record<string, unknown>): boolean {
  const benchmarks = isRecord(value.benchmarks) ? value.benchmarks : {};
  return isRecord(benchmarks.artificial_analysis);
}

/** The benchmark block `normalizeModel` reads, keyed by model id. */
interface ArtificialAnalysisScores {
  artificial_analysis: Record<string, unknown>;
}

/** Pull the Artificial Analysis numbers out of one `/benchmarks` row. */
function readArtificialAnalysisRow(row: Record<string, unknown>): ArtificialAnalysisScores | null {
  if (row.source !== "artificial-analysis") return null;
  const permalink = typeof row.model_permaslug === "string" ? row.model_permaslug : "";
  if (!permalink) return null;
  const intelligence = typeof row.intelligence_index === "number" ? row.intelligence_index : null;
  const coding = typeof row.coding_index === "number" ? row.coding_index : null;
  const agentic = typeof row.agentic_index === "number" ? row.agentic_index : null;
  if (intelligence === null && coding === null && agentic === null) return null;
  return {
    artificial_analysis: { intelligence_index: intelligence, coding_index: coding, agentic_index: agentic }
  };
}

class OpenRouterStreamError extends Error {}

/** Reads at most a few kilobytes of an error response, for the 402 "can only afford" hint. */
async function readErrorText(response: Response): Promise<string> {
  try {
    const text = await response.clone().text();
    return text.slice(0, 4_096);
  } catch {
    return "";
  }
}

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
  maxReplyChars: number,
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
          if (reasoningLength > maxReplyChars) throw new OpenRouterStreamError();
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
            if (existing.arguments.length > MAX_TOOL_ARGUMENT_CHARS) throw new OpenRouterStreamError();
          }
          toolCalls.set(tool.index, existing);
          if (toolCalls.size > MAX_STREAMED_TOOL_CALLS) throw new OpenRouterStreamError();
          onTool(tool);
        }
        const delta = extractText(choice.delta.content);
        if (delta) {
          textLength += delta.length;
          if (textLength > maxReplyChars) throw new OpenRouterStreamError();
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
            if (eventSize > MAX_SSE_EVENT_CHARS) throw new OpenRouterStreamError();
            dataLines.push(fieldValue);
          }
        }
        lineBreak = buffer.indexOf("\n");
      }
      if (buffer.length > MAX_SSE_EVENT_CHARS) throw new OpenRouterStreamError();
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
      item.index >= MAX_STREAMED_TOOL_CALLS
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

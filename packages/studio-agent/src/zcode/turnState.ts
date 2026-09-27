// Ported from ZCode (https://github.com/zai-org/ZCode)
// Commit: 29628c9acdb81b703bbd4080c207a0e7ce5e276e
// Upstream file: apps/zcode-cli/packages/core/src/agent/turn-state.ts
// Copyright 2026 Z.AI Co., Ltd. Licensed under the Apache License, Version 2.0; see ./LICENSE.
// Modifications by the Kurva authors:
// - Imports the id and message types from ./contracts.js instead of `@zcode/contracts`.
// - Allows Streaming -> Streaming, so text can keep arriving within one model round.
// - Allows AwaitingPermission -> AggregatingResults, so a round whose only call was declined can continue.
// - Translated comments to English and reformatted to this repository's style.

// ============================================================
// Turn State - Turn state machine types
// ============================================================

import type {
  ModelMessageContent,
  PendingTurnInput,
  SessionId,
  ModelToolCall as ToolCall,
  ToolCallId,
  TraceId,
  TurnId
} from "./contracts.js";

// Re-export ToolCall for consumers of this module
export type { ModelToolCall as ToolCall } from "./contracts.js";

// Note: ModelMessage is defined locally to avoid conflicts with contracts' ModelMessage
// which uses ToolCallPayload[] instead of ModelToolCall[]

// -----------------------------------------------
// Turn Phase
// -----------------------------------------------

export const TurnPhase = {
  Idle: "idle",
  ProcessingInput: "processing_input",
  AwaitingModelResponse: "awaiting_model_response",
  Streaming: "streaming",
  SchedulingTools: "scheduling_tools",
  ExecutingTools: "executing_tools",
  AggregatingResults: "aggregating_results",
  AwaitingPermission: "awaiting_permission",
  Completing: "completing",
  Error: "error"
} as const;

export type TurnPhase = (typeof TurnPhase)[keyof typeof TurnPhase];

// -----------------------------------------------
// Turn State
// -----------------------------------------------

export interface TurnState {
  id: TurnId;
  sessionId: SessionId;
  turnNumber: number;
  phase: TurnPhase;
  traceId: TraceId;
  input: string;
  attachments?: TurnAttachment[] | undefined;
  modelRequest?: ModelRequestState | undefined;
  streamingContent: string;
  finalResponse?: string | undefined;
  toolCalls: ToolCallState[];
  toolResults: ToolResultState[];
  scheduledTools: ToolScheduleState;
  pendingInputs: PendingTurnInput[];
  acceptsPendingInput: boolean;
  pendingPermissions: PermissionRequestState[];
  resolvedPermissions: PermissionResultState[];
  resultType: TurnResultType;
  error?: TurnErrorState | undefined;
  startedAt: Date;
  completedAt?: Date | undefined;
}

// -----------------------------------------------
// Sub-states
// -----------------------------------------------

export interface ModelRequestState {
  model: string;
  messages: ModelMessage[];
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  stopReason?: string | undefined;
  usage?: TokenUsageState | undefined;
}

// ModelMessage for turn state - uses ToolCall from contracts
export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: ModelMessageContent;
  toolCalls?: ToolCall[] | undefined;
  toolCallId?: string | undefined;
}

export interface TokenUsageState {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ToolCallState {
  id: ToolCallId;
  name: string;
  input: unknown;
  status: ToolCallStateStatus;
  scheduledAt?: Date | undefined;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  result?: ToolResultState | undefined;
}

export type ToolCallStateStatus =
  | "scheduled"
  | "waiting_permission"
  | "permission_denied"
  | "running"
  | "completed"
  | "failed";

export interface ToolResultState {
  success: boolean;
  content: ModelMessageContent;
  error?: TurnErrorState | undefined;
}

export interface ToolScheduleState {
  items: ToolScheduleItem[];
  parallelGroups: ToolCallId[][];
  executionOrder: ToolCallId[];
}

export interface ToolScheduleItem {
  toolCallId: ToolCallId;
  dependencies: ToolCallId[];
  canRunParallel: boolean;
}

export interface PermissionRequestState {
  toolCallId: ToolCallId;
  toolName: string;
  riskLevel: string;
  requestedAt: Date;
}

export interface PermissionResultState {
  toolCallId: ToolCallId;
  decision: PermissionDecision;
  reason?: string | undefined;
  modifiedInput?: unknown | undefined;
  resolvedAt: Date;
}

export type PermissionDecision = "allow" | "deny" | "escalate" | "modify";

export type TurnResultType =
  | "success"
  // "cancelled": the user stopped the turn. It ends normally, not as an error.
  | "cancelled"
  | "error_max_turns"
  | "error_max_budget"
  | "error_during_execution"
  | "error_max_tool_calls";

export interface TurnErrorState {
  type: string;
  message: string;
  recoverable: boolean;
}

export interface TurnAttachment {
  type: "file" | "image" | "video" | "pdf" | "url";
  path?: string | undefined;
  content?: string | undefined;
  /** A long paste saved as a temporary attachment. */
  sourceKind?: "clipboard-text" | undefined;
  // Display metadata only; it is not used to read the content.
  filename?: string | undefined;
  mimeType?: string | undefined;
  sizeBytes?: number | undefined;
}

// -----------------------------------------------
// Turn State Factory
// -----------------------------------------------

export function createTurnState(
  id: TurnId,
  sessionId: SessionId,
  turnNumber: number,
  traceId: TraceId,
  input: string,
  attachments?: TurnAttachment[]
): TurnState {
  return {
    id,
    sessionId,
    turnNumber,
    phase: TurnPhase.Idle,
    traceId,
    input,
    attachments,
    streamingContent: "",
    toolCalls: [],
    toolResults: [],
    scheduledTools: {
      items: [],
      parallelGroups: [],
      executionOrder: []
    },
    pendingInputs: [],
    acceptsPendingInput: true,
    pendingPermissions: [],
    resolvedPermissions: [],
    resultType: "success",
    startedAt: new Date()
  };
}

// -----------------------------------------------
// Phase Predicates
// -----------------------------------------------

export function isTerminalPhase(phase: TurnPhase): boolean {
  return phase === TurnPhase.Completing || phase === TurnPhase.Error;
}

export function isWaitingPhase(phase: TurnPhase): boolean {
  return (
    phase === TurnPhase.AwaitingModelResponse ||
    phase === TurnPhase.AwaitingPermission ||
    phase === TurnPhase.ExecutingTools
  );
}

export function canTransitionTo(current: TurnPhase, next: TurnPhase): boolean {
  const validTransitions: Record<TurnPhase, TurnPhase[]> = {
    [TurnPhase.Idle]: [TurnPhase.ProcessingInput],
    [TurnPhase.ProcessingInput]: [TurnPhase.AwaitingModelResponse, TurnPhase.Completing],
    [TurnPhase.AwaitingModelResponse]: [TurnPhase.Streaming, TurnPhase.Completing, TurnPhase.Error],
    [TurnPhase.Streaming]: [
      TurnPhase.Streaming,
      TurnPhase.SchedulingTools,
      TurnPhase.AggregatingResults,
      TurnPhase.Completing,
      TurnPhase.Error
    ],
    [TurnPhase.SchedulingTools]: [TurnPhase.ExecutingTools, TurnPhase.AwaitingPermission, TurnPhase.Error],
    [TurnPhase.ExecutingTools]: [TurnPhase.AggregatingResults, TurnPhase.AwaitingPermission, TurnPhase.Error],
    [TurnPhase.AggregatingResults]: [
      TurnPhase.AwaitingModelResponse,
      TurnPhase.SchedulingTools,
      TurnPhase.Completing,
      TurnPhase.Error
    ],
    [TurnPhase.AwaitingPermission]: [TurnPhase.ExecutingTools, TurnPhase.AggregatingResults, TurnPhase.Error],
    [TurnPhase.Completing]: [TurnPhase.Idle],
    [TurnPhase.Error]: [TurnPhase.Idle]
  };

  return validTransitions[current]?.includes(next) ?? false;
}

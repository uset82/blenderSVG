// Kurva stand-ins for the few `@zcode/contracts` helpers that the ported ZCode files use.
// This file is written for Kurva and is not a port: ZCode's own contracts package depends on Zod and
// its runtime, so the ports import these small, browser-safe equivalents instead.

export type ToolCallId = string;
export type TurnId = string;
export type SessionId = string;
export type TraceId = string;

export type ModelMessagePart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ModelMessageContent = string | readonly ModelMessagePart[];

export function modelMessageContentToText(content: ModelMessageContent): string {
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** A tool call as the model sent it, with its arguments already parsed. */
export interface ModelToolCall {
  id: ToolCallId;
  name: string;
  input: unknown;
}

/** Input that arrives while a turn is running. Kurva does not queue input yet. */
export interface PendingTurnInput {
  text: string;
  receivedAt: Date;
}

/** Side effects a tool may have, used by the scheduler to decide what can run together. */
export type ModelToolSideEffectScope = "none" | "canvas" | "external";

export const CoreErrorType = {
  InvalidTurnPhase: "invalid_turn_phase",
  InvalidStateTransition: "invalid_state_transition"
} as const;
export type CoreErrorType = (typeof CoreErrorType)[keyof typeof CoreErrorType];

export class CoreError extends Error {
  public constructor(
    public readonly type: CoreErrorType,
    message: string,
    public readonly context: Record<string, unknown> = {},
    public readonly recoverable = false
  ) {
    super(message);
    this.name = "CoreError";
  }
}

export function createCoreError(
  type: CoreErrorType,
  message: string,
  options: { context?: Record<string, unknown>; recoverable?: boolean } = {}
): CoreError {
  return new CoreError(type, message, options.context ?? {}, options.recoverable ?? false);
}

export function createTurnId(): TurnId {
  return `turn_${randomUuid()}`;
}

/** `crypto.randomUUID`, reached through globalThis because this package does not load the DOM types. */
export function randomUuid(): string {
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

// Ported from ZCode (https://github.com/zai-org/ZCode)
// Commit: 29628c9acdb81b703bbd4080c207a0e7ce5e276e
// Upstream file: apps/zcode-cli/packages/adapters/src/model/tool-input-normalization.ts
// Copyright 2026 Z.AI Co., Ltd. Licensed under the Apache License, Version 2.0; see ./LICENSE.
// Modifications by the Kurva authors:
// - Declared a minimal `ToolInputLogger` instead of importing ZCode's `Logger`.
// - Added the "openrouter" source and exported the options type.
// - Translated comments to English and reformatted to this repository's style.

/** The subset of ZCode's logger this module calls. */
export interface ToolInputLogger {
  warn(message: string, details: Record<string, unknown>): void;
}

export interface NormalizeModelToolInputOptions {
  logger?: ToolInputLogger;
  source: "generateText" | "streamText" | "openrouter";
  toolName?: string;
}

export function normalizeModelToolInput(input: unknown, options: NormalizeModelToolInputOptions): unknown {
  if (input === undefined) {
    return {};
  }
  if (input === null) {
    // A JSON "null" parsed upstream is recovered the same way as the string "null".
    warnAndRecoverMalformedToolInput(new TypeError("Model tool input must not be null"), options, {
      inputType: "null"
    });
    return {};
  }
  if (typeof input !== "string") {
    return input;
  }
  if (input.length === 0) {
    return {};
  }

  try {
    const normalizedInput = JSON.parse(stripByteOrderMark(input));
    if (normalizedInput === null) {
      // JSON null is valid JSON but not valid tool input. Like malformed JSON, it becomes an empty
      // object and the tool's schema decides what to report.
      throw new TypeError("Model tool input must not be null");
    }
    return normalizedInput;
  } catch (error) {
    warnAndRecoverMalformedToolInput(error, options, {
      inputLength: input.length
    });
    // Throwing here would turn one bad argument into a failed model request. Recover to an empty
    // object and let the tool's schema report the problem to the model instead.
    return {};
  }
}

function warnAndRecoverMalformedToolInput(
  error: unknown,
  options: NormalizeModelToolInputOptions,
  inputContext: { inputLength: number } | { inputType: "null" }
): void {
  options.logger?.warn("Model tool input JSON normalization failed", {
    event: "model.tool_input.normalize_failed",
    ...inputContext,
    module: "adapters.model.tool-input-normalization",
    parseErrorType: parseErrorType(error),
    recovery: "empty_object",
    source: options.source,
    status: "failed",
    toolName: options.toolName
  });
}

function stripByteOrderMark(input: string): string {
  return input.startsWith("\uFEFF") ? input.slice(1) : input;
}

function parseErrorType(error: unknown): string {
  return error instanceof Error && error.name ? error.name : typeof error;
}

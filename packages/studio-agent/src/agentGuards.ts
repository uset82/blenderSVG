import { canvasTool } from "./canvasTools.js";
import { MAX_TOOL_ARGUMENT_CHARS } from "./limits.js";
import { toolTimeoutMs } from "./toolPolicy.js";
import { createInputValidationModelContent } from "./zcode/inputValidationModelContent.js";
import { validateJsonSchemaValue } from "./zcode/jsonSchema.js";

/** Canvas text is quoted data. It is never treated as a tool name. */
export function quotedCanvasText(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return `Untrusted canvas text: “${flat}”`;
}

export function toolNameFromCanvasText(_text: string): null {
  return null;
}

export function invalidToolArguments(name: string, args: Record<string, unknown>): string | null {
  const tool = canvasTool(name);
  if (!tool) return "Unknown tool.";
  for (const key of tool.parameters.required) {
    if (args[key] === undefined || args[key] === "") return `Missing ${key}.`;
  }
  return null;
}

export type ParsedCanvasToolArguments =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

/** Parses provider supplied JSON against the same strict schema advertised to OpenRouter. */
export function parseCanvasToolArguments(name: string, json: string): ParsedCanvasToolArguments {
  const tool = canvasTool(name);
  if (!tool) return { success: false, error: "Unknown canvas tool." };
  if (json.length > MAX_TOOL_ARGUMENT_CHARS) return { success: false, error: "Tool arguments exceed the size limit." };
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    return { success: false, error: "Tool arguments are not valid JSON." };
  }
  if (!isRecord(value)) return { success: false, error: "Tool arguments must be a JSON object." };
  const validation = validateJsonSchemaValue(value, tool.parameters as unknown as Record<string, unknown>);
  if (!validation.valid) {
    const content = createInputValidationModelContent(tool.name, validation.issues);
    return { success: false, error: content.replace(/^<tool_use_error>|<\/tool_use_error>$/g, "") };
  }
  return { success: true, data: value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toolCallTimedOut(name: string, elapsedMs: number): boolean {
  return elapsedMs > toolTimeoutMs(name);
}

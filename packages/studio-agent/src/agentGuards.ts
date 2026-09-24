import { type CanvasToolParameter, canvasTool } from "./canvasTools.js";
import { toolTimeoutMs } from "./turnMachine.js";

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
  if (json.length > 16_384) return { success: false, error: "Tool arguments exceed the size limit." };
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    return { success: false, error: "Tool arguments are not valid JSON." };
  }
  if (!isRecord(value)) return { success: false, error: "Tool arguments must be a JSON object." };
  const error = validateObject(value, tool.parameters.properties, tool.parameters.required);
  return error ? { success: false, error } : { success: true, data: value };
}

function validateObject(
  value: Record<string, unknown>,
  properties: Record<string, CanvasToolParameter>,
  required: string[]
): string | null {
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(properties, key)) return `Unexpected argument: ${key}.`;
  }
  for (const key of required) {
    const item = value[key];
    if (item === undefined || item === null || item === "") return `Missing ${key}.`;
  }
  for (const [key, item] of Object.entries(value)) {
    const schema = properties[key];
    if (!schema) return `Unexpected argument: ${key}.`;
    const error = validateValue(item, schema, key);
    if (error) return error;
  }
  return null;
}

function validateValue(value: unknown, schema: CanvasToolParameter, label: string): string | null {
  if (schema.type === "string") {
    if (typeof value !== "string") return `${label} must be text.`;
    if (schema.minLength !== undefined && value.length < schema.minLength) return `${label} is too short.`;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${label} is too long.`;
    if (schema.enum && !schema.enum.includes(value)) return `${label} is not an allowed value.`;
    return null;
  }
  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return `${label} must be a finite number.`;
    if (schema.minimum !== undefined && value < schema.minimum) return `${label} is below the allowed range.`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${label} exceeds the allowed range.`;
    return null;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return `${label} must be a list.`;
    if (schema.minItems !== undefined && value.length < schema.minItems) return `${label} has too few items.`;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${label} has too many items.`;
    if (!schema.items) return null;
    for (const [index, item] of value.entries()) {
      if (schema.items.type === "object") {
        if (!isRecord(item)) return `${label}[${index}] must be an object.`;
        const error = validateObject(item, schema.items.properties ?? {}, schema.items.required ?? []);
        if (error) return `${label}[${index}]: ${error}`;
      } else {
        const error = validateValue(item, schema.items, `${label}[${index}]`);
        if (error) return error;
      }
    }
    return null;
  }
  if (schema.type === "object") {
    if (!isRecord(value)) return `${label} must be an object.`;
    return validateObject(value, schema.properties ?? {}, schema.required ?? []);
  }
  return `Unsupported schema for ${label}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toolCallTimedOut(name: string, elapsedMs: number): boolean {
  return elapsedMs > toolTimeoutMs(name);
}

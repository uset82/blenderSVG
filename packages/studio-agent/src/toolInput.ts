import { type CanvasTool, canvasTool } from "./canvasTools.js";
import { MAX_TOOL_ARGUMENT_CHARS } from "./limits.js";
import { createInputValidationModelContent } from "./zcode/inputValidationModelContent.js";
import { validateJsonSchemaValue } from "./zcode/jsonSchema.js";
import { normalizeModelToolInput } from "./zcode/toolInputNormalization.js";

export type PreparedToolCall =
  | { ok: true; tool: CanvasTool; input: Record<string, unknown> }
  | { ok: false; content: string };

function toolError(message: string): { ok: false; content: string } {
  return { ok: false, content: `<tool_use_error>${message}</tool_use_error>` };
}

/**
 * Checks one model tool call before it reaches the canvas. Every problem becomes a tool result the
 * model can read and correct, instead of ending the turn.
 */
export function prepareToolCall(
  call: { name: string; arguments: string },
  options: { allowed: ReadonlySet<string>; mode: string; cutOff?: boolean }
): PreparedToolCall {
  const tool = canvasTool(call.name);
  const available = [...options.allowed].join(", ") || "none";
  if (!tool) return toolError(`There is no tool named "${call.name.slice(0, 80)}". Available tools: ${available}.`);
  if (!options.allowed.has(tool.name)) {
    return toolError(`${tool.name} is not available in ${options.mode} mode. Available tools: ${available}.`);
  }
  if (call.arguments.length > MAX_TOOL_ARGUMENT_CHARS) {
    return toolError(
      `${tool.name} arguments were ${call.arguments.length} characters; the limit is ${MAX_TOOL_ARGUMENT_CHARS}. ` +
        "Create the frame with its first sections, then add the rest with patch_design_frame."
    );
  }

  let malformed = false;
  const input = normalizeModelToolInput(call.arguments, {
    source: "openrouter",
    toolName: tool.name,
    logger: {
      warn: () => {
        malformed = true;
      }
    }
  });
  if (malformed && call.arguments.trim() && call.arguments.trim() !== "null") {
    return toolError(
      options.cutOff
        ? `${tool.name} arguments were cut off because your reply reached its output limit, so nothing was applied. ` +
            "Send smaller calls: create the frame with its first sections, then add the rest with patch_design_frame."
        : `${tool.name} arguments were not valid JSON, so nothing was applied. Send the call again with one complete JSON object.`
    );
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return toolError(`${tool.name} arguments must be a JSON object.`);
  }

  const validation = validateJsonSchemaValue(input, tool.parameters as unknown as Record<string, unknown>);
  if (!validation.valid) return { ok: false, content: createInputValidationModelContent(tool.name, validation.issues) };
  return { ok: true, tool, input: input as Record<string, unknown> };
}

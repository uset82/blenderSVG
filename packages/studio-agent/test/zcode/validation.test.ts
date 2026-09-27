import { describe, expect, it } from "vitest";
import { canvasTool } from "../../src/canvasTools.js";
import { createInputValidationModelContent } from "../../src/zcode/inputValidationModelContent.js";
import { validateJsonSchemaValue } from "../../src/zcode/jsonSchema.js";
import { ToolScheduler } from "../../src/zcode/scheduler.js";
import { normalizeModelToolInput } from "../../src/zcode/toolInputNormalization.js";

const schema = (name: string) => canvasTool(name)?.parameters as unknown as Record<string, unknown>;

describe("ZCode JSON Schema validation against the canvas tools", () => {
  it("accepts valid arguments and reports missing, unexpected and wrong-typed ones", () => {
    expect(validateJsonSchemaValue({ name: "Landing", html: "<p>x</p>" }, schema("create_design_frame")).valid).toBe(
      true
    );
    const result = validateJsonSchemaValue({ name: 3, script: "x" }, schema("create_design_frame"));
    expect(result.valid).toBe(false);
    const content = createInputValidationModelContent("create_design_frame", result.issues);
    expect(content).toMatch(
      /^<tool_use_error>InputValidationError: create_design_frame failed due to the following issues:/
    );
    expect(content).toContain("The parameter `name` type is expected as `string` but provided as `number`");
    expect(content).toContain("The required parameter `html` is missing");
    expect(content).toContain("An unexpected parameter `script` was provided");
  });

  it("reports nested array items and size bounds with their path", () => {
    const result = validateJsonSchemaValue(
      { frameId: "shape:a", edits: [{ find: "", replace: "x" }] },
      schema("patch_design_frame")
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "too_small", path: ["edits", 0, "find"] });
    const tooWide = validateJsonSchemaValue(
      { name: "X", html: "<p>x</p>", width: 90_000 },
      schema("create_design_frame")
    );
    expect(createInputValidationModelContent("create_design_frame", tooWide.issues)).toContain("Too big");
  });
});

describe("ZCode tool input normalization", () => {
  it("parses JSON, strips a byte-order mark, and recovers malformed input to an empty object", () => {
    const warnings: string[] = [];
    const logger = { warn: (message: string) => warnings.push(message) };
    expect(normalizeModelToolInput('﻿{"a":1}', { source: "openrouter", logger })).toEqual({ a: 1 });
    expect(normalizeModelToolInput("", { source: "openrouter", logger })).toEqual({});
    expect(warnings).toEqual([]);
    expect(normalizeModelToolInput('{"html":"<main', { source: "openrouter", logger })).toEqual({});
    expect(normalizeModelToolInput("null", { source: "openrouter", logger })).toEqual({});
    expect(warnings).toHaveLength(2);
  });
});

describe("ZCode tool scheduler", () => {
  it("groups read-only calls and runs changes on their own, keeping the model's order", () => {
    const scheduler = new ToolScheduler({ readOnlyTools: new Set(["get_canvas_summary", "get_design_frame"]) });
    const schedule = scheduler.schedule([
      { toolCallId: "r1", toolName: "get_canvas_summary", dependsOn: [] },
      { toolCallId: "r2", toolName: "get_design_frame", dependsOn: [] },
      { toolCallId: "w1", toolName: "patch_design_frame", dependsOn: [], readOnly: false, sideEffectScope: "canvas" },
      { toolCallId: "r3", toolName: "get_canvas_summary", dependsOn: [] }
    ]);
    expect(schedule.parallelGroups).toEqual([["r1", "r2"], ["w1"], ["r3"]]);
    expect(schedule.executionOrder).toEqual(["r1", "r2", "w1", "r3"]);
  });
});

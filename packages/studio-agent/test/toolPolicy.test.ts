import { describe, expect, it } from "vitest";
import { canvasTool } from "../src/canvasTools.js";
import { prepareToolCall } from "../src/toolInput.js";
import { affordableCompletionTokens, completionTokenBudget, toolNeedsApproval, turnLimits } from "../src/toolPolicy.js";

const tool = (name: string) => {
  const found = canvasTool(name);
  if (!found) throw new Error(name);
  return found;
};

describe("tool policy", () => {
  it("applies Design changes without approval, except screenshots", () => {
    expect(toolNeedsApproval("auto", tool("create_design_frame"))).toBe(false);
    expect(toolNeedsApproval("auto", tool("get_canvas_summary"))).toBe(false);
    expect(toolNeedsApproval("auto", tool("screenshot_frame"))).toBe(true);
    expect(toolNeedsApproval("plan", tool("get_design_frame"))).toBe(false);
    expect(toolNeedsApproval("build", tool("get_design_frame"))).toBe(false);
    expect(toolNeedsApproval("build", tool("patch_design_frame"))).toBe(true);
  });

  it("gives design turns more rounds, calls and reply room than chat turns", () => {
    expect(turnLimits("auto")).toMatchObject({ maxToolRounds: 8, maxCallsPerRound: 8, maxReplyChars: 200_000 });
    expect(turnLimits("plan")).toMatchObject({ maxToolRounds: 4, maxCallsPerRound: 6 });
  });

  it("asks for the model's output budget, clamped to 4k–32k and half the context", () => {
    expect(completionTokenBudget({ maxCompletionTokens: 64_000, contextLength: 200_000 })).toBe(32_000);
    expect(completionTokenBudget({ maxCompletionTokens: null, contextLength: 200_000 })).toBe(16_000);
    expect(completionTokenBudget({ maxCompletionTokens: 2_048, contextLength: 200_000 })).toBe(4_096);
    expect(completionTokenBudget({ maxCompletionTokens: 64_000, contextLength: 8_000 })).toBe(4_000);
  });

  it("reads the affordable budget from a 402 and ignores other errors", () => {
    expect(affordableCompletionTokens("…but can only afford 9000.", 32_000)).toBe(8_744);
    expect(affordableCompletionTokens("…but can only afford 900.", 32_000)).toBeNull();
    expect(affordableCompletionTokens("Insufficient credits", 32_000)).toBeNull();
  });
});

describe("tool call preparation", () => {
  const allowed = new Set(["get_canvas_summary", "create_design_frame"]);

  it("passes a valid call through with parsed input", () => {
    expect(prepareToolCall({ name: "get_canvas_summary", arguments: "{}" }, { allowed, mode: "auto" })).toMatchObject({
      ok: true,
      input: {}
    });
  });

  it("turns every problem into a tool error the model can read", () => {
    const unknown = prepareToolCall({ name: "draw", arguments: "{}" }, { allowed, mode: "auto" });
    expect(unknown).toEqual({ ok: false, content: expect.stringContaining('no tool named "draw"') });
    const hidden = prepareToolCall({ name: "delete_shapes", arguments: "{}" }, { allowed, mode: "auto" });
    expect(hidden).toEqual({ ok: false, content: expect.stringContaining("not available in auto mode") });
    const broken = prepareToolCall(
      { name: "create_design_frame", arguments: '{"name":"x","html":"<p' },
      { allowed, mode: "auto" }
    );
    expect(broken).toEqual({ ok: false, content: expect.stringContaining("not valid JSON") });
    const cut = prepareToolCall(
      { name: "create_design_frame", arguments: '{"name":"x","html":"<p' },
      { allowed, mode: "auto", cutOff: true }
    );
    expect(cut).toEqual({ ok: false, content: expect.stringContaining("cut off") });
    const missing = prepareToolCall(
      { name: "create_design_frame", arguments: '{"name":"x"}' },
      { allowed, mode: "auto" }
    );
    expect(missing).toEqual({ ok: false, content: expect.stringContaining("`html` is missing") });
  });
});

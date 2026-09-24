import { describe, expect, it } from "vitest";
import { applyToolDelta, createTurn, reduceTurn, toolTimeoutMs } from "../src/turnMachine.js";

describe("studio turn machine", () => {
  it("walks from input through a text reply to done", () => {
    let turn = createTurn();
    turn = reduceTurn(turn, { type: "start" });
    turn = reduceTurn(turn, { type: "text", text: "Hello" });
    turn = reduceTurn(turn, { type: "stream-end" });
    expect(turn.state).toBe("done");
    expect(turn.text).toBe("Hello");
  });

  it("asks for permission before a tool runs and stops when cancelled", () => {
    let turn = reduceTurn(createTurn(), { type: "start" });
    turn = reduceTurn(turn, { type: "tool-delta", index: 0, id: "call-1", name: "get_selection" });
    turn = reduceTurn(turn, { type: "stream-end" });
    expect(turn.state).toBe("schedule-tools");
    turn = reduceTurn(turn, { type: "start" });
    expect(turn.state).toBe("await-permission");
    turn = reduceTurn(turn, { type: "permission", granted: true });
    expect(turn.state).toBe("execute");
    turn = reduceTurn(turn, { type: "cancel" });
    expect(turn.error).toBe("The turn was cancelled.");
  });

  it("stops after the tool round limit", () => {
    let turn = reduceTurn(createTurn(1), { type: "start" }, 1);
    turn = reduceTurn(turn, { type: "tool-delta", index: 0, name: "align" }, 1);
    turn = reduceTurn(turn, { type: "stream-end" }, 1);
    turn = reduceTurn(turn, { type: "start" }, 1);
    turn = reduceTurn(turn, { type: "permission", granted: true }, 1);
    turn = reduceTurn(turn, { type: "tool-result", ok: true }, 1);
    turn = reduceTurn(turn, { type: "start" }, 1);
    turn = reduceTurn(turn, { type: "tool-delta", index: 0, name: "align" }, 1);
    turn = reduceTurn(turn, { type: "stream-end" }, 1);
    expect(turn.error).toBe("The turn reached its tool limit.");
  });

  it("assembles streamed tool call fragments and assigns timeouts", () => {
    const tools = applyToolDelta(applyToolDelta([], { index: 0, id: "call-1", name: "get_" }), {
      index: 0,
      name: "selection",
      arguments: "{}"
    });
    expect(tools[0]).toMatchObject({ id: "call-1", name: "get_selection" });
    expect(toolTimeoutMs("screenshot_frame")).toBe(15_000);
    expect(toolTimeoutMs("get_selection")).toBe(8_000);
  });
});

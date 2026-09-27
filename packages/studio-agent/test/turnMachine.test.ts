import { describe, expect, it } from "vitest";
import { studioTurnState, TurnMachine, TurnPhase, toolTimeoutMs } from "../src/turnMachine.js";

function started() {
  const machine = TurnMachine.create("session", 1, "Design a landing page", "trace");
  machine.state = machine.start();
  return machine;
}

describe("agent turn machine (ZCode port)", () => {
  it("walks from input through a text reply to done", () => {
    const machine = started();
    machine.state = machine.startModelRequest("example/designer", []);
    machine.state = machine.receiveModelResponse("");
    machine.state = machine.addStreamingContent("Hel");
    machine.state = machine.addStreamingContent("lo");
    machine.state = machine.complete(machine.state.streamingContent);
    expect(machine.state.phase).toBe(TurnPhase.Completing);
    expect(machine.state.finalResponse).toBe("Hello");
    expect(studioTurnState(machine.state.phase)).toBe("done");
  });

  it("asks for permission, runs an allowed call, and continues after a failed one", () => {
    const machine = started();
    machine.state = machine.startModelRequest("example/designer", []);
    machine.state = machine.receiveModelResponse("");
    machine.state = machine.scheduleTools(
      [
        { id: "write", name: "create_design_frame", input: {} },
        { id: "read", name: "get_canvas_summary", input: {} }
      ],
      { items: [], parallelGroups: [["write"], ["read"]], executionOrder: ["write", "read"] }
    );
    machine.state = machine.requestPermission({
      toolCallId: "write",
      toolName: "create_design_frame",
      riskLevel: "medium",
      requestedAt: new Date()
    });
    expect(studioTurnState(machine.state.phase)).toBe("await-permission");
    machine.state = machine.resolvePermission("write", "allow");
    machine.state = machine.startToolExecution();
    expect(machine.state.phase).toBe(TurnPhase.ExecutingTools);
    machine.state = machine.completeTool("write", { success: false, content: "The canvas could not apply this." });
    machine.state = machine.completeTool("read", { success: true, content: "{}" });
    machine.state = machine.aggregateResults();
    // Kurva's change: a failed call goes back to the model instead of ending the turn.
    expect(machine.getNextPhase()).toBe(TurnPhase.AwaitingModelResponse);
    machine.state = machine.startModelRequest("example/designer", []);
    expect(studioTurnState(machine.state.phase)).toBe("model");
  });

  it("rejects an impossible transition and records a failure", () => {
    const machine = started();
    expect(() => machine.aggregateResults()).toThrow(/Cannot transition/);
    machine.state = machine.fail({ type: "turn_error", message: "Generation stopped.", recoverable: true });
    expect(studioTurnState(machine.state.phase)).toBe("error");
  });

  it("gives design tools longer to apply than simple canvas edits", () => {
    expect(toolTimeoutMs("screenshot_frame")).toBe(15_000);
    expect(toolTimeoutMs("create_design_frame")).toBe(20_000);
    expect(toolTimeoutMs("get_selection")).toBe(8_000);
  });
});

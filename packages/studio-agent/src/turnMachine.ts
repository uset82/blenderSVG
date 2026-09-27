import type { TurnPhase } from "./zcode/turnState.js";

export { toolTimeoutMs } from "./toolPolicy.js";
export { type ToolSchedule, ToolScheduler } from "./zcode/scheduler.js";
/**
 * The agent turn runs on ZCode's turn machine (ported under ./zcode). This module maps its phases onto
 * the states the Studio protocol reports to the panel.
 */
export { TurnMachineImpl as TurnMachine } from "./zcode/turnMachine.js";
export { isTerminalPhase, TurnPhase, type TurnState } from "./zcode/turnState.js";

export type StudioTurnState =
  | "input"
  | "model"
  | "streaming"
  | "schedule-tools"
  | "await-permission"
  | "execute"
  | "aggregate"
  | "done"
  | "error";

const STUDIO_STATES: Record<TurnPhase, StudioTurnState> = {
  idle: "input",
  processing_input: "input",
  awaiting_model_response: "model",
  streaming: "streaming",
  scheduling_tools: "schedule-tools",
  executing_tools: "execute",
  aggregating_results: "aggregate",
  awaiting_permission: "await-permission",
  completing: "done",
  error: "error"
};

export function studioTurnState(phase: TurnPhase): StudioTurnState {
  return STUDIO_STATES[phase];
}

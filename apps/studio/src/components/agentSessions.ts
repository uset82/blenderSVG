export type AgentSessionStatus = "running" | "finished" | "idle";

export function sessionPillStatus(isActive: boolean, chatStatus: string | null): AgentSessionStatus {
  if (!isActive) return "idle";
  if (chatStatus === "streaming" || chatStatus === "stopping") return "running";
  if (chatStatus === "complete") return "finished";
  return "idle";
}

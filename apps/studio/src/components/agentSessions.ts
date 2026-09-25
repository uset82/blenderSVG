export type AgentSessionStatus = "running" | "finished" | "idle";

export function sessionPillStatus(isActive: boolean, chatStatus: string | null): AgentSessionStatus {
  if (!isActive) return "idle";
  if (chatStatus === "streaming" || chatStatus === "stopping") return "running";
  if (chatStatus === "complete") return "finished";
  return "idle";
}

export function stopRunningReply(
  chatStatus: string | null,
  cancel: (requestId: string) => void,
  requestId: string
): boolean {
  if (chatStatus !== "streaming" && chatStatus !== "stopping") return false;
  cancel(requestId);
  return true;
}

export function chatRunStatusLabel(status: "streaming" | "stopping" | "complete" | "error" | undefined): string | null {
  if (status === "streaming") return "Generating…";
  if (status === "stopping") return "Canceling…";
  if (status === "complete") return "Reply finished.";
  if (status === "error") return "The reply failed.";
  return null;
}

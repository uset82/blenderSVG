const TIME_KEY = "blendersvg-studio-canvas-times-v1";

export interface CanvasTimes {
  createdAt: string;
  updatedAt: string;
}

export function formatEditedLabel(value: string, now = Date.now()): string {
  const edited = Date.parse(value);
  if (!Number.isFinite(edited)) return "Edit time unavailable";
  const minutes = Math.floor(Math.max(0, now - edited) / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(edited).toLocaleDateString()}`;
}

export function readCanvasTimes(): Record<string, CanvasTimes> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TIME_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const times: Record<string, CanvasTimes> = {};
    for (const [id, entry] of Object.entries(value)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.createdAt === "string" && typeof candidate.updatedAt === "string") {
        times[id] = { createdAt: candidate.createdAt, updatedAt: candidate.updatedAt };
      }
    }
    return times;
  } catch {
    return {};
  }
}

export function rememberCanvasTimes(times: Record<string, CanvasTimes>): void {
  try {
    window.localStorage.setItem(TIME_KEY, JSON.stringify(times));
  } catch {
    // Edit times stay in memory when browser storage is unavailable.
  }
}

export function stampCanvasTimes(
  times: Record<string, CanvasTimes>,
  pages: ReadonlyArray<{ id: string }>,
  currentId: string,
  touchCurrent: boolean,
  now = new Date().toISOString()
): Record<string, CanvasTimes> {
  const next = { ...times };
  for (const page of pages) {
    const previous = next[page.id];
    next[page.id] = {
      createdAt: previous?.createdAt ?? now,
      updatedAt: touchCurrent && page.id === currentId ? now : (previous?.updatedAt ?? previous?.createdAt ?? now)
    };
  }
  return next;
}

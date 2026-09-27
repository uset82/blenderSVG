/**
 * A message waiting to be sent, kept across the OpenRouter sign-in redirect. Stored in this tab's
 * sessionStorage for 30 minutes and read once.
 */
export interface PendingAgentSend {
  projectId: string;
  text: string;
  skill?: string;
  savedAt: number;
}

const KEY = "kurva-pending-agent-send";
const MAX_AGE_MS = 30 * 60_000;

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingAgentSend(pending: Omit<PendingAgentSend, "savedAt">, now = Date.now()): void {
  try {
    storage()?.setItem(KEY, JSON.stringify({ ...pending, text: pending.text.slice(0, 12_000), savedAt: now }));
  } catch {
    // Without storage the draft still stays in the composer for this page.
  }
}

export function clearPendingAgentSend(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Returns and removes the pending send for this project, if it is recent and well formed. */
export function takePendingAgentSend(projectId: string, now = Date.now()): PendingAgentSend | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingAgentSend>;
    if (value.projectId !== projectId) return null;
    clearPendingAgentSend();
    if (typeof value.text !== "string" || !value.text.trim()) return null;
    if (typeof value.savedAt !== "number" || now - value.savedAt > MAX_AGE_MS || value.savedAt > now) return null;
    return {
      projectId,
      text: value.text,
      savedAt: value.savedAt,
      ...(typeof value.skill === "string" && /^[a-z][a-z-]{1,31}$/.test(value.skill) ? { skill: value.skill } : {})
    };
  } catch {
    clearPendingAgentSend();
    return null;
  }
}

/** Whether a message is waiting for this project, without taking it. */
export function hasPendingAgentSend(projectId: string): boolean {
  try {
    const raw = storage()?.getItem(KEY);
    return Boolean(raw && (JSON.parse(raw) as { projectId?: unknown }).projectId === projectId);
  } catch {
    return false;
  }
}

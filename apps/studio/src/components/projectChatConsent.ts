export interface ConsentStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function projectChatConsentKey(projectId: string | null): string {
  return `studio-chat-consent-v2:${projectId || "browser-session"}`;
}

export function hasProjectChatConsent(projectId: string | null, storage: ConsentStorage): boolean {
  try {
    return storage.getItem(projectChatConsentKey(projectId)) === "yes";
  } catch {
    return false;
  }
}

export function recordProjectChatConsent(projectId: string | null, storage: ConsentStorage): boolean {
  try {
    storage.setItem(projectChatConsentKey(projectId), "yes");
    return true;
  } catch {
    return false;
  }
}

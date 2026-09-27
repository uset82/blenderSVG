export interface ConsentStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Consent to send requests to OpenRouter is asked once per browser, not per project or session. */
export const CHAT_CONSENT_KEY = "kurva-openrouter-consent-v3";
/** "on" shows the full request for review before each send. Off by default. */
export const REQUEST_REVIEW_KEY = "kurva-request-preview";
export const REQUEST_REVIEW_EVENT = "kurva-request-preview";

const unavailable: ConsentStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error("Browser storage is unavailable.");
  }
};

/** localStorage, or a stand-in that remembers nothing when the browser blocks storage. */
export function browserStorage(): ConsentStorage {
  try {
    return window.localStorage;
  } catch {
    return unavailable;
  }
}

export function hasChatConsent(storage: ConsentStorage): boolean {
  try {
    return storage.getItem(CHAT_CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

export function recordChatConsent(storage: ConsentStorage): boolean {
  try {
    storage.setItem(CHAT_CONSENT_KEY, "yes");
    return true;
  } catch {
    return false;
  }
}

export function readRequestReview(storage: ConsentStorage): boolean {
  try {
    return storage.getItem(REQUEST_REVIEW_KEY) === "on";
  } catch {
    return false;
  }
}

export function storeRequestReview(storage: ConsentStorage, on: boolean): void {
  try {
    storage.setItem(REQUEST_REVIEW_KEY, on ? "on" : "off");
  } catch {
    // The choice still applies to this page when storage is unavailable.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REQUEST_REVIEW_EVENT));
}

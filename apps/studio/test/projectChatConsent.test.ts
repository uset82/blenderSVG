import { describe, expect, it } from "vitest";
import {
  CHAT_CONSENT_KEY,
  hasChatConsent,
  REQUEST_REVIEW_KEY,
  readRequestReview,
  recordChatConsent
} from "../src/components/projectChatConsent.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value)
  };
}

describe("chat consent", () => {
  it("is asked once per browser, for every project", () => {
    const storage = memoryStorage();
    expect(hasChatConsent(storage)).toBe(false);
    expect(recordChatConsent(storage)).toBe(true);
    expect(hasChatConsent(storage)).toBe(true);
    expect(storage.values.get(CHAT_CONSENT_KEY)).toBe("yes");
  });

  it("keeps the request review off unless it is switched on", () => {
    const storage = memoryStorage();
    expect(readRequestReview(storage)).toBe(false);
    storage.setItem(REQUEST_REVIEW_KEY, "on");
    expect(readRequestReview(storage)).toBe(true);
  });

  it("fails closed if browser storage is unavailable", () => {
    const storage = {
      getItem() {
        throw new Error("storage disabled");
      },
      setItem() {
        throw new Error("storage disabled");
      }
    };
    expect(hasChatConsent(storage)).toBe(false);
    expect(recordChatConsent(storage)).toBe(false);
    expect(readRequestReview(storage)).toBe(false);
  });
});

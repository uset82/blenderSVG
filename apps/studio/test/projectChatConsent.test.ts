import { describe, expect, it } from "vitest";
import {
  hasProjectChatConsent,
  projectChatConsentKey,
  recordProjectChatConsent
} from "../src/components/projectChatConsent.js";

describe("project chat consent", () => {
  it("keeps consent scoped to the active project", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    expect(projectChatConsentKey("project-a")).not.toBe(projectChatConsentKey("project-b"));
    expect(hasProjectChatConsent("project-a", storage)).toBe(false);
    expect(recordProjectChatConsent("project-a", storage)).toBe(true);
    expect(hasProjectChatConsent("project-a", storage)).toBe(true);
    expect(hasProjectChatConsent("project-b", storage)).toBe(false);
  });

  it("fails closed if browser session storage is unavailable", () => {
    const storage = {
      getItem() {
        throw new Error("storage disabled");
      },
      setItem() {
        throw new Error("storage disabled");
      }
    };

    expect(hasProjectChatConsent("project-a", storage)).toBe(false);
    expect(recordProjectChatConsent("project-a", storage)).toBe(false);
  });
});

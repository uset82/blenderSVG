import { describe, expect, it } from "vitest";
import { readLeftPanelTab, writeLeftPanelTab } from "../src/components/leftPanelTab.js";

describe("left panel tab", () => {
  it("remembers a known tab and falls back to Agent", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    expect(readLeftPanelTab(storage)).toBe("agent");
    writeLeftPanelTab("pages", storage);
    expect(readLeftPanelTab(storage)).toBe("pages");
    values.set("codex-avatar-studio-left-panel-tab", "not-a-tab");
    expect(readLeftPanelTab(storage)).toBe("agent");
  });
});

import { describe, expect, it } from "vitest";
import { clampPanelSize, readPanelSize, writePanelSize } from "../src/components/panelSizing.js";

describe("Studio panel sizing", () => {
  it("clamps saved and requested sizes to accessible panel ranges", () => {
    expect(clampPanelSize("chat", "width", 100)).toBe(260);
    expect(clampPanelSize("chat", "width", 900)).toBe(480);
    expect(clampPanelSize("inspector", "width", 900)).toBe(420);
    expect(clampPanelSize("chat", "height", Number.NaN)).toBe(460);
    expect(clampPanelSize("chat", "height", 520, 596)).toBe(345);
    expect(clampPanelSize("inspector", "height", 420, 596)).toBe(286);
  });

  it("loads stored sizes and falls back to defaults for unavailable or invalid preferences", () => {
    const values = new Map<string, string>([
      ["codex-avatar-studio-panel-chat-width", "444"],
      ["codex-avatar-studio-panel-inspector-height", "not-a-size"]
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };

    expect(readPanelSize("chat", "width", storage)).toBe(444);
    expect(readPanelSize("inspector", "height", storage)).toBe(260);
    expect(readPanelSize("chat", "width", { getItem: () => null })).toBe(320);
    expect(readPanelSize("inspector", "width", { getItem: () => null })).toBe(280);
  });

  it("persists the bounded size without failing when storage is unavailable", () => {
    const values = new Map<string, string>();
    writePanelSize("chat", "height", 800, {
      setItem: (key, value) => values.set(key, value)
    });
    expect(values.get("codex-avatar-studio-panel-chat-height")).toBe("520");
    expect(() =>
      writePanelSize("inspector", "width", 320, {
        setItem: () => {
          throw new Error("private mode");
        }
      })
    ).not.toThrow();
  });
});

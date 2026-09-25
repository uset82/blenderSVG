import { describe, expect, it } from "vitest";
import { composerMenuItems } from "../src/components/composerMenu.js";

describe("composer plus menu", () => {
  it("keeps canvas actions off until a canvas selection exists, and offers styles and skills", () => {
    const items = composerMenuItems({ hasEditor: true, selectedCount: 0 });
    expect(items.find((item) => item.id === "add-file")?.enabled).toBe(true);
    expect(items.find((item) => item.id === "add-canvas")?.reason).toBe("Select something on the canvas first.");
    expect(items.find((item) => item.id === "choose-style")?.enabled).toBe(true);
    expect(items.find((item) => item.id === "pick-skill")?.enabled).toBe(true);
  });

  it("enables add from canvas when something is selected", () => {
    expect(
      composerMenuItems({ hasEditor: true, selectedCount: 1 }).find((item) => item.id === "add-canvas")?.enabled
    ).toBe(true);
  });
});

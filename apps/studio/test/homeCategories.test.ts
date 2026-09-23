import { describe, expect, it } from "vitest";
import { HOME_CATEGORY_PRESETS } from "../src/components/StudioComposer.js";

describe("home design categories", () => {
  it("gives every chip a frame size and a starter prompt", () => {
    expect(HOME_CATEGORY_PRESETS.map((category) => category.label)).toEqual([
      "Landing page",
      "Mobile app",
      "Web app",
      "Dashboard",
      "Slides",
      "Avatar",
      "Icon / vector",
      "Something else"
    ]);
    expect(HOME_CATEGORY_PRESETS.find((category) => category.id === "landing-page")).toMatchObject({
      width: 1440,
      height: 1024
    });
    expect(HOME_CATEGORY_PRESETS.find((category) => category.id === "mobile-app")).toMatchObject({
      width: 390,
      height: 844
    });
    for (const category of HOME_CATEGORY_PRESETS) {
      expect(category.width).toBeGreaterThan(0);
      expect(category.height).toBeGreaterThan(0);
      expect(category.starterPrompt.trim().length).toBeGreaterThan(0);
    }
  });
});

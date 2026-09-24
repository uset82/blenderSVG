import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_STYLE,
  STYLE_PRESETS,
  parseProjectStyle,
  readProjectStyle,
  toStyleChoice,
  withProjectStyle
} from "../src/components/projectStyle.js";

describe("project style", () => {
  it("uses the Studio defaults when the canvas has no style", () => {
    expect(readProjectStyle(undefined)).toEqual(DEFAULT_PROJECT_STYLE);
    expect(readProjectStyle({ studioScratchpad: true })).toEqual(DEFAULT_PROJECT_STYLE);
    expect(STYLE_PRESETS.map((style) => style.name)).toEqual(["Studio", "Paper", "Ink"]);
    expect(STYLE_PRESETS.every((style) => parseProjectStyle(style)?.name === style.name)).toBe(true);
  });

  it("rejects a style with a bad color or markup in a font name", () => {
    expect(
      parseProjectStyle({ ...DEFAULT_PROJECT_STYLE, colors: { ...DEFAULT_PROJECT_STYLE.colors, accent: "blue" } })
    ).toBeNull();
    expect(
      parseProjectStyle({ ...DEFAULT_PROJECT_STYLE, type: { ...DEFAULT_PROJECT_STYLE.type, sans: "<script>" } })
    ).toBeNull();
  });

  it("stores a valid style beside other document meta and labels the choice", () => {
    const next = withProjectStyle({ studioScratchpad: true }, { ...DEFAULT_PROJECT_STYLE, name: "Warm studio" });
    expect(next).toMatchObject({
      studioScratchpad: true,
      studioStyle: { name: "Warm studio", colors: { accent: "#f0623a" }, type: { sans: "Hanken Grotesk" } }
    });
    expect(toStyleChoice(readProjectStyle(next)).label).toBe("Style: Warm studio");
  });
});

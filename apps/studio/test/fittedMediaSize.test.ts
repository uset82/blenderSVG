import { describe, expect, it } from "vitest";
import { fittedMediaSize, svgViewBoxSize } from "../src/projects/fittedMediaSize.js";

describe("fitted media size", () => {
  it("keeps a wide image's aspect ratio under the maximum side", () => {
    expect(fittedMediaSize({ width: 1600, height: 800 })).toEqual({ w: 800, h: 400 });
  });

  it("reads an SVG viewBox instead of using a square", () => {
    expect(svgViewBoxSize(`<svg viewBox="0 0 200 50"></svg>`)).toEqual({ width: 200, height: 50 });
    expect(fittedMediaSize(svgViewBoxSize(`<svg viewBox="0 0 200 50"></svg>`) ?? { width: 1, height: 1 })).toEqual({
      w: 200,
      h: 50
    });
  });
});

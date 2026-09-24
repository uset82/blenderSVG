import { describe, expect, it } from "vitest";
import { zoomMenuItems, zoomScale } from "../src/components/zoomMenu.js";

describe("zoom menu", () => {
  it("offers fit, selection, and the preset scales", () => {
    const items = zoomMenuItems(true);
    expect(items.map((item) => item.id)).toEqual(["fit", "selection", "50", "100", "200"]);
    expect(items.find((item) => item.id === "fit")?.shortcut).toBe("Shift+1");
    expect(items.find((item) => item.id === "selection")?.shortcut).toBe("Shift+2");
  });

  it("disables zoom to selection until a shape is selected", () => {
    const selection = zoomMenuItems(false).find((item) => item.id === "selection");
    expect(selection?.enabled).toBe(false);
    expect(selection?.reason).toBe("Select something on the canvas first.");
  });

  it("maps preset commands to zoom scales", () => {
    expect(zoomScale("50")).toBe(0.5);
    expect(zoomScale("100")).toBe(1);
    expect(zoomScale("200")).toBe(2);
    expect(zoomScale("fit")).toBeNull();
  });
});

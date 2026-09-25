import type { Editor } from "tldraw";
import { describe, expect, it, vi } from "vitest";
import { assertLocalAssetFile, placeFileOnCanvas } from "../src/projects/localAssets.js";

describe("local asset file checks", () => {
  it("accepts a small PNG and rejects an empty or non-image file", () => {
    expect(() =>
      assertLocalAssetFile(new File([new Uint8Array(8)], "icon.png", { type: "image/png" }), "image")
    ).not.toThrow();
    expect(() => assertLocalAssetFile(new File([], "empty.png", { type: "image/png" }), "image")).toThrow(/8 MB/);
    expect(() => assertLocalAssetFile(new File(["x"], "notes.txt", { type: "text/plain" }), "image")).toThrow(
      /PNG, JPEG/
    );
  });

  it("places sanitized SVG data in the registered vector shape property", async () => {
    const createShape = vi.fn();
    const editor = {
      getViewportPageBounds: () => ({ center: { x: 100, y: 80 } }),
      createShape
    } as unknown as Editor;
    const file = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><script>alert(1)</script><rect width="20" height="10"/></svg>'
      ],
      "mark.svg",
      { type: "image/svg+xml" }
    );

    await placeFileOnCanvas(editor, file);

    expect(createShape).toHaveBeenCalledOnce();
    const shape = createShape.mock.calls[0]?.[0] as {
      type: string;
      x: number;
      y: number;
      props: Record<string, unknown>;
    };
    expect(shape).toMatchObject({ type: "vector-studio", x: 90, y: 75 });
    expect(shape.props).toMatchObject({
      w: 20,
      h: 10,
      engine: "local-svg",
      lastSvg: expect.stringContaining("<rect"),
      isProcessing: false
    });
    expect(shape.props.lastSvg).not.toContain("<script");
    expect(shape.props).not.toHaveProperty("svg");
  });
});

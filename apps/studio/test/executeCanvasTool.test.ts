import type { Editor } from "tldraw";
import { describe, expect, it, vi } from "vitest";
import { executeCanvasTool } from "../src/components/executeCanvasTool.js";

describe("approved canvas tool execution", () => {
  it("creates the requested frame in the visible viewport and records undo history", async () => {
    const createShape = vi.fn();
    const markHistoryStoppingPoint = vi.fn();
    const editor = {
      getViewportPageBounds: () => ({ center: { x: 400, y: 300 } }),
      getCurrentPageShapes: () => [],
      createShape,
      markHistoryStoppingPoint
    } as unknown as Editor;

    const result = await executeCanvasTool(
      editor,
      "create_frame",
      JSON.stringify({ name: "Landing", width: 1440, height: 900 })
    );

    expect(markHistoryStoppingPoint).toHaveBeenCalledWith("Agent: create frame");
    expect(createShape).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "frame",
        x: -320,
        y: -150,
        props: { w: 1440, h: 900, name: "Landing" }
      })
    );
    expect(result.content).toContain("Landing");
  });

  it("rejects extra provider fields before touching the editor", async () => {
    const createShape = vi.fn();
    const editor = { createShape } as unknown as Editor;
    await expect(
      executeCanvasTool(
        editor,
        "create_frame",
        JSON.stringify({
          name: "Landing",
          width: 1440,
          height: 900,
          script: "run this"
        })
      )
    ).rejects.toThrow("Unexpected argument");
    expect(createShape).not.toHaveBeenCalled();
  });

  it("returns a bounded PNG for an approved screenshot request", async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const editor = {
      getCurrentPageShapes: () => [],
      getShape: () => ({ id: "shape:frame", type: "frame", props: { name: "Hero" } }),
      toImage: vi.fn(async () => ({ blob }))
    } as unknown as Editor;
    const result = await executeCanvasTool(editor, "screenshot_frame", JSON.stringify({ frameId: "shape:frame" }));
    expect(result.imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.content).toContain("Hero");
  });
});

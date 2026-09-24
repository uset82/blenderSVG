import type { Editor } from "tldraw";
import { describe, expect, it, vi } from "vitest";
import {
  collectCanvasAssets,
  decodeAssetDrag,
  encodeAssetDrag,
  placeCanvasAsset
} from "../src/components/canvasAssets.js";

describe("canvas assets", () => {
  it("keeps images, SVGs, and avatars and ignores other records", () => {
    const items = collectCanvasAssets({
      assets: [
        { id: "asset:photo", type: "image", label: "Photo" },
        { id: "asset:bookmark", type: "bookmark", label: "Link" }
      ],
      shapes: [
        { id: "shape:svg", type: "vector-studio", label: "Mark" },
        { id: "shape:avatar", type: "avatar", label: "" },
        { id: "shape:frame", type: "frame", label: "Frame" }
      ]
    });
    expect(items).toEqual([
      { id: "asset:photo", kind: "image", label: "Photo" },
      { id: "shape:svg", kind: "svg", label: "Mark" },
      { id: "shape:avatar", kind: "avatar", label: "Avatar" }
    ]);
  });

  it("round-trips a drag payload and rejects other text", () => {
    const encoded = encodeAssetDrag({ kind: "svg", id: "shape:svg" });
    expect(decodeAssetDrag(encoded)).toEqual({ kind: "svg", id: "shape:svg" });
    expect(decodeAssetDrag("photo.png")).toBeNull();
  });

  it("places a referenced image centered at the requested point", () => {
    const createShape = vi.fn();
    const editor = {
      getAsset: vi.fn(() => ({ id: "asset:photo", type: "image", props: { w: 320, h: 180 } })),
      createShape
    } as unknown as Editor;

    expect(placeCanvasAsset(editor, { kind: "image", id: "asset:photo" }, { x: 500, y: 300 })).toBe(true);
    expect(createShape).toHaveBeenCalledWith({
      type: "image",
      x: 340,
      y: 210,
      props: { assetId: "asset:photo", w: 320, h: 180 }
    });
  });

  it("duplicates an SVG or avatar shape onto the current page and rejects mismatches", () => {
    const createShape = vi.fn();
    const editor = {
      getShape: vi.fn(() => ({
        id: "shape:avatar",
        type: "avatar",
        x: 10,
        y: 20,
        props: { w: 340, h: 480, character: "cholita-3d", avatarState: "idle", speech: "Preview" }
      })),
      createShape
    } as unknown as Editor;

    expect(placeCanvasAsset(editor, { kind: "avatar", id: "shape:avatar" }, { x: 500, y: 300 })).toBe(true);
    expect(createShape).toHaveBeenCalledWith({
      type: "avatar",
      x: 330,
      y: 60,
      props: { w: 340, h: 480, character: "cholita-3d", avatarState: "idle", speech: "Preview" }
    });
    expect(placeCanvasAsset(editor, { kind: "svg", id: "shape:avatar" }, { x: 500, y: 300 })).toBe(false);
    expect(createShape).toHaveBeenCalledTimes(1);
  });
});

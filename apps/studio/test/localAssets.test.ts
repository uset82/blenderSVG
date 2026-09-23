import { describe, expect, it } from "vitest";
import { assertLocalAssetFile } from "../src/projects/localAssets.js";

describe("local asset file checks", () => {
  it("accepts a small PNG and rejects an empty or non-image file", () => {
    expect(() => assertLocalAssetFile(new File([new Uint8Array(8)], "icon.png", { type: "image/png" }), "image")).not.toThrow();
    expect(() => assertLocalAssetFile(new File([], "empty.png", { type: "image/png" }), "image")).toThrow(/8 MB/);
    expect(() => assertLocalAssetFile(new File(["x"], "notes.txt", { type: "text/plain" }), "image")).toThrow(/PNG, JPEG/);
  });
});

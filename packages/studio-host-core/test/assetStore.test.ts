import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readLibraryAsset, writeLibraryAsset } from "../src/assetStore.js";

const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";

describe("library assets", () => {
  it("sanitizes SVG and rejects an oversized or unknown file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "studio-asset-"));
    const svg = new TextEncoder().encode("<svg><script>alert(1)</script><rect /></svg>");
    await writeLibraryAsset(root, id, "image/svg+xml", svg);
    const stored = await readLibraryAsset(root, id);
    const text = new TextDecoder().decode(stored?.bytes ?? new Uint8Array());
    expect(text).not.toContain("script");
    expect(text).toContain("<svg");
    await expect(writeLibraryAsset(root, id, "image/png", new Uint8Array(1_000_001))).rejects.toThrow(/1 MB/);
    await expect(writeLibraryAsset(root, id, "text/html", new Uint8Array([1]))).rejects.toThrow(/PNG, JPEG, and SVG/);
  });
});

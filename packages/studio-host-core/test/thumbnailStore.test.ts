import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPng, readProjectThumbnail, removeProjectThumbnail, writeProjectThumbnail } from "../src/thumbnailStore.js";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("project thumbnails", () => {
  it("stores a PNG in the library and rejects other bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "studio-thumb-"));
    const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    expect(await readProjectThumbnail(root, id)).toBeNull();
    expect(isPng(png)).toBe(true);
    await writeProjectThumbnail(root, id, png);
    expect(Array.from((await readProjectThumbnail(root, id)) ?? [])).toEqual(Array.from(png));
    await expect(writeProjectThumbnail(root, id, Uint8Array.from([1, 2, 3, 4]))).rejects.toThrow(/PNG/);
    expect(Array.from((await readProjectThumbnail(root, id)) ?? [])).toEqual(Array.from(png));
    await removeProjectThumbnail(root, id);
    expect(await readProjectThumbnail(root, id)).toBeNull();
  });
});

import type { TLAsset } from "tldraw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostAssetStore } from "../src/projects/hostAssetStore.js";

describe("standalone host asset store", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads the original file through the same-origin host and resolves its stored URL", async () => {
    const response = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const store = createHostAssetStore();
    const file = new File(["<svg />"], "mark.svg", { type: "image/svg+xml" });

    const result = await store.upload({} as TLAsset, file);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toMatch(/^\/assets\/[0-9a-f-]{36}$/);
    expect(request).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "image/svg+xml" },
      body: file
    });
    expect(result).toEqual({ src: url });
    expect(store.resolve({ props: { src: url } } as TLAsset)).toBe(url);
  });

  it("fails the upload when the host rejects the asset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const store = createHostAssetStore();
    const file = new File(["png"], "image.png", { type: "image/png" });

    await expect(store.upload({} as TLAsset, file)).rejects.toThrow(/not stored/);
  });

  it("rejects unsupported and oversized files before making a host request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = createHostAssetStore();

    await expect(store.upload({} as TLAsset, new File(["webp"], "image.webp", { type: "image/webp" }))).rejects.toThrow(
      /PNG, JPEG, and SVG/
    );
    await expect(
      store.upload({} as TLAsset, new File([new Uint8Array(1_000_001)], "large.png", { type: "image/png" }))
    ).rejects.toThrow(/up to 1 MB/);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

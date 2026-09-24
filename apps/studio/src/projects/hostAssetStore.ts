import type { TLAssetStore } from "tldraw";

/** New canvas assets are uploaded to the host instead of being embedded as base64. */
export function createHostAssetStore(): TLAssetStore {
  return {
    async upload(_asset, file) {
      const id = crypto.randomUUID();
      const response = await fetch(`/assets/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file
      });
      if (!response.ok) throw new Error("The asset was not stored.");
      return { src: `/assets/${id}` };
    },
    resolve(asset) {
      return asset.props.src;
    }
  };
}

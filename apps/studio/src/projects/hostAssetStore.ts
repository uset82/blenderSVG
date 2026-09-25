import type { TLAssetStore } from "tldraw";

const MAX_HOST_ASSET_BYTES = 1_000_000;
const HOST_ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

/** New canvas assets are uploaded to the host instead of being embedded as base64. */
export function createHostAssetStore(): TLAssetStore {
  return {
    async upload(_asset, file) {
      if (file.size <= 0 || file.size > MAX_HOST_ASSET_BYTES) {
        throw new Error("Choose a non-empty PNG, JPEG, or SVG up to 1 MB for a standalone project.");
      }
      const contentType = hostAssetContentType(file);
      if (!contentType) throw new Error("Standalone projects support PNG, JPEG, and SVG files only.");
      const id = crypto.randomUUID();
      const response = await fetch(`/assets/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": contentType },
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

/** Copy host asset files into the downloaded project so it opens without this server. */
export async function inlineStandaloneAssetSources(snapshot: string): Promise<string> {
  const ids = new Set(
    [...snapshot.matchAll(/\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)].map(
      (match) => match[1] ?? ""
    )
  );
  let next = snapshot;
  for (const id of ids) {
    if (!id) continue;
    const response = await fetch(`/assets/${id}`, { credentials: "same-origin" });
    if (!response.ok) continue;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    next = next.replaceAll(`/assets/${id}`, dataUrl);
  }
  return next;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const type = blob.type || "application/octet-stream";
    return `data:${type};base64,${btoa(binary)}`;
  });
}

function hostAssetContentType(file: File): string | null {
  const declaredType = file.type.split(";")[0]?.trim().toLowerCase();
  if (declaredType) return HOST_ASSET_TYPES.has(declaredType) ? declaredType : null;
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  return null;
}

import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import type { TLAssetStore } from "tldraw";
import { putBrowserAsset, readBrowserAsset } from "./browserProjects.js";

const ASSET_SCHEME = "kurva-asset:";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const urls = new Map<string, string>();

export function browserAssetSrc(id: string): string {
  return `${ASSET_SCHEME}${id}`;
}

export function browserAssetId(src: string): string | null {
  if (!src.startsWith(ASSET_SCHEME)) return null;
  const id = src.slice(ASSET_SCHEME.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : null;
}

export function releaseBrowserAssetUrls(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

export async function resolveBrowserAssetUrl(src: string): Promise<string> {
  const id = browserAssetId(src);
  if (!id) return src;
  const cached = urls.get(id);
  if (cached) return cached;
  const asset = await readBrowserAsset(id);
  if (!asset) return src;
  const url = URL.createObjectURL(asset.blob);
  urls.set(id, url);
  return url;
}

export function createBrowserAssetStore(): TLAssetStore {
  return {
    async upload(_asset, file) {
      const contentType = assetContentType(file);
      if (!contentType) throw new Error("This browser keeps PNG, JPEG, and SVG files only.");
      const id = crypto.randomUUID();
      const blob =
        contentType === "image/svg+xml"
          ? new Blob([sanitizeSvg(await file.text())], { type: contentType })
          : file.slice(0, file.size, contentType);
      await putBrowserAsset(id, contentType, blob);
      return { src: browserAssetSrc(id) };
    },
    resolve(asset) {
      const src = asset.props.src;
      return src?.startsWith(ASSET_SCHEME) ? resolveBrowserAssetUrl(src) : src;
    }
  };
}

function assetContentType(file: File): "image/png" | "image/jpeg" | "image/svg+xml" | null {
  const declared = file.type.split(";")[0]?.trim().toLowerCase();
  if (declared && ALLOWED.has(declared)) return declared as "image/png" | "image/jpeg" | "image/svg+xml";
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  return null;
}

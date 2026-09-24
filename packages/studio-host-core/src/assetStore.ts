import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";
import { containedLibraryPath } from "./studioLibrary.js";

const MAX_ASSET_BYTES = 1_000_000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredAssetKind = "png" | "jpeg" | "svg";

export function assetExtension(contentType: string): StoredAssetKind | null {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpeg";
  if (contentType === "image/svg+xml") return "svg";
  return null;
}

export async function writeLibraryAsset(
  libraryRoot: string,
  id: string,
  contentType: string,
  bytes: Uint8Array
): Promise<void> {
  if (!ID.test(id)) throw new Error("The asset id is not valid.");
  const kind = assetExtension(contentType);
  if (!kind) throw new Error("Only PNG, JPEG, and SVG assets can be stored.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES)
    throw new Error("The asset is empty or larger than 1 MB.");
  const body = kind === "svg" ? new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(bytes))) : bytes;
  if (kind === "svg" && !body.includes(60)) throw new Error("The SVG did not survive sanitizing.");
  const target = containedLibraryPath(libraryRoot, path.join("assets", `${id}.${kind}`));
  if (!target) throw new Error("The asset path leaves the Studio library.");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function readLibraryAsset(
  libraryRoot: string,
  id: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!ID.test(id)) return null;
  for (const kind of ["png", "jpeg", "svg"] as const) {
    const target = containedLibraryPath(libraryRoot, path.join("assets", `${id}.${kind}`));
    if (!target) return null;
    try {
      const bytes = await readFile(target);
      const contentType = kind === "png" ? "image/png" : kind === "jpeg" ? "image/jpeg" : "image/svg+xml";
      return { bytes, contentType };
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

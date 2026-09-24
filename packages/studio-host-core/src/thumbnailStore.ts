import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { containedLibraryPath } from "./studioLibrary.js";

const MAX_THUMBNAIL_BYTES = 1_000_000;

export function isPng(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export async function writeProjectThumbnail(libraryRoot: string, projectId: string, bytes: Uint8Array): Promise<void> {
  if (!isPng(bytes) || bytes.byteLength > MAX_THUMBNAIL_BYTES) {
    throw new Error("The thumbnail must be a PNG under 1 MB.");
  }
  const target = containedLibraryPath(libraryRoot, path.join("thumbnails", `${projectId}.png`));
  if (!target) throw new Error("The thumbnail path leaves the Studio library.");
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${projectId}.${randomUUID()}.tmp`);
  await writeFile(temporary, bytes);
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readProjectThumbnail(libraryRoot: string, projectId: string): Promise<Uint8Array> {
  const target = containedLibraryPath(libraryRoot, path.join("thumbnails", `${projectId}.png`));
  if (!target) throw new Error("The thumbnail path leaves the Studio library.");
  return readFile(target);
}

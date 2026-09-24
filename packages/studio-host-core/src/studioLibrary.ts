import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface StudioLibrary {
  root: string;
  projects: string;
  assets: string;
  conversations: string;
  thumbnails: string;
}

export function defaultStudioLibraryRoot(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  const override = env.STUDIO_LIBRARY?.trim();
  if (override) return path.resolve(override);
  if (platform === "win32")
    return path.join(env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "blenderSVG Studio", "library");
  if (platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support", "blenderSVG Studio", "library");
  return path.join(env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "blenderSVG Studio", "library");
}

export async function ensureStudioLibrary(root: string): Promise<StudioLibrary> {
  const resolved = path.resolve(root);
  const library: StudioLibrary = {
    root: resolved,
    projects: path.join(resolved, "projects"),
    assets: path.join(resolved, "assets"),
    conversations: path.join(resolved, "conversations"),
    thumbnails: path.join(resolved, "thumbnails")
  };
  await mkdir(library.projects, { recursive: true });
  await mkdir(library.assets, { recursive: true });
  await mkdir(library.conversations, { recursive: true });
  await mkdir(library.thumbnails, { recursive: true });
  return library;
}

export function containedLibraryPath(libraryRoot: string, relativePath: string): string | null {
  const root = path.resolve(libraryRoot);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

export async function readTrustedWorkspace(libraryRoot: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(libraryRoot, "trust.json"), "utf8")) as { workspace?: unknown };
    return typeof raw.workspace === "string" && raw.workspace.trim() ? raw.workspace : null;
  } catch {
    return null;
  }
}

/** Trust is explicit. Calling this is the first-use confirmation for an optional workspace folder. */
export async function trustWorkspace(libraryRoot: string, workspacePath: string): Promise<string> {
  const canonical = await realpath(workspacePath);
  await mkdir(libraryRoot, { recursive: true });
  await writeFile(path.join(libraryRoot, "trust.json"), JSON.stringify({ workspace: canonical }), "utf8");
  return canonical;
}

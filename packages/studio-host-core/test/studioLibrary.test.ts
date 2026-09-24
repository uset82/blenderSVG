import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  containedLibraryPath,
  defaultStudioLibraryRoot,
  ensureStudioLibrary,
  readTrustedWorkspace,
  trustWorkspace
} from "../src/studioLibrary.js";

describe("studio library", () => {
  it("creates the app-data folders and keeps paths inside the library", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "studio-library-"));
    const library = await ensureStudioLibrary(root);
    expect(library.projects.endsWith(`${path.sep}projects`)).toBe(true);
    expect(library.assets.endsWith(`${path.sep}assets`)).toBe(true);
    expect(library.conversations.endsWith(`${path.sep}conversations`)).toBe(true);
    expect(library.thumbnails.endsWith(`${path.sep}thumbnails`)).toBe(true);
    expect(containedLibraryPath(root, "projects/one.json")).toBe(path.join(root, "projects", "one.json"));
    expect(containedLibraryPath(root, "../outside.json")).toBeNull();
  });

  it("trusts an optional workspace only after an explicit call", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "studio-library-"));
    const workspace = path.join(root, "workspace");
    await mkdir(workspace);
    expect(await readTrustedWorkspace(root)).toBeNull();
    const trusted = await trustWorkspace(root, workspace);
    expect(await readTrustedWorkspace(root)).toBe(trusted);
  });

  it("uses the operating-system app-data directory by default", () => {
    expect(defaultStudioLibraryRoot({ APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, "win32")).toContain(
      "blenderSVG Studio"
    );
    expect(defaultStudioLibraryRoot({ STUDIO_LIBRARY: path.join(tmpdir(), "custom-library") }, "linux")).toContain(
      "custom-library"
    );
  });
});

/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { isImportDocument } from "@codex-avatar-studio/studio-host-core/projectEnvelope";
import { afterEach, describe, expect, it } from "vitest";
import { buildStudioProjectExport } from "../src/projects/exportProjectFile.js";
import { parseImportedStudioProject } from "../src/projects/importProjectFile.js";
import { releaseBrowserAssetUrls } from "../src/web/browserAssets.js";
import { exportBrowserBackup, importBrowserBackup } from "../src/web/browserBackup.js";
import { closeLibraryForTests, upgradeKurvaLibrary } from "../src/web/browserLibrary.js";
import {
  assetIdsInSnapshot,
  deleteBrowserProject,
  ensureBrowserScratchpad,
  listBrowserProjects,
  openBrowserProject,
  putBrowserAsset,
  readBrowserAsset,
  saveBrowserProject,
  writeBrowserConversation
} from "../src/web/browserProjects.js";
import { acquireProjectLock } from "../src/web/projectLock.js";
import { buildStoredZip, readStoredZip } from "../src/web/storedZip.js";

const snapshot = JSON.stringify({ document: { schema: { version: 1 }, store: {} } });
const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
const otherId = "55b5363d-6cd6-42f7-88c8-79b8a847d8e6";

async function resetLibrary(): Promise<void> {
  closeLibraryForTests();
  releaseBrowserAssetUrls();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("kurva-library");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  await resetLibrary();
});

describe("browser library", () => {
  it("creates, reads, updates, and deletes a project without removing Scratchpad", async () => {
    const scratchpad = await ensureBrowserScratchpad(snapshot);
    expect(scratchpad.id).toBe("00000000-0000-4000-8000-000000000001");
    await saveBrowserProject(projectId, "Board", snapshot);
    expect((await openBrowserProject(projectId)).title).toBe("Board");
    await saveBrowserProject(projectId, "Board revised", snapshot);
    expect((await listBrowserProjects()).projects.map((project) => project.id)[0]).toBe(scratchpad.id);
    await expect(deleteBrowserProject(scratchpad.id)).rejects.toThrow(/permanent/);
    await deleteBrowserProject(projectId);
    await expect(openBrowserProject(projectId)).rejects.toThrow(/damaged|no longer|unreadable|unsupported/);
  });

  it("keeps a corrupt record instead of overwriting it", async () => {
    const database = await import("../src/web/browserLibrary.js").then((library) => library.openKurvaLibrary());
    const transaction = database.transaction("projects", "readwrite");
    transaction.objectStore("projects").put({ id: projectId, document: { id: projectId, broken: true } });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
    await expect(saveBrowserProject(projectId, "Board", snapshot)).rejects.toThrow(/left in place/);
    const listed = await listBrowserProjects();
    expect(listed.corruptCount).toBe(1);
    expect(listed.projects.some((project) => project.id === projectId)).toBe(false);
  });

  it("reports a quota failure without claiming the project was saved", async () => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      await expect(saveBrowserProject(projectId, "Board", snapshot)).rejects.toThrow(/out of space/);
    } finally {
      IDBObjectStore.prototype.put = original;
    }
  });

  it("upgrades version 0 into the five library stores", () => {
    const created: string[] = [];
    const database = {
      createObjectStore(name: string) {
        created.push(name);
        return { createIndex() {} };
      }
    } as unknown as IDBDatabase;
    upgradeKurvaLibrary(database, 0);
    expect(created).toEqual(["projects", "assets", "thumbnails", "conversations", "meta"]);
    upgradeKurvaLibrary(database, 1);
    expect(created).toHaveLength(5);
  });

  it("lets a second tab open the project read-only", async () => {
    let held = false;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          _name: string,
          options: { ifAvailable?: boolean },
          callback: (lock: object | null) => unknown
        ) => {
          if (options.ifAvailable && held) return callback(null);
          held = true;
          try {
            return await callback({});
          } finally {
            held = false;
          }
        }
      }
    });
    const first = await acquireProjectLock(projectId);
    const second = await acquireProjectLock(projectId);
    expect(first.readonly).toBe(false);
    expect(second.readonly).toBe(true);
    first.release();
  });

  it("removes an asset only when no remaining project references it", async () => {
    const assetId = "66c6474e-7de7-43a8-8d9d-8ac9b958e9f7";
    await putBrowserAsset(assetId, "image/png", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    const referenced = JSON.stringify({
      document: { schema: { version: 1 }, store: { asset: { props: { src: `kurva-asset:${assetId}` } } } }
    });
    await saveBrowserProject(projectId, "With image", referenced);
    await saveBrowserProject(otherId, "Also", referenced);
    await deleteBrowserProject(projectId);
    expect(await readBrowserAsset(assetId)).not.toBeNull();
    await deleteBrowserProject(otherId);
    expect(await readBrowserAsset(assetId)).toBeNull();
    expect(assetIdsInSnapshot(referenced)).toEqual([assetId]);
  });

  it("round-trips a backup and accepts a desktop project file", async () => {
    const assetId = "77d7585f-8ef8-44b9-9eae-9bdac069faf8";
    await putBrowserAsset(assetId, "image/png", new Blob([new Uint8Array([9, 9])], { type: "image/png" }));
    const referenced = JSON.stringify({
      document: { schema: { version: 1 }, store: { shape: { props: { src: `kurva-asset:${assetId}` } } } }
    });
    await saveBrowserProject(projectId, "Portable", referenced);
    const backup = new Uint8Array(await (await exportBrowserBackup()).arrayBuffer());
    const names = readStoredZip(backup).map((entry) => entry.name);
    expect(names).toContain(`${projectId}.studio.json`);
    await deleteBrowserProject(projectId);
    const restored = await importBrowserBackup(backup);
    expect(restored.imported).toBeGreaterThan(0);
    const opened = await openBrowserProject(projectId);
    expect(opened.title).toBe("Portable");
    expect(await readBrowserAsset(assetIdsInSnapshot(opened.snapshot)[0] ?? "")).not.toBeNull();
    const desktop = buildStudioProjectExport({
      id: otherId,
      title: "From desktop",
      snapshot,
      now: "2026-09-25T00:00:00.000Z"
    });
    expect(isImportDocument(JSON.parse(desktop))).toBe(true);
    const desktopZip = buildStoredZip([{ name: `${otherId}.studio.json`, data: new TextEncoder().encode(desktop) }]);
    const desktopImport = await importBrowserBackup(desktopZip);
    expect(desktopImport).toEqual({ imported: 1, skipped: 0 });
    expect((await openBrowserProject(otherId)).title).toBe("From desktop");
    const again = await importBrowserBackup(desktopZip);
    expect(again.skipped).toBe(1);
    const webEntry = readStoredZip(backup).find((entry) => entry.name === `${projectId}.studio.json`);
    expect(parseImportedStudioProject(new TextDecoder().decode(webEntry?.data ?? new Uint8Array())).title).toBe(
      "Portable"
    );
    await writeBrowserConversation({
      id: "88e86960-9f09-45ca-afbf-acecb17a0b09",
      projectId,
      title: "Chat",
      modelId: "test",
      updatedAt: new Date().toISOString(),
      messages: [{ role: "user", content: "Hello" }]
    });
    await expect(
      writeBrowserConversation({
        id: "88e86960-9f09-45ca-afbf-acecb17a0b09",
        projectId,
        title: "Chat",
        modelId: "test",
        updatedAt: new Date().toISOString(),
        messages: [{ role: "user", content: "Hello" }],
        apiKey: "secret"
      } as never)
    ).rejects.toThrow(/could not be saved/);
  });
});

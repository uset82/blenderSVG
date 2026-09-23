import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StudioProjectStore, StudioProjectStoreError } from "../src/studioProjectStore.js";

const roots: string[] = [];
const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), "studio-import-test-"));
  roots.push(root);
  return { root, store: new StudioProjectStore(() => root) };
}

function projectJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "44a4252c-5bc5-41e6-b7b7-68a79736c7d5",
    title: "Reference board",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-03T03:04:05.000Z",
    formatVersion: 1,
    snapshot,
    ...overrides
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Studio project import", () => {
  it("creates a new ID and keeps the source project unchanged", async () => {
    const { root, store } = workspace();
    const source = path.join(root, "reference.json");
    writeFileSync(source, projectJson());

    const imported = await store.importFromFile(source);
    expect(imported.id).not.toBe("44a4252c-5bc5-41e6-b7b7-68a79736c7d5");
    expect(imported.title).toBe("Reference board");
    expect(imported.snapshot).toBe(snapshot);
    expect(imported.createdAt).toBe(imported.updatedAt);
    expect(await store.open(imported.id)).toEqual(imported);
    expect(readFileSync(source, "utf8")).toBe(projectJson());

    const second = await store.importFromFile(source);
    expect(second.id).not.toBe(imported.id);
    expect((await store.list()).projects).toHaveLength(2);
  });

  it("rejects invalid envelopes and snapshots without creating a project", async () => {
    const { root, store } = workspace();
    const source = path.join(root, "bad.json");
    for (const content of [
      "not json",
      projectJson({ formatVersion: 2 }),
      projectJson({ apiKey: "must-not-import" }),
      projectJson({ snapshot: JSON.stringify({ document: {} }) })
    ]) {
      writeFileSync(source, content);
      await expect(store.importFromFile(source)).rejects.toMatchObject({ code: "corrupt" });
    }
    expect((await store.list()).projects).toHaveLength(0);
  });

  it("rejects oversized files before parsing", async () => {
    const { root, store } = workspace();
    const source = path.join(root, "oversized.json");
    writeFileSync(source, "");
    truncateSync(source, 24_000_001);
    await expect(store.importFromFile(source)).rejects.toMatchObject({ code: "too-large" });
  });

  it("requires an absolute JSON path", async () => {
    const { store } = workspace();
    await expect(store.importFromFile("relative.json")).rejects.toBeInstanceOf(StudioProjectStoreError);
    await expect(store.importFromFile("relative.json")).rejects.toMatchObject({ code: "corrupt" });
  });
});

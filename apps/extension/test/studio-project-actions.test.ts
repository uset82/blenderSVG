import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StudioProjectStore } from "../src/studioProjectStore.js";

const roots: string[] = [];
const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), "studio-project-actions-test-"));
  roots.push(root);
  return {
    root,
    projectPath: path.join(root, ".codex-avatar", "studio", "projects", `${projectId}.json`),
    store: new StudioProjectStore(() => root)
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Studio project rename and reveal", () => {
  it("renames a readable project atomically while preserving its canvas and creation date", async () => {
    const { store, projectPath } = workspace();
    await store.save(projectId, "Original", snapshot);
    const original = await store.open(projectId);

    const result = await store.rename(projectId, "  Renamed board  ");
    expect(result).toMatchObject({ id: projectId, title: "Renamed board", createdAt: original.createdAt });
    const renamed = await store.open(projectId);
    expect(renamed).toMatchObject({
      id: original.id,
      title: "Renamed board",
      createdAt: original.createdAt,
      formatVersion: original.formatVersion,
      snapshot: original.snapshot
    });
    expect(JSON.parse(readFileSync(projectPath, "utf8"))).toEqual(renamed);
    expect(await store.revealPath(projectId)).toBe(realpathSync(projectPath));
  });

  it("rejects invalid titles without touching the stored file", async () => {
    const { store, projectPath } = workspace();
    await store.save(projectId, "Original", snapshot);
    const originalBytes = readFileSync(projectPath, "utf8");
    for (const title of [" ", "Bad\nname", "x".repeat(121)]) {
      await expect(store.rename(projectId, title)).rejects.toMatchObject({ code: "invalid-title" });
      expect(readFileSync(projectPath, "utf8")).toBe(originalBytes);
    }
  });

  it("does not rename or reveal a corrupt, missing, or arbitrary project path", async () => {
    const { store, projectPath } = workspace();
    await store.list();
    await expect(store.rename(projectId, "New title")).rejects.toMatchObject({ code: "missing" });
    await expect(store.revealPath(projectId)).rejects.toMatchObject({ code: "missing" });
    await expect(store.revealPath("../../outside.json")).rejects.toMatchObject({ code: "corrupt" });

    await store.save(projectId, "Original", snapshot);
    writeFileSync(projectPath, "{damaged");
    await expect(store.rename(projectId, "New title")).rejects.toMatchObject({ code: "corrupt" });
    await expect(store.revealPath(projectId)).rejects.toMatchObject({ code: "corrupt" });
    expect(readFileSync(projectPath, "utf8")).toBe("{damaged");
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StudioProjectStore } from "../src/studioProjectStore.js";

const roots: string[] = [];
const projectId = "5b2d7c1e-3f4a-4b6c-8d9e-0a1b2c3d4e5f";

function store() {
  const root = mkdtempSync(path.join(os.tmpdir(), "studio-snapshot-test-"));
  roots.push(root);
  return { root, store: new StudioProjectStore(() => root) };
}

function snapshot(store: Record<string, unknown>) {
  return JSON.stringify({ document: { schema: { schemaVersion: 2, sequences: {} }, store } });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Studio project snapshot records", () => {
  it("accepts an empty canvas and records that carry their own id and type", async () => {
    const { store: projects } = store();
    await expect(projects.save(projectId, "Empty", snapshot({}))).resolves.toMatchObject({ id: projectId });
    const valid = snapshot({
      "document:document": { id: "document:document", typeName: "document", gridSize: 10, name: "" },
      "page:page": { id: "page:page", typeName: "page", name: "Page 1", index: "a1", meta: {} }
    });
    await expect(projects.save(projectId, "Valid", valid)).resolves.toMatchObject({ title: "Valid" });
  });

  it("rejects a hand-written record without a matching id and leaves the project unchanged", async () => {
    const { store: projects } = store();
    await projects.save(projectId, "Original", snapshot({}));
    const handWritten = snapshot({
      "shape:landing": { typeName: "shape", type: "design-frame", props: { name: "Claude frame", w: 800, h: 600 } }
    });
    await expect(projects.save(projectId, "Broken", handWritten)).rejects.toMatchObject({ code: "corrupt" });
    await expect(projects.open(projectId)).resolves.toMatchObject({ title: "Original" });
  });

  it("lists an existing file with such a record as needing attention instead of as a project", async () => {
    const { root, store: projects } = store();
    await projects.save(projectId, "Original", snapshot({}));
    const file = path.join(root, ".codex-avatar", "studio", "projects", `${projectId}.json`);
    const document = {
      id: projectId,
      title: "Claude desk",
      createdAt: "2026-09-24T23:14:56.200Z",
      updatedAt: "2026-09-24T23:14:56.279Z",
      formatVersion: 1,
      snapshot: snapshot({ "shape:landing": { typeName: "shape", type: "design-frame" } })
    };
    writeFileSync(file, JSON.stringify(document));
    const listed = await projects.list();
    expect(listed.projects).toHaveLength(0);
    expect(listed.corruptCount).toBe(1);
  });
});

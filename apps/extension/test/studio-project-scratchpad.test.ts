import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatCorruptProjectMessage, SCRATCHPAD_PROJECT_ID, StudioProjectStore } from "../src/studioProjectStore.js";

const roots: string[] = [];
const blankSnapshot = JSON.stringify({ document: { schema: {}, store: {} } });
const editedSnapshot = JSON.stringify({ document: { schema: { version: 1 }, store: {} } });

function workspace() {
  const root = mkdtempSync(path.join(os.tmpdir(), "studio-scratchpad-test-"));
  roots.push(root);
  const projectPath = path.join(root, ".codex-avatar", "studio", "projects", `${SCRATCHPAD_PROJECT_ID}.json`);
  return { root, projectPath, store: new StudioProjectStore(() => root) };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("permanent Scratchpad project", () => {
  it("creates the reserved project once and preserves subsequent edits", async () => {
    const { store, projectPath } = workspace();
    const created = await store.ensureScratchpad(blankSnapshot);
    expect(created).toMatchObject({ id: SCRATCHPAD_PROJECT_ID, title: "Scratchpad" });
    expect((await store.open(SCRATCHPAD_PROJECT_ID)).snapshot).toBe(blankSnapshot);

    const edited = await store.save(SCRATCHPAD_PROJECT_ID, "Scratchpad", editedSnapshot);
    const originalBytes = readFileSync(projectPath, "utf8");
    expect(await store.ensureScratchpad(blankSnapshot)).toEqual(edited);
    expect(readFileSync(projectPath, "utf8")).toBe(originalBytes);
    expect((await store.open(SCRATCHPAD_PROJECT_ID)).snapshot).toBe(editedSnapshot);
  });

  it("keeps Scratchpad first and refuses deletion", async () => {
    const { store } = workspace();
    await store.ensureScratchpad(blankSnapshot);
    const otherId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    await store.save(otherId, "Newer board", blankSnapshot);
    expect((await store.list()).projects.map((project) => project.id)).toEqual([SCRATCHPAD_PROJECT_ID, otherId]);
    await expect(store.delete(SCRATCHPAD_PROJECT_ID)).rejects.toMatchObject({
      code: "workspace",
      message: "Scratchpad is permanent and cannot be deleted."
    });
    expect(await store.open(SCRATCHPAD_PROJECT_ID)).toMatchObject({ id: SCRATCHPAD_PROJECT_ID });
    await store.delete(otherId);
    expect((await store.list()).projects).toHaveLength(1);
  });

  it("does not replace a corrupt Scratchpad file", async () => {
    const { store, projectPath } = workspace();
    await store.ensureScratchpad(blankSnapshot);
    writeFileSync(projectPath, "{damaged");
    await expect(store.ensureScratchpad(editedSnapshot)).rejects.toMatchObject({ code: "corrupt" });
    expect(readFileSync(projectPath, "utf8")).toBe("{damaged");
    const listed = await store.list();
    expect(listed.corruptCount).toBe(1);
    expect(listed.corruptNames).toEqual([`${SCRATCHPAD_PROJECT_ID}.json`]);
  });

  it("rejects an invalid provisioning snapshot before writing", async () => {
    const { store } = workspace();
    await expect(store.ensureScratchpad("{}")).rejects.toMatchObject({ code: "corrupt" });
    expect((await store.list()).projects).toHaveLength(0);
  });

  it("handles concurrent first-time provisioning without replacing a project", async () => {
    const { store } = workspace();
    const results = await Promise.all([store.ensureScratchpad(blankSnapshot), store.ensureScratchpad(editedSnapshot)]);
    expect(results[0]).toEqual(results[1]);
    expect((await store.list()).projects).toHaveLength(1);
    const persisted = await store.open(SCRATCHPAD_PROJECT_ID);
    expect([blankSnapshot, editedSnapshot]).toContain(persisted.snapshot);
  });
});

describe("corrupt project details", () => {
  it("names damaged files and stays inside the protocol message limit", () => {
    const name = `${SCRATCHPAD_PROJECT_ID}.json`;
    expect(formatCorruptProjectMessage(1, [name])).toBe(
      `1 damaged project file was left in place for recovery. ${name}.`
    );
    expect(formatCorruptProjectMessage(1, ["../secret.json"])).toBe(
      "1 damaged project file was left in place for recovery."
    );
    const many = Array.from({ length: 40 }, () => `${SCRATCHPAD_PROJECT_ID}.json`);
    expect(formatCorruptProjectMessage(40, many).length).toBeLessThanOrEqual(500);
  });
});

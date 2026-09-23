import { describe, expect, it } from "vitest";
import { parseImportedStudioProject } from "../src/projects/importProjectFile.js";
import { buildStudioProjectExport, formatEditorSaveStatus, studioExportFileName } from "../src/projects/exportProjectFile.js";

describe("editor save status and export", () => {
  it("uses the four honest save labels", () => {
    expect(formatEditorSaveStatus("Saved")).toEqual({ label: "Auto-saved", retry: false });
    expect(formatEditorSaveStatus("Saving…")).toEqual({ label: "Saving…", retry: false });
    expect(formatEditorSaveStatus("Browser session only")).toEqual({ label: "Offline – kept locally", retry: false });
    expect(formatEditorSaveStatus("Save failed")).toEqual({ label: "Save failed", retry: true });
    expect(formatEditorSaveStatus("Traced locally. Nothing was uploaded.")).toEqual({
      label: "Traced locally. Nothing was uploaded.",
      retry: false
    });
  });

  it("writes a project file that can be imported again", () => {
    const snapshot = JSON.stringify({ document: { schema: { sequences: {} }, store: {} } });
    const json = buildStudioProjectExport({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Scratchpad",
      snapshot,
      now: "2026-09-23T18:00:00.000Z"
    });
    expect(parseImportedStudioProject(json)).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Scratchpad",
      snapshot
    });
    expect(studioExportFileName("Landing page")).toBe("landing-page.studio.json");
  });
});

import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { describe, expect, it, vi } from "vitest";
import {
  buildStudioProjectExport,
  formatEditorSaveStatus,
  safeExportFileName,
  stableExportSvgIds,
  studioExportFileName
} from "../src/projects/exportProjectFile.js";
import { svgViewBoxSize } from "../src/projects/fittedMediaSize.js";
import { inlineStandaloneAssetSources } from "../src/projects/hostAssetStore.js";
import { parseImportedStudioProject } from "../src/projects/importProjectFile.js";
import { readSanitizedSvgFile } from "../src/projects/localAssets.js";

describe("editor save status and export", () => {
  it("uses the four honest save labels", () => {
    expect(formatEditorSaveStatus("Saved")).toEqual({ label: "Auto-saved", retry: false });
    expect(formatEditorSaveStatus("Saving…")).toEqual({ label: "Saving…", retry: false });
    expect(formatEditorSaveStatus("Browser session only")).toEqual({ label: "Offline – kept locally", retry: false });
    expect(formatEditorSaveStatus("Saved in this browser")).toEqual({ label: "Saved in this browser", retry: false });
    expect(formatEditorSaveStatus("Save failed")).toEqual({ label: "Save failed", retry: true });
    expect(formatEditorSaveStatus("This browser is out of space. Export a backup, then remove a project.")).toEqual({
      label: "This browser is out of space. Export a backup, then remove a project.",
      retry: false,
      exportBackup: true
    });
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
    expect(safeExportFileName("../Secret blend", "svg")).toBe("secret-blend.svg");
    expect(safeExportFileName("Frame", "png")).toBe("frame.png");
  });

  it("inlines a standalone asset so the project file opens without the host", async () => {
    const assetId = "99f97a71-a01a-46db-b0c0-bdfdc28b1c1a";
    const snapshot = JSON.stringify({
      document: { schema: { version: 1 }, store: { src: `/assets/${assetId}` } }
    });
    const fetchImpl = async (url: string) => {
      expect(url).toBe(`/assets/${assetId}`);
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
    };
    vi.stubGlobal("fetch", fetchImpl);
    try {
      const inlined = await inlineStandaloneAssetSources(snapshot);
      expect(inlined).toContain("data:image/png;base64,AQID");
      expect(inlined).not.toContain(`/assets/${assetId}`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects a corrupt project file", () => {
    expect(() => parseImportedStudioProject("{")).toThrow(/not valid Studio project JSON/);
    const corrupt = JSON.stringify({
      createdAt: "2026-09-23T18:00:00.000Z",
      formatVersion: 1,
      id: "00000000-0000-4000-8000-000000000001",
      snapshot: "not-json",
      title: "Board",
      updatedAt: "2026-09-23T18:00:00.000Z"
    });
    expect(() => parseImportedStudioProject(corrupt)).toThrow(/could not read the canvas/);
  });

  it("exports an inserted SVG without scripts and keeps the viewBox", async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><script>alert(1)</script><rect /></svg>'],
      "mark.svg",
      { type: "image/svg+xml" }
    );
    const inserted = await readSanitizedSvgFile(file);
    const exported = sanitizeSvg(inserted);
    expect(exported.toLowerCase()).not.toContain("script");
    expect(svgViewBoxSize(exported)).toEqual({ width: 20, height: 10 });
    expect(safeExportFileName("mark", "svg")).toBe("mark.svg");
  });

  it("drops tldraw's export counter so two exports of the same shape match", () => {
    const shape = "shape_8vK8bEAgHu46oGJgCjp9Z";
    const first = `<clipPath id="_export_1_r_8__${shape}"></clipPath><g clip-path="url(#_export_1_r_8__${shape})"/>`;
    const second = `<clipPath id="_export_1_r_3__${shape}"></clipPath><g clip-path="url(#_export_1_r_3__${shape})"/>`;
    expect(stableExportSvgIds(first)).toBe(stableExportSvgIds(second));
  });
});

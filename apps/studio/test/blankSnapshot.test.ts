import { describe, expect, it } from "vitest";
import { isBlankCanvasSnapshot } from "../src/projects/blankSnapshot.js";
import { projectOpenFailureMessage } from "../src/projects/openFailure.js";

describe("blank canvas snapshots", () => {
  it("recognizes the web Scratchpad placeholder and any record-less store", () => {
    expect(isBlankCanvasSnapshot(JSON.parse('{"document":{"schema":{},"store":{}}}'))).toBe(true);
    expect(isBlankCanvasSnapshot({ document: { schema: { schemaVersion: 2, sequences: {} }, store: {} } })).toBe(true);
  });

  it("leaves real canvases and malformed values to the normal loader", () => {
    const real = {
      document: { schema: { schemaVersion: 2 }, store: { "page:page": { id: "page:page", typeName: "page" } } }
    };
    expect(isBlankCanvasSnapshot(real)).toBe(false);
    expect(isBlankCanvasSnapshot({ document: {} })).toBe(false);
    expect(isBlankCanvasSnapshot({ document: { store: [] } })).toBe(false);
    expect(isBlankCanvasSnapshot(null)).toBe(false);
    expect(isBlankCanvasSnapshot("{}")).toBe(false);
  });
});

describe("project open failure notice", () => {
  it("names the project and says what to do", () => {
    expect(projectOpenFailureMessage("  Claude desk ")).toContain("“Claude desk” could not be opened");
    expect(projectOpenFailureMessage("")).toMatch(/^This project could not be opened/);
  });
});

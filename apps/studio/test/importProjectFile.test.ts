import { describe, expect, it } from "vitest";
import { parseImportedStudioProject } from "../src/projects/importProjectFile.js";

const projectId = "11111111-1111-4111-8111-111111111111";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId,
    title: "Imported page",
    createdAt: "2026-09-23T12:00:00.000Z",
    updatedAt: "2026-09-23T12:00:00.000Z",
    formatVersion: 1,
    snapshot: JSON.stringify({ document: { schema: { schemaVersion: 2 }, store: { "shape:1": { id: "shape:1" } } } }),
    ...overrides
  };
}

describe("imported Studio project files", () => {
  it("accepts a versioned project with a tldraw snapshot", () => {
    expect(parseImportedStudioProject(JSON.stringify(project()))).toMatchObject({
      id: projectId,
      title: "Imported page",
      formatVersion: 1
    });
  });

  it("rejects files that are not Studio projects", () => {
    expect(() => parseImportedStudioProject("{")).toThrow(/not valid Studio project JSON/);
    expect(() => parseImportedStudioProject(JSON.stringify({ title: "Nope" }))).toThrow(
      /not a supported Studio project/
    );
    expect(() =>
      parseImportedStudioProject(JSON.stringify(project({ snapshot: JSON.stringify({ document: {} }) })))
    ).toThrow(/versioned tldraw schema/);
  });
});

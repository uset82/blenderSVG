import { describe, expect, it } from "vitest";
import { createSavedDesignFrame, createSavedShapes, insertSavedSvg, NO_PAGE_ERROR } from "../src/mcpAccess.js";

type Store = Record<string, Record<string, unknown>>;

function projectSnapshot(store: Store = {}) {
  return JSON.stringify({
    document: {
      schema: { schemaVersion: 2, sequences: {} },
      store: {
        "document:document": { id: "document:document", typeName: "document", gridSize: 10, name: "", meta: {} },
        "page:page": { id: "page:page", typeName: "page", name: "Page 1", index: "a1", meta: {} },
        ...store
      }
    }
  });
}

function storeOf(snapshot: string | { error: string }): Store {
  if (typeof snapshot !== "string") throw new Error(snapshot.error);
  return (JSON.parse(snapshot) as { document: { store: Store } }).document.store;
}

const baseFields = [
  "id",
  "typeName",
  "type",
  "x",
  "y",
  "rotation",
  "index",
  "parentId",
  "isLocked",
  "opacity",
  "meta",
  "props"
];

describe("MCP saved-project shape writers", () => {
  it("writes complete tldraw shape records on the project's page", () => {
    const store = storeOf(
      createSavedDesignFrame(projectSnapshot(), "shape:design-1", "Landing", "<h1>Hi</h1><script>x</script>")
    );
    const frame = store["shape:design-1"];
    expect(Object.keys(frame ?? {}).sort()).toEqual([...baseFields].sort());
    expect(frame).toMatchObject({
      id: "shape:design-1",
      typeName: "shape",
      type: "design-frame",
      parentId: "page:page",
      index: "a1",
      props: { w: 800, h: 600, name: "Landing", html: "<h1>Hi</h1>" }
    });
  });

  it("uses the Vector Studio props and orders new shapes above existing ones", () => {
    const first = createSavedDesignFrame(projectSnapshot(), "shape:a", "A", "");
    if (typeof first !== "string") throw new Error(first.error);
    const store = storeOf(
      insertSavedSvg(first, "shape:svg-1", '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    );
    expect(store["shape:svg-1"]).toMatchObject({
      type: "vector-studio",
      props: {
        lastSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
        engine: "vtracer",
        isProcessing: false
      }
    });
    expect(String(store["shape:svg-1"]?.index) > String(store["shape:a"]?.index)).toBe(true);
  });

  it("creates named frames with a valid size and prefixes bare ids", () => {
    const store = storeOf(createSavedShapes(projectSnapshot(), [{ id: "box", name: "Box", w: 0, h: 30 }]));
    expect(store["shape:box"]).toMatchObject({ type: "frame", props: { name: "Box", w: 1, h: 30, color: "black" } });
  });

  it("refuses to write when the project has no page instead of saving a broken canvas", () => {
    const pageless = JSON.stringify({ document: { schema: {}, store: {} } });
    expect(createSavedDesignFrame(pageless, "shape:x", "X", "")).toEqual({ error: NO_PAGE_ERROR });
    expect(createSavedShapes(pageless, [{ id: "shape:y", name: "Y", w: 1, h: 1 }])).toEqual({ error: NO_PAGE_ERROR });
  });
});

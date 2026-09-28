import { describe, expect, it } from "vitest";
import {
  addDesignVersion,
  DESIGN_VERSIONS_META_KEY,
  type DesignFrameSnapshot,
  type DesignVersionStore,
  hashHtml,
  MAX_DESIGN_VERSION_CHARS,
  MAX_DESIGN_VERSIONS,
  planDesignRestore,
  readDesignVersionStore,
  summarizeDesignVersions
} from "../src/components/designVersions.js";

const empty: DesignVersionStore = { versions: [], html: {} };
const now = new Date("2026-09-28T10:00:00Z");

function frame(id: string, html: string, overrides: Partial<DesignFrameSnapshot> = {}): DesignFrameSnapshot {
  return { id, parentId: "page:page", name: id, x: 0, y: 0, w: 1440, h: 900, html, ...overrides };
}

describe("design versions", () => {
  it("records a version per change and stores identical HTML once", () => {
    const desktop = frame("shape:desktop", "<main>light</main>");
    const v1 = addDesignVersion(empty, [desktop], "Design a landing page", now, "v1");
    const v2 = addDesignVersion(
      v1,
      [frame("shape:desktop", "<main>dark</main>"), frame("shape:mobile", "<main>light</main>", { w: 390 })],
      "make the hero dark and add a mobile version",
      now,
      "v2"
    );
    expect(v2.versions.map((version) => version.id)).toEqual(["v1", "v2"]);
    expect(Object.keys(v2.html)).toHaveLength(2);
    expect(v2.versions[1]?.frames.find((item) => item.id === "shape:mobile")?.hash).toBe(
      hashHtml("<main>light</main>")
    );
  });

  it("skips pages without design frames and replies that changed nothing", () => {
    expect(addDesignVersion(empty, [], "anything", now, "v1")).toBe(empty);
    const v1 = addDesignVersion(empty, [frame("shape:a", "<main>a</main>")], "first", now, "v1");
    expect(addDesignVersion(v1, [frame("shape:a", "<main>a</main>")], "again", now, "v2")).toBe(v1);
    // Moving a frame is a change.
    expect(
      addDesignVersion(v1, [frame("shape:a", "<main>a</main>", { x: 800 })], "moved", now, "v2").versions
    ).toHaveLength(2);
  });

  it("keeps labels short and single-line", () => {
    const store = addDesignVersion(empty, [frame("shape:a", "<main/>")], `  Make\n${"a".repeat(200)}  `, now, "v1");
    const label = store.versions[0]?.label ?? "";
    expect(label.length).toBeLessThanOrEqual(80);
    expect(label.startsWith("Make a")).toBe(true);
    expect(label.endsWith("…")).toBe(true);
    expect(addDesignVersion(empty, [frame("shape:a", "<main/>")], "   ", now, "v1").versions[0]?.label).toBe(
      "Agent reply"
    );
  });

  it("drops the oldest versions past the count and size limits, with their HTML", () => {
    let store = empty;
    for (let index = 0; index < MAX_DESIGN_VERSIONS + 5; index += 1) {
      store = addDesignVersion(store, [frame("shape:a", `<main>${index}</main>`)], `turn ${index}`, now, `v${index}`);
    }
    expect(store.versions).toHaveLength(MAX_DESIGN_VERSIONS);
    expect(store.versions[0]?.id).toBe("v5");
    expect(Object.keys(store.html)).toHaveLength(MAX_DESIGN_VERSIONS);

    const big = "x".repeat(Math.floor(MAX_DESIGN_VERSION_CHARS / 2) + 10);
    let sized = empty;
    for (const index of [1, 2, 3]) {
      sized = addDesignVersion(sized, [frame("shape:a", `${big}${index}`)], `big ${index}`, now, `b${index}`);
    }
    expect(sized.versions.map((version) => version.id)).toEqual(["b3"]);
    expect(Object.keys(sized.html)).toEqual([hashHtml(`${big}3`)]);
  });

  it("reads only well-formed versions from page meta", () => {
    const store = addDesignVersion(empty, [frame("shape:a", "<main>a</main>")], "first", now, "v1");
    expect(readDesignVersionStore({ [DESIGN_VERSIONS_META_KEY]: store })).toEqual(store);
    expect(readDesignVersionStore(undefined)).toEqual(empty);
    expect(readDesignVersionStore({ [DESIGN_VERSIONS_META_KEY]: "nope" })).toEqual(empty);
    const broken = {
      versions: [
        ...store.versions,
        { id: "v2", label: "x", createdAt: "t", frames: [{ id: "shape:b", hash: "missing" }] }
      ],
      html: { ...store.html, bad: 42 }
    };
    expect(readDesignVersionStore({ [DESIGN_VERSIONS_META_KEY]: broken }).versions.map((v) => v.id)).toEqual(["v1"]);
  });

  it("lists versions newest first and marks the one on the canvas", () => {
    const v1 = addDesignVersion(empty, [frame("shape:a", "<main>1</main>")], "first", now, "v1");
    const v2 = addDesignVersion(v1, [frame("shape:a", "<main>2</main>")], "second", now, "v2");
    const summary = summarizeDesignVersions(v2, [frame("shape:a", "<main>1</main>")]);
    expect(summary.map(({ id, number, current }) => ({ id, number, current }))).toEqual([
      { id: "v2", number: 2, current: false },
      { id: "v1", number: 1, current: true }
    ]);
    expect(summarizeDesignVersions(v2, []).some((version) => version.current)).toBe(false);
  });

  it("plans a restore: frames back with their HTML, newer frames removed", () => {
    const v1 = addDesignVersion(empty, [frame("shape:desktop", "<main>light</main>")], "first", now, "v1");
    const current = [frame("shape:desktop", "<main>dark</main>"), frame("shape:mobile", "<main>m</main>", { w: 390 })];
    const v2 = addDesignVersion(v1, current, "second", now, "v2");
    expect(planDesignRestore(v2, "v1", current)).toEqual({
      frames: [frame("shape:desktop", "<main>light</main>")],
      remove: ["shape:mobile"]
    });
    expect(planDesignRestore(v2, "missing", current)).toBeNull();
  });
});

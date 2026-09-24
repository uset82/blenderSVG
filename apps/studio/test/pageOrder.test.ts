import { describe, expect, it } from "vitest";
import { movePageIndexes } from "../src/components/pageOrder.js";

describe("page order", () => {
  it("swaps a page with its neighbor and refuses the ends of the list", () => {
    const pages = [
      { id: "a", index: "a1" },
      { id: "b", index: "a2" }
    ];
    expect(movePageIndexes(pages, "b", -1)).toEqual([
      { id: "b", index: "a1" },
      { id: "a", index: "a2" }
    ]);
    expect(movePageIndexes(pages, "a", -1)).toBeNull();
    expect(movePageIndexes(pages, "missing", 1)).toBeNull();
  });

  it("keeps pinned pages in place while allowing other pages to move", () => {
    const pages = [
      { id: "scratchpad", index: "a1" },
      { id: "a", index: "a2" },
      { id: "b", index: "a3" }
    ];
    const pinned = new Set(["scratchpad"]);
    expect(movePageIndexes(pages, "scratchpad", 1, pinned)).toBeNull();
    expect(movePageIndexes(pages, "a", -1, pinned)).toBeNull();
    expect(movePageIndexes(pages, "a", 1, pinned)).toEqual([
      { id: "a", index: "a3" },
      { id: "b", index: "a2" }
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { applyHtmlEdits, placeDesignFrame } from "../src/designFrames.js";
import { DESIGN_FRAME_GAP } from "../src/limits.js";

const center = { x: 0, y: 0 };

describe("design frame placement", () => {
  it("centres the first frame in the viewport", () => {
    expect(placeDesignFrame({ width: 1440, height: 900, existing: [], viewportCenter: { x: 1000, y: 500 } })).toEqual({
      x: 280,
      y: 50
    });
  });

  it("places a new frame to the right of the rightmost frame, top-aligned", () => {
    const existing = [
      { id: "a", x: 0, y: 100, w: 1440, h: 3000 },
      { id: "b", x: 1600, y: 40, w: 390, h: 2000 }
    ];
    expect(placeDesignFrame({ width: 390, height: 2000, existing, viewportCenter: center })).toEqual({
      x: 1600 + 390 + DESIGN_FRAME_GAP,
      y: 40
    });
  });

  it("places relative to a given frame, right or below", () => {
    const anchor = { id: "a", x: 0, y: 0, w: 1440, h: 3000 };
    expect(
      placeDesignFrame({ width: 390, height: 2000, existing: [anchor], relativeTo: anchor, viewportCenter: center })
    ).toEqual({
      x: 1440 + DESIGN_FRAME_GAP,
      y: 0
    });
    expect(
      placeDesignFrame({
        width: 1440,
        height: 900,
        existing: [anchor],
        relativeTo: anchor,
        side: "below",
        viewportCenter: center
      })
    ).toEqual({ x: 0, y: 3000 + DESIGN_FRAME_GAP });
  });

  it("shifts right until the new frame overlaps nothing", () => {
    const anchor = { id: "a", x: 0, y: 0, w: 1440, h: 3000 };
    const blocker = { id: "b", x: 1600, y: 0, w: 390, h: 2000 };
    const spot = placeDesignFrame({
      width: 390,
      height: 2000,
      existing: [anchor, blocker],
      relativeTo: anchor,
      viewportCenter: center
    });
    expect(spot).toEqual({ x: 1600 + 390 + DESIGN_FRAME_GAP, y: 0 });
  });
});

describe("exact HTML edits", () => {
  const html = '<section class="hero" style="background:#f6f1ea"><h1>Make something</h1></section><p>a</p><p>a</p>';

  it("applies edits in order when each find matches once", () => {
    const result = applyHtmlEdits(html, [
      { find: "background:#f6f1ea", replace: "background:#1d1a17;color:#fff" },
      { find: "<h1>Make something</h1>", replace: "<h1>Make something beautiful</h1>" }
    ]);
    expect(result).toEqual({
      ok: true,
      applied: 2,
      html: '<section class="hero" style="background:#1d1a17;color:#fff"><h1>Make something beautiful</h1></section><p>a</p><p>a</p>'
    });
  });

  it("fails without changing anything when a find is missing or ambiguous", () => {
    const missing = applyHtmlEdits(html, [
      { find: "<h1>Make something</h1>", replace: "<h1>Changed</h1>" },
      { find: "not there", replace: "x" }
    ]);
    expect(missing.ok).toBe(false);
    expect(missing.ok ? "" : missing.error).toMatch(/Edit 2: the find text was not found.*No edits were applied/);
    const ambiguous = applyHtmlEdits(html, [{ find: "<p>a</p>", replace: "<p>b</p>" }]);
    expect(ambiguous.ok ? "" : ambiguous.error).toMatch(/matched 2 places/);
    expect(applyHtmlEdits(html, [{ find: "", replace: "x" }]).ok).toBe(false);
  });

  it("allows an empty replacement to delete text", () => {
    const result = applyHtmlEdits(html, [{ find: "<p>a</p><p>a</p>", replace: "" }]);
    expect(result.ok && result.html).toBe(
      '<section class="hero" style="background:#f6f1ea"><h1>Make something</h1></section>'
    );
  });
});

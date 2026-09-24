import { describe, expect, it } from "vitest";
import { keepVariant, variantCount, variantFrames } from "../src/variantRun.js";

describe("variant runs", () => {
  it("places one to four frames side by side", () => {
    expect(variantCount(0)).toBe(1);
    expect(variantCount(9)).toBe(4);
    const frames = variantFrames(3);
    expect(frames.map((frame) => frame.x)).toEqual([0, 848, 1696]);
  });

  it("keeps one successful variant and drops the failures", () => {
    const decision = keepVariant(
      [
        { index: 0, modelId: "a/one", ok: false, error: "The model returned an empty reply." },
        { index: 1, modelId: "b/two", ok: true },
        { index: 2, modelId: "c/three", ok: false, error: "The request timed out." }
      ],
      1
    );
    expect(decision).toEqual({ kept: 1, discarded: [0, 2] });
    expect(keepVariant([{ index: 0, modelId: "a/one", ok: false, error: "failed" }], 0).kept).toBeNull();
  });
});

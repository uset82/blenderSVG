import { describe, expect, it } from "vitest";
import { effectiveComposerMode } from "../src/components/toolModeFallback.js";

describe("tool mode fallback", () => {
  it("keeps the chosen mode and explains how a model without tools still designs", () => {
    expect(effectiveComposerMode("plan", true)).toEqual({ mode: "plan", reason: null });
    expect(effectiveComposerMode("auto", false).mode).toBe("auto");
    expect(effectiveComposerMode("build", false).reason).toMatch(/places on the canvas/);
    expect(effectiveComposerMode("ask", false).reason).toBeNull();
    expect(effectiveComposerMode("plan", false).reason).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { effectiveComposerMode } from "../src/components/toolModeFallback.js";

describe("tool mode fallback", () => {
  it("keeps plan when the model lists tools and falls back to ask otherwise", () => {
    expect(effectiveComposerMode("plan", true)).toEqual({ mode: "plan", reason: null });
    expect(effectiveComposerMode("build", false).mode).toBe("ask");
    expect(effectiveComposerMode("build", false).reason).toMatch(/does not list tool support/);
    expect(effectiveComposerMode("ask", false).reason).toBeNull();
  });
});

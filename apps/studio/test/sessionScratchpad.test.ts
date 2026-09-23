import { describe, expect, it } from "vitest";
import { isSessionScratchpad } from "../src/components/sessionScratchpad.js";

describe("session scratchpad", () => {
  it("recognizes only the permanent draft mark", () => {
    expect(isSessionScratchpad({ meta: { studioScratchpad: true } })).toBe(true);
    expect(isSessionScratchpad({ meta: {} })).toBe(false);
    expect(isSessionScratchpad({ meta: { studioScratchpad: false } })).toBe(false);
  });
});

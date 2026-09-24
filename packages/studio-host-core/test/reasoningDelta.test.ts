import { describe, expect, it } from "vitest";
import { reasoningDelta } from "../src/openRouterChat.js";

describe("reasoning deltas", () => {
  it("reads reasoning text and ignores ordinary content", () => {
    expect(reasoningDelta({ reasoning: "Look at the frame." })).toBe("Look at the frame.");
    expect(reasoningDelta({ content: "Hello" })).toBe("");
  });
});

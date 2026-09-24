import { describe, expect, it } from "vitest";
import { retryAfterMs } from "../src/openRouterChat.js";

describe("chat retry delay", () => {
  it("backs off and stays within four seconds", () => {
    expect(retryAfterMs(0)).toBe(500);
    expect(retryAfterMs(1)).toBe(1000);
    expect(retryAfterMs(4)).toBe(4000);
  });
});

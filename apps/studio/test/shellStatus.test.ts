import { describe, expect, it } from "vitest";
import { chatRunStatusLabel } from "../src/components/shellStatus.js";

describe("shell chat status", () => {
  it("names generating, canceling, success, and error without inventing a reply", () => {
    expect(chatRunStatusLabel("streaming")).toBe("Generating…");
    expect(chatRunStatusLabel("stopping")).toBe("Canceling…");
    expect(chatRunStatusLabel("complete")).toBe("Reply finished.");
    expect(chatRunStatusLabel("error")).toBe("The reply failed.");
    expect(chatRunStatusLabel(undefined)).toBeNull();
  });
});

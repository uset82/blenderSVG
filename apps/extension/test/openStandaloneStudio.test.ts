import { describe, expect, it } from "vitest";
import { parseStudioLaunchUrl, studioServerEntry } from "../src/openStandaloneStudio.js";

describe("standalone studio launch", () => {
  it("reads the loopback URL printed by the host", () => {
    expect(parseStudioLaunchUrl("listening\nhttp://127.0.0.1:4173/?studioToken=abc123\n")).toBe(
      "http://127.0.0.1:4173/?studioToken=abc123"
    );
    expect(parseStudioLaunchUrl("no url")).toBeNull();
  });

  it("does not invent a server path outside a workspace", () => {
    expect(studioServerEntry(undefined)).toBeNull();
    expect(studioServerEntry("D:\\missing\\workspace")).toBeNull();
  });
});

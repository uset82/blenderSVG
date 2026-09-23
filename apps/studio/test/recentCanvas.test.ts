import { describe, expect, it } from "vitest";
import { formatEditedLabel, stampCanvasTimes } from "../src/components/recentCanvas.js";

describe("recent canvas labels", () => {
  it("formats a four-hour-old edit", () => {
    const now = Date.parse("2026-09-23T16:00:00.000Z");
    expect(formatEditedLabel("2026-09-23T12:00:00.000Z", now)).toBe("Edited 4h ago");
  });

  it("keeps older canvases still when the current page is edited", () => {
    const stamped = stampCanvasTimes(
      { "page:old": { createdAt: "2026-09-23T10:00:00.000Z", updatedAt: "2026-09-23T11:00:00.000Z" } },
      [{ id: "page:old" }, { id: "page:new" }],
      "page:new",
      true,
      "2026-09-23T12:00:00.000Z"
    );
    expect(stamped["page:old"]?.updatedAt).toBe("2026-09-23T11:00:00.000Z");
    expect(stamped["page:new"]?.updatedAt).toBe("2026-09-23T12:00:00.000Z");
  });
});

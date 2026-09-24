import { describe, expect, it } from "vitest";
import { paidModelCue, sendContextLines } from "../src/components/privacyContext.js";

describe("privacy context", () => {
  it("lists the model, draft, history, image, and excludes the key", () => {
    const lines = sendContextLines({
      modelName: "Example",
      draftCharacters: 12,
      historyCount: 2,
      attachmentName: "shot.png"
    });
    expect(lines.join(" ")).toContain("Model: Example");
    expect(lines.join(" ")).toContain("Image: shot.png");
    expect(lines.join(" ")).toContain("key is not included");
  });

  it("warns when a model is listed as paid and stays quiet when both prices are zero", () => {
    expect(paidModelCue(0.000001, 0)).toBe("This model is listed as paid.");
    expect(paidModelCue(0, 0)).toBeNull();
    expect(paidModelCue(null, 0)).toMatch(/cannot tell/);
  });
});

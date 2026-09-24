import { describe, expect, it } from "vitest";
import { setRichTextWeight, summarizeTextWeight } from "../src/components/textWeight.js";

describe("text weight formatting", () => {
  it("summarizes empty, regular, bold and mixed selections", () => {
    const regular = documentWithText("plain");
    const bold = documentWithText("heavy", [{ type: "bold" }]);
    const mixed = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "plain" },
            { type: "text", text: " bold", marks: [{ type: "bold" }] }
          ]
        }
      ]
    };

    expect(summarizeTextWeight([])).toBeUndefined();
    expect(summarizeTextWeight([regular])).toBe("regular");
    expect(summarizeTextWeight([bold, bold])).toBe("bold");
    expect(summarizeTextWeight([regular, bold])).toBeNull();
    expect(summarizeTextWeight([mixed])).toBeNull();
  });

  it("changes bold state without removing other marks or document attributes", () => {
    const doc = {
      type: "doc",
      attrs: { language: "en" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello", marks: [{ type: "italic" }] }] }]
    };

    expect(setRichTextWeight(doc, "bold")).toEqual({
      type: "doc",
      attrs: { language: "en" },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello", marks: [{ type: "italic" }, { type: "bold" }] }] }
      ]
    });
    expect(setRichTextWeight(setRichTextWeight(doc, "bold"), "regular")).toEqual(doc);
  });
});

function documentWithText(text: string, marks?: Array<{ type: string }>) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] }]
  };
}

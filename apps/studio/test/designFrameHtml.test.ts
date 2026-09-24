import { describe, expect, it } from "vitest";
import { designFrameSrcDoc, sanitizeDesignHtml } from "../src/shapes/designFrameHtml.js";

describe("design frame html", () => {
  it("strips scripts, event handlers, and remote urls", () => {
    const clean = sanitizeDesignHtml(
      `<h1 onclick="alert(1)">Hi</h1><script>alert(1)</script><img src="https://evil.test/a.png" srcset="https://evil.test/2.png 2x"><style>@import url("https://evil.test/a.css");body{background:url(https://evil.test/a.png)}</style>`
    );
    expect(clean.toLowerCase()).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("https://");
    expect(clean).toContain("<h1>Hi</h1>");
    const doc = designFrameSrcDoc(clean);
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("form-action 'none'");
    expect(doc.toLowerCase()).not.toContain("<script");
  });
});

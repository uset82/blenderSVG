import { describe, expect, it } from "vitest";
import { optimizeSvgForBrowser } from "../src/optimizeSvgBrowser.js";

describe("browser-safe SVG optimization", () => {
  it("removes active content and adds an aspect-preserving viewBox", () => {
    const svg = optimizeSvgForBrowser(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><script>bad()</script><rect width="20" height="10" fill="#ff0000"/></svg>'
    );

    expect(svg).toContain('viewBox="0 0 20 10"');
    expect(svg).toContain("<path");
    expect(svg).not.toContain("script");
  });
});

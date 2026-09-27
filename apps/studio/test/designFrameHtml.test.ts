/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  designFrameExportDocument,
  parseDesign,
  sanitizeDesignCss,
  sanitizeDesignDocument,
  sanitizeDesignHtml
} from "../src/shapes/designHtml.js";

const attack = `<h1 onclick="alert(1)">Hi</h1><script>alert(1)</script><img src="https://evil.test/a.png" srcset="https://evil.test/2.png 2x"><style>@import url("https://evil.test/a.css");body{background:url(https://evil.test/a.png)}</style><a href="javascript:alert(1)">x</a><a href="https://evil.test/">y</a><iframe src="https://evil.test"></iframe><svg><foreignObject><div>z</div></foreignObject><a xlink:href="javascript:alert(1)"><text>t</text></a></svg><link rel="stylesheet" href="https://evil.test/x.css"><form action="https://evil.test"><button formaction="https://evil.test">b</button></form><div style="background-image:url('https://evil.test/p.png');color:red">styled</div>`;

describe("design frame html", () => {
  it("strips scripts, handlers, embeds and every network URL", () => {
    const clean = sanitizeDesignHtml(attack);
    const lower = clean.toLowerCase();
    expect(lower).not.toContain("<script");
    expect(lower).not.toContain("<iframe");
    expect(lower).not.toContain("<link");
    expect(lower).not.toContain("foreignobject");
    expect(lower).not.toContain("javascript:");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("evil.test");
    expect(clean).not.toContain("@import");
    expect(clean).toContain("<h1>Hi</h1>");
    expect(clean).toContain('style="background-image:none;color:red"');
    expect(clean.startsWith("<!doctype html>")).toBe(true);
  });

  it("reports what it removed so the agent can adjust", () => {
    const { removed } = sanitizeDesignDocument(attack);
    expect(removed).toEqual(
      expect.arrayContaining(["1 script", "1 external stylesheet", "1 event handler", "1 CSS @import"])
    );
    expect(removed.some((entry) => /remote image/.test(entry))).toBe(true);
    expect(removed.some((entry) => /remote CSS url/.test(entry))).toBe(true);
    expect(sanitizeDesignDocument("<h1>Plain</h1>").removed).toEqual([]);
  });

  it("keeps CSS, data: images and in-page anchors", () => {
    const html = `<style>:root{--c:#b5542d}.hero{background:var(--c) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>")}</style><section class="hero"><img alt="" src="data:image/png;base64,iVBORw0KGgo="><a href="#classes">Classes</a></section>`;
    const clean = sanitizeDesignHtml(html);
    expect(clean).toContain("--c:#b5542d");
    expect(clean).toContain('url("data:image/svg+xml');
    expect(clean).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(clean).toContain('href="#classes"');
    expect(clean).toMatch(/<head><style>[\s\S]*--c:#b5542d[\s\S]*<\/style><\/head>/);
  });

  it("parses without creating inline style elements or attributes", () => {
    const design = parseDesign('<style>h1{color:red}</style><h1 style="font-size:40px" title="a style=x">Hi</h1>');
    expect(design.css).toEqual(["h1{color:red}"]);
    expect(design.doc.querySelectorAll("style")).toHaveLength(0);
    expect(design.doc.querySelectorAll("[style]")).toHaveLength(0);
    const heading = design.doc.querySelector("h1");
    expect(heading?.getAttribute("data-kurva-style")).toBe("font-size:40px");
    expect(heading?.getAttribute("title")).toBe("a style=x");
  });

  it("drops dangerous CSS constructs", () => {
    expect(sanitizeDesignCss("a{width:expression(alert(1))}")).not.toContain("expression(");
    expect(sanitizeDesignCss("a{-moz-binding:url(x.xml)}")).not.toContain("-moz-binding");
  });

  it("exports a standalone document with charset, viewport and title", () => {
    const file = designFrameExportDocument("<style>h1{color:#123}</style><h1>Hi</h1><script>x</script>", "Clay & Kiln");
    expect(file).toContain('<meta charset="utf-8">');
    expect(file).toContain('name="viewport"');
    expect(file).toContain("<title>Clay &amp; Kiln</title>");
    expect(file).toContain("h1{color:#123}");
    expect(file.toLowerCase()).not.toContain("<script");
  });
});

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  analyzeBlenderSvgCompatibility,
  parseSvgToDocument,
  serializeDocumentToSvg
} from "../src/index.js";

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <defs>
    <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff0000"/>
      <stop offset="1" stop-color="#0000ff"/>
    </linearGradient>
  </defs>
  <g id="layer-head">
    <path id="face" d="M10 10 L90 10 L90 90 L10 90 Z" fill="#ebbe9c" stroke="#333333" stroke-width="2"/>
    <path id="accent" d="M20 20 L80 20 Z" fill="url(#grad1)" stroke="#000000"/>
  </g>
</svg>`;

test("parseSvgToDocument parses viewBox, defs, groups, and paths", () => {
  const doc = parseSvgToDocument(sampleSvg);

  assert.equal(doc.viewBox.width, 200);
  assert.equal(doc.viewBox.height, 100);
  assert.ok(doc.defs["grad1"]);
  assert.equal(doc.defs["grad1"].type, "linearGradient");
  assert.equal(doc.defs["grad1"].stops.length, 2);

  assert.equal(doc.root.children.length, 1);
  const headGroup = doc.root.children[0];
  assert.equal(headGroup?.kind, "group");
  if (headGroup?.kind === "group") {
    assert.equal(headGroup.id, "layer-head");
    assert.equal(headGroup.children.length, 2);

    const facePath = headGroup.children[0];
    assert.equal(facePath?.kind, "path");
    if (facePath?.kind === "path") {
      assert.equal(facePath.id, "face");
      assert.equal(facePath.fill?.type, "solid");
      assert.equal(facePath.stroke?.color, "#333333");
      assert.equal(facePath.stroke?.width, 2);
    }
  }
});

test("serializeDocumentToSvg produces valid SVG matching the parsed IR", () => {
  const doc = parseSvgToDocument(sampleSvg);
  const serialized = serializeDocumentToSvg(doc);

  assert.match(serialized, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 200 100">/);
  assert.match(serialized, /<linearGradient id="grad1"/);
  assert.match(serialized, /<g id="layer-head">/);
  assert.match(serialized, /<path id="face"/);
  assert.match(serialized, /fill="#ebbe9c"/);
});

test("analyzeBlenderSvgCompatibility diagnoses Curve vs Grease Pencil capability", () => {
  const report = analyzeBlenderSvgCompatibility(sampleSvg);

  assert.equal(report.totalPaths, 2);
  assert.equal(report.totalGroups, 1);
  assert.equal(report.solidFills, 1);
  assert.equal(report.gradientFills, 1);
  assert.equal(report.strokes, 2);

  // Recommends Grease Pencil because of fills and gradients
  assert.equal(report.recommendedAdapter, "grease_pencil");
  assert.ok(report.curveCompatibility.dropsFills);
  assert.ok(report.warnings.length > 0);
});

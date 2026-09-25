// @vitest-environment jsdom
import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { describe, expect, it } from "vitest";
import { serializeAvatarSvgSnapshot } from "../src/shapes/avatarPackageSnapshot.js";

describe("avatar SVG snapshot", () => {
  it("inlines safe computed appearance and removes web-only classes and state metadata", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 32 24");
    svg.classList.add("layered-mascot");
    svg.setAttribute("data-avatar-state", "thinking");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("mascot-body");
    path.setAttribute("style", "fill: rgb(208, 70, 30); stroke: rgb(27, 26, 23); stroke-width: 2px");
    path.setAttribute("d", "M2 2h28v20H2z");
    svg.append(path);
    document.body.append(svg);

    try {
      const serialized = serializeAvatarSvgSnapshot(svg);
      const safe = prepareSvgPreview(serialized).svg;
      expect(safe).toContain('width="32"');
      expect(safe).toContain('height="24"');
      expect(safe).toContain('fill="rgb(208, 70, 30)"');
      expect(safe).toContain('stroke-width="2px"');
      expect(safe).not.toContain("class=");
      expect(safe).not.toContain("data-avatar-state");
      expect(safe).not.toMatch(/\sstyle=/);
    } finally {
      svg.remove();
    }
  });
});

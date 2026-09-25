import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VectorAssetDialog } from "../src/components/VectorAssetDialog.js";

describe("vector asset dialog", () => {
  it("renders local image intake, all trace controls, and a disabled insert action before tracing", () => {
    const html = renderToStaticMarkup(<VectorAssetDialog onClose={vi.fn()} onTrace={vi.fn()} onInsert={vi.fn()} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Trace a picture into editable SVG. Runs on this computer; nothing is uploaded.");
    expect(html).toContain('aria-label="Image to trace"');
    expect(html).toContain("Color illustration");
    expect(html).toContain("Clean icon");
    expect(html).toContain("Silhouette");
    expect(html).toContain("Pixel art");
    expect(html).toContain("Advanced settings");
    expect(html).toContain("Color precision");
    expect(html).toContain("Layer difference");
    expect(html).toContain("Speckle filter");
    expect(html).toContain("Corner threshold");
    expect(html).toContain("Length threshold");
    expect(html).toContain("Splice threshold");
    expect(html).toContain("Path mode");
    expect(html).toContain("Layering");
    expect(html).toContain('aria-label="Source and traced SVG comparison"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Insert on canvas<\/button>/);
  });
});

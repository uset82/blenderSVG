import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, Chip, EmptyState, FloatingPill, Kbd, Skeleton } from "../src/ui/base.js";
import { Combobox } from "../src/ui/controlPrimitives.js";

describe("studio ui primitives", () => {
  it("renders a primary button without inventing a busy state", () => {
    const html = renderToStaticMarkup(createElement(Button, { variant: "primary" }, "New file"));
    expect(html).toContain("studio-ui-button--primary");
    expect(html).toContain("New file");
    expect(html).not.toContain("aria-busy");
  });

  it("renders shortcut, empty, skeleton, pill and chip markup", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(Kbd, null, "Ctrl+K"),
        createElement(EmptyState, { title: "No projects yet", description: "Create a file to begin." }),
        createElement(Skeleton, { width: 120, height: 16 }),
        createElement(FloatingPill, null, "Tools"),
        createElement(Chip, { label: "Landing page", pressed: true, onClick: () => undefined })
      )
    );
    expect(html).toContain("<kbd");
    expect(html).toContain("No projects yet");
    expect(html).toContain("studio-ui-skeleton");
    expect(html).toContain("studio-ui-floating-pill");
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps combobox options closed until the picker is opened", () => {
    const html = renderToStaticMarkup(
      createElement(Combobox, {
        label: "Model",
        value: null,
        placeholder: "Choose a model",
        onValueChange: () => undefined,
        options: [
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" }
        ]
      })
    );
    expect(html).toContain("Choose a model");
    expect(html).toContain('aria-label="Model"');
    expect(html).not.toContain("Alpha");
  });
});

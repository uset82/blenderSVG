import { describe, expect, it } from "vitest";
import { extractDesignBlocks, redactDesignBlocks } from "../src/designBlocks.js";
import { buildSystemPrompt } from "../src/designPrompt.js";

const context = {
  pageName: "Scratchpad",
  frames: [
    { id: "shape:empty", name: "Frame", kind: "frame" as const, x: 0, y: 0, width: 1440, height: 1024, empty: true },
    { id: "shape:page", name: "Clay & Kiln", kind: "design-frame" as const, x: 1600, y: 0, width: 1440, height: 3180 }
  ],
  selectedIds: ["shape:page"]
};

describe("design system prompt", () => {
  it("only Chat mode says it cannot change the canvas", () => {
    expect(buildSystemPrompt({ mode: "ask", toolSupport: true })).toContain("cannot change the canvas");
    for (const mode of ["auto", "build"] as const) {
      const prompt = buildSystemPrompt({ mode, toolSupport: true });
      expect(prompt).not.toContain("cannot change the canvas");
      expect(prompt).toContain("create_design_frame");
      expect(prompt).toContain("insert_svg");
      expect(prompt).toContain("dibuja un gato");
      expect(prompt).toContain("Never a single-stroke doodle");
      expect(prompt).toContain("no <script>");
    }
    expect(buildSystemPrompt({ mode: "plan", toolSupport: true })).toContain("cannot change it");
  });

  it("asks models without tools for fenced blocks", () => {
    const prompt = buildSystemPrompt({ mode: "auto", toolSupport: false });
    expect(prompt).toContain("```html");
    expect(prompt).toContain("kurva-frame");
    expect(prompt).not.toContain("patch_design_frame with find");
  });

  it("adds the skill brief and the canvas, including empty frames and the selection", () => {
    const prompt = buildSystemPrompt({ mode: "auto", toolSupport: true, skill: "landing", context });
    expect(prompt).toContain("Design brief: Landing page");
    expect(prompt).toContain('Frame "Frame" (shape:empty), 1440×1024 at 0, 0, empty');
    expect(prompt).toContain('Design frame "Clay & Kiln" (shape:page), 1440×3180');
    expect(prompt).toContain("Selected: shape:page.");
    expect(buildSystemPrompt({ mode: "auto", toolSupport: true, skill: "unknown" })).not.toContain("Design brief");
  });

  it("gives a model without tools the HTML of the frame it may update", () => {
    const prompt = buildSystemPrompt({
      mode: "auto",
      toolSupport: false,
      context: { ...context, target: { id: "shape:page", name: "Clay & Kiln", html: "<main>Hi</main>" } }
    });
    expect(prompt).toContain('Current HTML of "Clay & Kiln" (shape:page)');
    expect(prompt).toContain("<main>Hi</main>");
  });
});

describe("design blocks in a text reply", () => {
  const page =
    '<!-- kurva-frame name="Clay & Kiln — Desktop" width="1440" -->\n<!doctype html><html><head><style>body{margin:0}</style></head><body><main><h1>Clay</h1></main></body></html>';
  const cat =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>Cat</title><circle cx="256" cy="256" r="120" fill="#e0a370"/></svg>';

  it("finds fenced html and svg blocks with their names and widths", () => {
    const reply = `Here is the page.\n\n\`\`\`html\n${page}\n\`\`\`\n\nAnd a cat:\n\`\`\`svg\n${cat}\n\`\`\`\nEnjoy!`;
    const blocks = extractDesignBlocks(reply);
    expect(blocks.map((block) => [block.kind, block.name, block.width, block.complete])).toEqual([
      ["html", "Clay & Kiln — Desktop", 1440, true],
      ["svg", "Cat", 512, true]
    ]);
    const redacted = redactDesignBlocks(reply, blocks, ["Placed “Clay & Kiln — Desktop” (shape:a)", "Placed “Cat”"]);
    expect(redacted).toBe(
      "Here is the page.\n\n[Placed “Clay & Kiln — Desktop” (shape:a)]\n\nAnd a cat:\n[Placed “Cat”]\nEnjoy!"
    );
  });

  it("reads a target frame, accepts raw svg, and keeps a cut-off page but not a cut-off drawing", () => {
    const update = extractDesignBlocks(
      '```html\n<!-- kurva-frame name="Clay" width="390" target="shape:abc" -->\n<body><main>x</main></body>\n```'
    );
    expect(update[0]).toMatchObject({ kind: "html", width: 390, target: "shape:abc" });
    expect(extractDesignBlocks(`¡Claro! Aquí tienes un gatito: ${cat}`)[0]).toMatchObject({ kind: "svg", name: "Cat" });
    const cut = extractDesignBlocks("```html\n<!doctype html><html><body><main><h1>Clay</h1>");
    expect(cut[0]).toMatchObject({ kind: "html", complete: false });
    expect(extractDesignBlocks('```svg\n<svg viewBox="0 0 10 10"><circle')).toEqual([]);
    expect(extractDesignBlocks("```js\nconsole.log(1)\n```")).toEqual([]);
  });
});

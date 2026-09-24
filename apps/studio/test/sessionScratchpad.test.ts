import type { Editor, TLPage, TLPageId } from "tldraw";
import { describe, expect, it } from "vitest";
import { ensureSessionScratchpad, isSessionScratchpad } from "../src/components/sessionScratchpad.js";

function fakeEditor(initialPages: Array<Partial<TLPage> & Pick<TLPage, "id" | "name" | "index">>): Editor {
  const pages = initialPages.map((page) => ({ meta: {}, ...page }) as TLPage);
  const editor = {
    getPages: () =>
      pages.slice().sort((left, right) => (left.index === right.index ? 0 : left.index < right.index ? -1 : 1)),
    getPage: (id: TLPageId) => pages.find((page) => page.id === id),
    getCurrentPageId: () => {
      const first = pages[0];
      if (!first) throw new Error("The fixture must have a current page.");
      return first.id;
    },
    createPage: (page: Partial<TLPage> & Pick<TLPage, "id" | "name">) => {
      pages.push({ meta: {}, index: "a3", ...page } as TLPage);
    },
    updatePage: (page: Partial<TLPage> & Pick<TLPage, "id">) => {
      const current = pages.find((item) => item.id === page.id);
      if (current) Object.assign(current, page);
    },
    run: (callback: () => void) => callback()
  };
  return editor as unknown as Editor;
}

describe("session scratchpad", () => {
  it("recognizes only the permanent draft mark", () => {
    expect(isSessionScratchpad({ meta: { studioScratchpad: true } })).toBe(true);
    expect(isSessionScratchpad({ meta: {} })).toBe(false);
    expect(isSessionScratchpad({ meta: { studioScratchpad: false } })).toBe(false);
  });

  it("creates a marked Scratchpad before the existing pages", () => {
    const editor = fakeEditor([{ id: "page:untitled" as TLPageId, name: "Untitled", index: "a1" }]);
    const id = ensureSessionScratchpad(editor);
    const pages = editor.getPages();
    expect(pages[0]?.id).toBe(id);
    expect(pages[0]?.name).toBe("Scratchpad");
    if (pages[0]) expect(isSessionScratchpad(pages[0])).toBe(true);
    else throw new Error("The Scratchpad should be present.");
  });

  it("moves an existing marked Scratchpad ahead of the other pages", () => {
    const editor = fakeEditor([
      { id: "page:untitled" as TLPageId, name: "Untitled", index: "a1" },
      { id: "page:scratchpad" as TLPageId, name: "Scratchpad", index: "a2", meta: { studioScratchpad: true } }
    ]);
    expect(ensureSessionScratchpad(editor)).toBe("page:scratchpad");
    expect(editor.getPages().map((page) => page.name)).toEqual(["Scratchpad", "Untitled"]);
  });
});

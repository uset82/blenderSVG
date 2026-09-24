import type { Editor, TLPage, TLPageId } from "tldraw";

export function isSessionScratchpad(page: { meta: TLPage["meta"] }): boolean {
  return page.meta.studioScratchpad === true;
}

/** Create the permanent browser draft once and keep it first in the page order. */
export function ensureSessionScratchpad(editor: Editor): TLPageId {
  const existing = editor.getPages().find((page) => isSessionScratchpad(page));
  if (existing) {
    keepFirst(editor, existing.id);
    return existing.id;
  }
  const id = `page:${crypto.randomUUID().replace(/-/g, "")}` as TLPageId;
  editor.createPage({ id, name: "Scratchpad" });
  const created = editor.getPage(id);
  if (!created) return editor.getCurrentPageId();
  editor.updatePage({ id, meta: { ...created.meta, studioScratchpad: true } });
  keepFirst(editor, id);
  return id;
}

function keepFirst(editor: Editor, pinnedId: TLPageId): void {
  const pages = editor
    .getPages()
    .slice()
    .sort((left, right) => compareIndexKeys(left.index, right.index));
  const pinned = pages.find((page) => page.id === pinnedId);
  const first = pages[0];
  if (!pinned || !first || pinned.id === first.id) return;
  const firstIndex = first.index;
  const pinnedIndex = pinned.index;
  editor.run(() => {
    editor.updatePage({ id: pinned.id, index: firstIndex });
    editor.updatePage({ id: first.id, index: pinnedIndex });
  });
}

function compareIndexKeys(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

import type { Editor, TLPage, TLPageId } from "tldraw";

export function isSessionScratchpad(page: { meta: TLPage["meta"] }): boolean {
  return page.meta.studioScratchpad === true;
}

/** Create the permanent browser draft once. An existing marked page is left unchanged. */
export function ensureSessionScratchpad(editor: Editor): TLPageId {
  const existing = editor.getPages().find((page) => isSessionScratchpad(page));
  if (existing) return existing.id;
  const id = `page:${crypto.randomUUID().replace(/-/g, "")}` as TLPageId;
  editor.createPage({ id, name: "Scratchpad" });
  const created = editor.getPage(id);
  if (!created) return editor.getCurrentPageId();
  editor.updatePage({ id, meta: { ...created.meta, studioScratchpad: true } });
  return id;
}

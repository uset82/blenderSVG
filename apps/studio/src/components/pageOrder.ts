export function movePageIndexes(
  pages: readonly { id: string; index: string }[],
  pageId: string,
  direction: -1 | 1,
  pinnedIds: ReadonlySet<string> = new Set()
): Array<{ id: string; index: string }> | null {
  const from = pages.findIndex((page) => page.id === pageId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= pages.length) return null;
  const source = pages[from];
  const target = pages[to];
  if (!source || !target) return null;
  if (pinnedIds.has(source.id) || pinnedIds.has(target.id)) return null;
  return [
    { id: source.id, index: target.index },
    { id: target.id, index: source.index }
  ];
}

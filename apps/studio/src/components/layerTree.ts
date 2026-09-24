export interface LayerShape {
  id: string;
  parentId: string;
  type: string;
  index: string;
  label: string;
  opacity: number;
  locked: boolean;
  hidden: boolean;
}

export interface LayerNode extends LayerShape {
  depth: number;
  children: LayerNode[];
}

export function buildLayerForest(shapes: readonly LayerShape[], pageId: string): LayerNode[] {
  const byParent = new Map<string, LayerShape[]>();
  for (const shape of shapes) {
    const list = byParent.get(shape.parentId) ?? [];
    list.push(shape);
    byParent.set(shape.parentId, list);
  }
  const build = (parentId: string, depth: number): LayerNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((left, right) => (left.index === right.index ? 0 : left.index > right.index ? -1 : 1))
      .map((shape) => ({ ...shape, depth, children: build(shape.id, depth + 1) }));
  return build(pageId, 0);
}

export function flattenLayerForest(nodes: readonly LayerNode[]): LayerNode[] {
  const rows: LayerNode[] = [];
  const visit = (node: LayerNode) => {
    rows.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return rows;
}

export function layerWindow(
  count: number,
  scrollTop: number,
  viewport: number,
  rowHeight = 36,
  overscan = 8
): { start: number; end: number } {
  if (count <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start, end };
}

export function reorderSiblingIndexes(
  shapes: readonly Pick<LayerShape, "id" | "parentId" | "index">[],
  draggedId: string,
  targetId: string
): Array<{ id: string; index: string }> | null {
  if (draggedId === targetId) return null;
  const dragged = shapes.find((shape) => shape.id === draggedId);
  const target = shapes.find((shape) => shape.id === targetId);
  if (!dragged || !target || dragged.parentId !== target.parentId) return null;
  return [
    { id: dragged.id, index: target.index },
    { id: target.id, index: dragged.index }
  ];
}

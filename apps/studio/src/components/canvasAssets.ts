import type { Editor } from "tldraw";

export type CanvasAssetKind = "image" | "svg" | "avatar";

export interface CanvasAssetRecord {
  id: string;
  kind: CanvasAssetKind;
  label: string;
}

const DRAG_PREFIX = "studio-asset:";

export function collectCanvasAssets(input: {
  assets: ReadonlyArray<{ id: string; type: string; label: string }>;
  shapes: ReadonlyArray<{ id: string; type: string; label: string }>;
}): CanvasAssetRecord[] {
  const items: CanvasAssetRecord[] = [];
  for (const asset of input.assets) {
    if (asset.type !== "image") continue;
    items.push({ id: asset.id, kind: "image", label: asset.label.trim() || "Image" });
  }
  for (const shape of input.shapes) {
    if (shape.type === "vector-studio") items.push({ id: shape.id, kind: "svg", label: shape.label.trim() || "SVG" });
    if (shape.type === "avatar") items.push({ id: shape.id, kind: "avatar", label: shape.label.trim() || "Avatar" });
  }
  return items;
}

export function encodeAssetDrag(item: Pick<CanvasAssetRecord, "kind" | "id">): string {
  return `${DRAG_PREFIX}${item.kind}:${item.id}`;
}

export function decodeAssetDrag(value: string): { kind: CanvasAssetKind; id: string } | null {
  const match = /^studio-asset:(image|svg|avatar):([A-Za-z0-9:_-]+)$/.exec(value);
  if (!match?.[1] || !match[2]) return null;
  return { kind: match[1] as CanvasAssetKind, id: match[2] };
}

/** Add an existing image or custom canvas asset at a point on the current page. */
export function placeCanvasAsset(
  editor: Editor,
  item: { kind: CanvasAssetKind; id: string },
  point: { x: number; y: number }
): boolean {
  if (item.kind === "image") {
    const asset = editor.getAsset(item.id as Parameters<Editor["getAsset"]>[0]);
    if (asset?.type !== "image") return false;
    editor.createShape({
      type: "image",
      x: point.x - asset.props.w / 2,
      y: point.y - asset.props.h / 2,
      props: { assetId: asset.id, w: asset.props.w, h: asset.props.h }
    });
    return true;
  }

  const shape = editor.getShape(item.id as Parameters<Editor["getShape"]>[0]);
  if (
    !shape ||
    (item.kind === "svg" && shape.type !== "vector-studio") ||
    (item.kind === "avatar" && shape.type !== "avatar")
  ) {
    return false;
  }

  const dimensions = shape.props as { w?: unknown; h?: unknown };
  const width = typeof dimensions.w === "number" && dimensions.w > 0 ? dimensions.w : 400;
  const height = typeof dimensions.h === "number" && dimensions.h > 0 ? dimensions.h : 400;
  editor.createShape({
    type: shape.type,
    x: point.x - width / 2,
    y: point.y - height / 2,
    props: { ...shape.props }
  } as Parameters<Editor["createShape"]>[0]);
  return true;
}

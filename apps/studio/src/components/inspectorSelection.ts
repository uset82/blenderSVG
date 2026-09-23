import type { InspectedShape } from "./StudioInspector.js";

export interface ShapeSelectionEntry {
  id: string;
  type: string;
  x: number;
  y: number;
  props: { w?: unknown; h?: unknown };
}

export function summarizeShapeSelection(selected: ShapeSelectionEntry[]): InspectedShape | null {
  if (selected.length === 0) return null;
  const types = [...new Set(selected.map((shape) => shape.type))];
  const width = commonNumber(selected.map((shape) => (typeof shape.props.w === "number" ? shape.props.w : undefined)));
  const height = commonNumber(selected.map((shape) => (typeof shape.props.h === "number" ? shape.props.h : undefined)));
  return {
    ...(selected.length === 1 ? { id: selected[0]!.id } : {}),
    type: types.length === 1 ? types[0]! : "Mixed selection",
    count: selected.length,
    x: commonNumber(selected.map((shape) => shape.x)) ?? null,
    y: commonNumber(selected.map((shape) => shape.y)) ?? null,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {})
  };
}

function commonNumber(values: Array<number | undefined>): number | null | undefined {
  if (values.length === 0 || values.every((value) => value === undefined)) return undefined;
  const first = values[0];
  if (typeof first !== "number" || !values.every((value) => value === first)) return null;
  return first;
}

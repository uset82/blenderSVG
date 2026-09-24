import type { InspectedShape } from "./StudioInspector.js";

export interface ShapeSelectionEntry {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  props: {
    w?: unknown;
    h?: unknown;
    fill?: unknown;
    dash?: unknown;
    color?: unknown;
    geo?: unknown;
    font?: unknown;
    size?: unknown;
    textAlign?: unknown;
    richText?: unknown;
  };
  meta?: { studioRadius?: unknown };
}

export function summarizeShapeSelection(selected: ShapeSelectionEntry[]): InspectedShape | null {
  if (selected.length === 0) return null;
  const types = [...new Set(selected.map((shape) => shape.type))];
  const width = commonNumber(selected.map((shape) => (typeof shape.props.w === "number" ? shape.props.w : undefined)));
  const height = commonNumber(selected.map((shape) => (typeof shape.props.h === "number" ? shape.props.h : undefined)));
  const rectangleSelection = selected.every(
    (shape) =>
      shape.type === "geo" && (shape.props.geo === "rectangle" || shape.props.geo === "studio-rounded-rectangle")
  );
  const frameSelection = selected.every((shape) => shape.type === "frame");
  return {
    ...(selected.length === 1 ? { id: selected[0]!.id } : {}),
    type: types.length === 1 ? types[0]! : "Mixed selection",
    count: selected.length,
    x: commonNumber(selected.map((shape) => shape.x)) ?? null,
    y: commonNumber(selected.map((shape) => shape.y)) ?? null,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(rectangleSelection
      ? {
          supportsRadius: true,
          radius:
            commonNumber(
              selected.map((shape) => (typeof shape.meta?.studioRadius === "number" ? shape.meta.studioRadius : 0))
            ) ?? null
        }
      : {}),
    rotation: commonNumber(selected.map((shape) => shape.rotation)) ?? null,
    opacity: commonNumber(selected.map((shape) => shape.opacity)) ?? null,
    ...optionalText(
      "fill",
      commonText(selected.map((shape) => (typeof shape.props.fill === "string" ? shape.props.fill : undefined)))
    ),
    ...optionalText(
      "dash",
      commonText(selected.map((shape) => (typeof shape.props.dash === "string" ? shape.props.dash : undefined)))
    ),
    ...optionalText(
      "color",
      commonText(selected.map((shape) => (typeof shape.props.color === "string" ? shape.props.color : undefined)))
    ),
    ...optionalText(
      "frameColor",
      frameSelection
        ? commonText(selected.map((shape) => (typeof shape.props.color === "string" ? shape.props.color : undefined)))
        : undefined
    ),
    ...optionalText(
      "font",
      commonText(selected.map((shape) => (typeof shape.props.font === "string" ? shape.props.font : undefined)))
    ),
    ...optionalText(
      "fontSize",
      commonText(selected.map((shape) => (typeof shape.props.size === "string" ? shape.props.size : undefined)))
    ),
    ...optionalText("weight", commonText(selected.map((shape) => readTextWeight(shape.props.richText)))),
    ...optionalText(
      "textAlign",
      commonText(
        selected.map((shape) => (typeof shape.props.textAlign === "string" ? shape.props.textAlign : undefined))
      )
    )
  };
}

function optionalText(
  key: "fill" | "dash" | "color" | "frameColor" | "font" | "fontSize" | "weight" | "textAlign",
  value: string | null | undefined
): Partial<InspectedShape> {
  return value === undefined ? {} : { [key]: value };
}

function readTextWeight(richText: unknown): string | null | undefined {
  if (typeof richText !== "object" || richText === null) return undefined;
  const states: boolean[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const node = value as { type?: unknown; marks?: unknown; content?: unknown };
    if (node.type === "text") {
      states.push(
        Array.isArray(node.marks) &&
          node.marks.some((mark) => typeof mark === "object" && mark !== null && "type" in mark && mark.type === "bold")
      );
    }
    visit(node.content);
  };
  visit(richText);
  if (states.length === 0) return "regular";
  if (!states.every((bold) => bold === states[0])) return null;
  return states[0] ? "bold" : "regular";
}

function commonText(values: Array<string | null | undefined>): string | null | undefined {
  if (values.every((value) => value === undefined)) return undefined;
  const first = values[0];
  if (typeof first !== "string" || !values.every((value) => value === first)) return null;
  return first;
}

function commonNumber(values: Array<number | undefined>): number | null | undefined {
  if (values.length === 0 || values.every((value) => value === undefined)) return undefined;
  const first = values[0];
  if (typeof first !== "number" || !values.every((value) => value === first)) return null;
  return first;
}

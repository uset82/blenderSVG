/**
 * Canonical SVG Intermediate Representation (IR)
 *
 * Provides a clean, decoupled vector document model separating geometric
 * and styling semantics from domain-specific validation rules.
 */

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface ColorStop {
  offset: number; // 0 to 1
  color: string;
  opacity?: number;
}

export interface SolidPaint {
  type: "solid";
  color: string;
  opacity?: number;
}

export interface LinearGradientPaint {
  type: "linearGradient";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: ColorStop[];
}

export interface RadialGradientPaint {
  type: "radialGradient";
  id: string;
  cx: number;
  cy: number;
  r: number;
  stops: ColorStop[];
}

export type VectorPaint = SolidPaint | LinearGradientPaint | RadialGradientPaint;

export interface StrokeStyle {
  color?: string;
  width?: number;
  linecap?: "butt" | "round" | "square";
  linejoin?: "miter" | "round" | "bevel";
  dasharray?: number[];
  opacity?: number;
}

export interface VectorNodeBase {
  id: string;
  transform?: string;
  opacity?: number;
  metadata?: Record<string, string>;
}

export interface VectorPath extends VectorNodeBase {
  kind: "path";
  d: string;
  fill?: VectorPaint;
  stroke?: StrokeStyle;
}

export interface VectorGroup extends VectorNodeBase {
  kind: "group";
  children: VectorNode[];
}

export type VectorNode = VectorPath | VectorGroup;

export interface VectorDocument {
  viewBox: ViewBox;
  defs: Record<string, LinearGradientPaint | RadialGradientPaint>;
  root: VectorGroup;
  metadata?: Record<string, unknown>;
}

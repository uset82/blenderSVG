/** Display size that keeps the source aspect ratio and stays within a maximum side. */
export function fittedMediaSize(input: { width: number; height: number; maxSide?: number }): { w: number; h: number } {
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 1;
  const height = Number.isFinite(input.height) && input.height > 0 ? input.height : 1;
  const maxSide = input.maxSide ?? 800;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

export function svgViewBoxSize(svg: string): { width: number; height: number } | null {
  const match = /viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s*["']/.exec(svg);
  if (!match?.[1] || !match[2]) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

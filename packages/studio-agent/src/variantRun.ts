export interface VariantFrame {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VariantResult {
  index: number;
  modelId: string;
  ok: boolean;
  error?: string;
}

export function variantCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(4, Math.max(1, Math.floor(count)));
}

export function variantFrames(count: number, width = 800, height = 600, gap = 48): VariantFrame[] {
  const total = variantCount(count);
  return Array.from({ length: total }, (_, index) => ({
    index,
    x: index * (width + gap),
    y: 0,
    w: width,
    h: height
  }));
}

export function keepVariant(
  results: readonly VariantResult[],
  keepIndex: number
): { kept: number | null; discarded: number[] } {
  const kept = results.find((result) => result.index === keepIndex && result.ok);
  if (!kept) return { kept: null, discarded: results.map((result) => result.index) };
  return {
    kept: kept.index,
    discarded: results.filter((result) => result.index !== kept.index).map((result) => result.index)
  };
}

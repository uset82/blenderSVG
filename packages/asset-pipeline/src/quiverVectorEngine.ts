export interface QuiverGenerateSvgOptions {
  apiKey: string;
  prompt: string;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
}

/** @deprecated Remote SVG generation is disabled. */
export async function generateSvgWithQuiver(_options: QuiverGenerateSvgOptions): Promise<string> {
  throw new Error("Remote SVG generation is disabled. Use local image tracing.");
}

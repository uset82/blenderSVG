/** @deprecated SVG generation through ZenMux is disabled. Use local image tracing. */
export const DEFAULT_ZENMUX_FREE_MODELS = [] as const;

export interface ZenMuxGenerateSvgOptions {
  apiKey?: string | undefined;
  prompt: string;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
  temperature?: number | undefined;
}

export interface ZenMuxVisionSvgOptions {
  apiKey?: string | undefined;
  imageBase64: string;
  mimeType?: string | undefined;
  prompt?: string | undefined;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
}

/** @deprecated Remote SVG generation is disabled. */
export async function generateSvgWithZenMux(_options: ZenMuxGenerateSvgOptions): Promise<string> {
  throw new Error("Remote SVG generation is disabled. Use local image tracing.");
}

/** @deprecated Remote vision vectorization is disabled. */
export async function vectorizeImageWithZenMuxVision(_options: ZenMuxVisionSvgOptions): Promise<string> {
  throw new Error("Remote SVG generation is disabled. Use local image tracing.");
}

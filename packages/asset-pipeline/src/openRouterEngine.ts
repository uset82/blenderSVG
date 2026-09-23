/** @deprecated SVG generation through OpenRouter is disabled. Use local image tracing. */
export const DEFAULT_OPENROUTER_FREE_MODELS = [] as const;

export interface OpenRouterGenerateSvgOptions {
  apiKey?: string | undefined;
  prompt: string;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
  temperature?: number | undefined;
}

export interface OpenRouterVisionSvgOptions {
  apiKey?: string | undefined;
  imageBase64: string;
  mimeType?: string | undefined;
  prompt?: string | undefined;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
}

/** @deprecated Remote SVG generation is disabled. */
export async function generateSvgWithOpenRouter(_options: OpenRouterGenerateSvgOptions): Promise<string> {
  throw new Error("Remote SVG generation is disabled. Use local image tracing.");
}

/** @deprecated Remote vision vectorization is disabled. */
export async function vectorizeImageWithOpenRouterVision(_options: OpenRouterVisionSvgOptions): Promise<string> {
  throw new Error("Remote SVG generation is disabled. Use local image tracing.");
}

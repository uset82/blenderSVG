import { QuiverAI } from "@quiverai/sdk";

export interface QuiverGenerateSvgOptions {
  apiKey: string;
  prompt: string;
  model?: string | undefined;
  signal?: AbortSignal | undefined;
}

export async function generateSvgWithQuiver(options: QuiverGenerateSvgOptions): Promise<string> {
  if (!options.apiKey) {
    throw new Error("QuiverAI API key is required to use the QuiverAI vector engine.");
  }
  if (!options.prompt) {
    throw new Error("A text prompt is required to generate an SVG with QuiverAI.");
  }

  const client = new QuiverAI({
    bearerAuth: options.apiKey
  });

  const result = await client.createSVGs.generateSVG({
    generateSVGRequest: {
      model: options.model ?? "arrow-2",
      prompt: options.prompt
    }
  });

  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object" && "svg" in result && typeof (result as { svg: unknown }).svg === "string") {
    return (result as { svg: string }).svg;
  }

  return JSON.stringify(result);
}

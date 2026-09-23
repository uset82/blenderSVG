import { optimizeSvg } from "./optimizeSvg.js";

export const DEFAULT_ZENMUX_FREE_MODELS = [
  "z-ai/glm-4.6v-flash-free",
  "z-ai/glm-4.7-flash-free"
] as const;

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

/**
 * Generate semantic, clean SVG vector graphics using ZenMux AI routing.
 */
export async function generateSvgWithZenMux(options: ZenMuxGenerateSvgOptions): Promise<string> {
  const model = options.model ?? "z-ai/glm-4.6v-flash-free";
  const apiKey = options.apiKey || process.env["ZENMUX_API_KEY"] || "";

  const systemPrompt = `You are a world-class vector graphic artist and SVG engineer.
Output ONLY raw, valid SVG code within <svg>...</svg>.
Rules:
1. Include a responsive viewBox="0 0 W H". Do NOT include hardcoded fixed width or height attributes.
2. Use clean, semantic <path>, <rect>, <circle>, <g> elements with vibrant, harmonious hex colors.
3. Group distinct semantic layers (e.g. id="head", id="eyes", id="mouth", id="body") using <g id="...">.
4. Do NOT wrap output in markdown codeblocks (no \`\`\`xml or \`\`\`svg), output ONLY the raw <svg> string.`;

  const response = await fetch("https://zenmux.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate an SVG vector graphic for: ${options.prompt}` }
      ]
    }),
    ...(options.signal ? { signal: options.signal } : {})
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`ZenMux API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = data.choices?.[0]?.message?.content ?? "";
  const svg = extractSvg(rawContent);
  if (!svg) {
    throw new Error("ZenMux did not return valid SVG content.");
  }

  return optimizeSvg(svg);
}

/**
 * Vectorize a raster image using multimodal vision models on ZenMux (e.g., z-ai/glm-4.6v-flash-free).
 */
export async function vectorizeImageWithZenMuxVision(options: ZenMuxVisionSvgOptions): Promise<string> {
  const model = options.model ?? "z-ai/glm-4.6v-flash-free";
  const apiKey = options.apiKey || process.env["ZENMUX_API_KEY"] || "";
  const mime = options.mimeType ?? "image/png";

  const systemPrompt = `You are a master vector illustrator specializing in converting raster images into clean, layered SVG vector graphics.
Analyze the provided image and generate clean, mathematically smooth SVG code that faithfully reproduces the subject.
Rules:
1. Return ONLY the raw <svg>...</svg> element.
2. Use viewBox and avoid hardcoded pixel dimensions.
3. Organize into logical layers with <g id="..."> (e.g., background, outline, base, highlights, eyes, mouth).
4. Do NOT output markdown code blocks.`;

  const response = await fetch("https://zenmux.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: options.prompt ?? "Convert this image into a layered, production-quality SVG vector graphic."
            },
            {
              type: "image_url",
              image_url: {
                url: options.imageBase64.startsWith("data:")
                  ? options.imageBase64
                  : `data:${mime};base64,${options.imageBase64}`
              }
            }
          ]
        }
      ]
    }),
    ...(options.signal ? { signal: options.signal } : {})
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`ZenMux Vision API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = data.choices?.[0]?.message?.content ?? "";
  const svg = extractSvg(rawContent);
  if (!svg) {
    throw new Error("ZenMux Vision did not return valid SVG content.");
  }

  return optimizeSvg(svg);
}

function extractSvg(content: string): string {
  const match = content.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0].trim() : "";
}

import { prepareSvgPreview } from "./svgSafety.js";

export interface QuiverGenerateSvgOptions {
  apiKey: string;
  prompt: string;
  model?: string | undefined;
  referenceImages?: string[] | undefined;
  signal?: AbortSignal | undefined;
  fetcher?: typeof fetch | undefined;
}

export interface QuiverGenerateSvgResult {
  svg: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

const QUIVER_GENERATE_URL = "https://api.quiver.ai/v1/svgs/generations";
const MAX_PROMPT_LENGTH = 4_000;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 4_000_000;
const MAX_RESPONSE_BYTES = 1_000_000;

/** Generate one SVG through QuiverAI. Callers must obtain user consent before invoking this function. */
export async function generateSvgWithQuiver(options: QuiverGenerateSvgOptions): Promise<QuiverGenerateSvgResult> {
  const prompt = options.prompt.trim();
  const apiKey = options.apiKey.trim();
  const references = options.referenceImages ?? [];
  if (!apiKey) throw new Error("QuiverAI is not connected. Save your API key on this computer first.");
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Enter a prompt up to ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`);
  }
  if (references.length > MAX_REFERENCE_IMAGES) throw new Error("QuiverAI accepts up to four reference images.");
  if (references.some((reference) => !isBase64Image(reference))) {
    throw new Error("A reference image could not be read. Choose a PNG or JPEG image again.");
  }
  if (references.reduce((bytes, reference) => bytes + estimateBase64Bytes(reference), 0) > MAX_REFERENCE_BYTES) {
    throw new Error("Reference images exceed the 4 MB upload limit.");
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(QUIVER_GENERATE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: options.model?.trim() || "arrow-1.1",
        prompt,
        instructions:
          "Create one self-contained SVG. Return a clean, static graphic with no animation, scripts, stylesheets, external links, or embedded images.",
        n: 1,
        stream: false,
        ...(references.length > 0 ? { references: references.map((base64) => ({ base64 })) } : {})
      }),
      ...(options.signal ? { signal: options.signal } : {})
    });
  } catch (error) {
    if (options.signal?.aborted) throw new Error("QuiverAI generation was cancelled.");
    throw new Error("QuiverAI could not be reached. Check your connection and try again.");
  }

  if (!response.ok) throw new Error(quiverErrorMessage(response.status));
  const body: unknown = await readJsonBounded(response);
  const svg = extractSvg(body);
  if (!svg) throw new Error("QuiverAI returned no SVG. Try a different prompt.");

  let safeSvg: string;
  try {
    safeSvg = prepareSvgPreview(svg).svg;
  } catch {
    throw new Error("QuiverAI returned an SVG that failed local safety checks. It was not added to the canvas.");
  }

  const usage = readUsage(body);
  return { svg: safeSvg, ...(usage ? { usage } : {}) };
}

async function readJsonBounded(response: Response): Promise<unknown> {
  const declaredBytes = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
    throw new Error("QuiverAI returned a response larger than the 1 MB safety limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) return response.json().catch(() => null);
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("QuiverAI returned a response larger than the 1 MB safety limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

function isBase64Image(value: string): boolean {
  return value.length > 0 && value.length <= 5_400_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function estimateBase64Bytes(value: string): number {
  return Math.floor((value.length * 3) / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
}

function extractSvg(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  const candidate = data[0];
  if (!candidate || typeof candidate !== "object") return undefined;
  const svg = (candidate as { svg?: unknown }).svg;
  return typeof svg === "string" ? svg : undefined;
}

function readUsage(value: unknown): QuiverGenerateSvgResult["usage"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = (value as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const inputTokens = numberValue(record.inputTokens, record.input_tokens);
  const outputTokens = numberValue(record.outputTokens, record.output_tokens);
  const totalTokens = numberValue(record.totalTokens, record.total_tokens);
  const result = {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens })
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function numberValue(primary: unknown, alternate: unknown): number | undefined {
  if (typeof primary === "number" && Number.isFinite(primary)) return primary;
  return typeof alternate === "number" && Number.isFinite(alternate) ? alternate : undefined;
}

function quiverErrorMessage(status: number): string {
  if (status === 401 || status === 403)
    return "QuiverAI rejected the saved API key. Update it in this dialog and try again.";
  if (status === 402) return "QuiverAI reports that the account needs billing or credits before another generation.";
  if (status === 429) return "QuiverAI is rate limiting requests. Wait a moment and try again.";
  if (status >= 500) return "QuiverAI is temporarily unavailable. Your local tracing tools still work.";
  return "QuiverAI could not generate this SVG. Check the prompt and model, then try again.";
}

export interface QuiverHostStatus {
  available: boolean;
  configured: boolean;
  enabled: boolean;
  message: string;
}

export interface QuiverSvgResult {
  svg: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

const MAX_REFERENCE_BYTES = 4_000_000;

export async function getQuiverStatus(): Promise<QuiverHostStatus> {
  const response = await fetch("/api/quiver", { credentials: "same-origin", cache: "no-store" });
  const body = (await response.json().catch(() => null)) as Partial<QuiverHostStatus> | null;
  if (!response.ok || !body) {
    throw new Error(body?.message || "QuiverAI settings are available in standalone Studio only.");
  }
  return {
    available: body.available === true,
    configured: body.configured === true,
    enabled: body.enabled === true,
    message: typeof body.message === "string" ? body.message : "QuiverAI settings are unavailable."
  };
}

export async function updateQuiverSettings(
  action: "save" | "clear" | "enable" | "disable",
  key?: string
): Promise<QuiverHostStatus> {
  const response = await fetch("/api/quiver", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...(key === undefined ? {} : { key }) })
  });
  const body = (await response.json().catch(() => null)) as Partial<QuiverHostStatus> | { message?: string } | null;
  if (!response.ok || !body) {
    throw new Error(
      body && "message" in body && typeof body.message === "string"
        ? body.message
        : "Could not update QuiverAI settings."
    );
  }
  return {
    available: "available" in body && body.available === true,
    configured: "configured" in body && body.configured === true,
    enabled: "enabled" in body && body.enabled === true,
    message: "message" in body && typeof body.message === "string" ? body.message : "QuiverAI settings updated."
  };
}

export async function generateQuiverSvg(options: {
  model: string;
  prompt: string;
  referenceImage: File | null;
  signal: AbortSignal;
}): Promise<QuiverSvgResult> {
  const referenceImages: string[] = [];
  if (options.referenceImage) {
    if (options.referenceImage.size > MAX_REFERENCE_BYTES) {
      throw new Error("QuiverAI reference images are limited to 4 MB. Local tracing still supports images up to 8 MB.");
    }
    referenceImages.push(await fileAsBase64(options.referenceImage));
  }

  const response = await fetch("/api/quiver/generate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      referenceImages,
      consentConfirmed: true
    })
  });
  const body = (await response.json().catch(() => null)) as (QuiverSvgResult & { message?: string }) | null;
  if (!response.ok || !body || typeof body.svg !== "string") {
    throw new Error(body?.message || "QuiverAI could not generate this SVG.");
  }
  return { svg: body.svg, ...(body.usage ? { usage: body.usage } : {}) };
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The reference image could not be read."));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      if (!base64) reject(new Error("The reference image could not be read."));
      else resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

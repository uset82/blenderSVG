import { optimizeSvgForBrowser } from "@codex-avatar-studio/asset-pipeline/optimize-svg/browser";
import { fittedTraceSize, MAX_TRACE_PIXELS } from "@codex-avatar-studio/asset-pipeline/raster-prep";
import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import type { Editor, TLAssetId } from "tldraw";
import {
  assertSvgPathCount,
  type VectorPresetId,
  type VectorTraceSettings,
  workerRasterPrepOptions,
  workerVtracerOptions
} from "../components/vtracerPresets.js";
import { isWebEdition } from "../web/kurvaTarget.js";
import { fittedMediaSize, svgViewBoxSize } from "./fittedMediaSize.js";

const MAX_FILE_BYTES = 8_000_000;
const MAX_CHAT_IMAGE_BYTES = 1_500_000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function assertLocalAssetFile(file: File, kind: "image" | "svg-or-image"): void {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error("Choose an image or SVG up to 8 MB. Nothing was uploaded.");
  }
  const isSvg = isSvgFile(file);
  const isImage = IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  if (kind === "image" && !isImage) throw new Error("Choose a PNG, JPEG, WebP, or GIF. Nothing was uploaded.");
  if (kind === "svg-or-image" && !isSvg && !isImage) {
    throw new Error("Choose an SVG, PNG, JPEG, WebP, or GIF. Nothing was uploaded.");
  }
}

export async function traceImageFileLocally(
  file: File,
  preset: VectorPresetId = "color-illustration",
  signal?: AbortSignal,
  tuning?: VectorTraceSettings
): Promise<string> {
  const tracing = await import("./traceWorkerClient.js");
  if (signal?.aborted) throw new Error(tracing.TRACE_CANCELLED);
  assertLocalAssetFile(file, "image");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    if (bitmap.width * bitmap.height > MAX_TRACE_PIXELS) {
      throw new Error("This image is too large to trace locally. Use an image up to 4 megapixels.");
    }
    const size = fittedTraceSize(bitmap.width, bitmap.height);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot read the image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const pixels = context.getImageData(0, 0, size.width, size.height).data;
    const traced = await tracing.tracePixelsInWorker(
      pixels,
      size.width,
      size.height,
      workerVtracerOptions(preset, tuning),
      workerRasterPrepOptions(preset),
      signal
    );
    const withoutPrelude = traced
      .replace(/<\?xml[\s\S]*?\?>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();
    const withNamespace = withoutPrelude.includes("xmlns=")
      ? withoutPrelude
      : withoutPrelude.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    if (signal?.aborted) throw new Error(tracing.TRACE_CANCELLED);
    const svg = prepareSvgPreview(optimizeSvgForBrowser(withNamespace)).svg;
    assertSvgPathCount(svg);
    return svg;
  } finally {
    bitmap.close();
  }
}

/** Decode an image locally and normalize it to a bounded PNG for the extension-host VTracer WASM engine. */
export async function imageFileToTracePng(file: File): Promise<Uint8Array> {
  assertLocalAssetFile(file, "image");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 4_000_000) {
      throw new Error("This image is too large to trace locally. Use an image up to 4 megapixels.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot read the image.");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.size === 0 || blob.size > MAX_FILE_BYTES) {
      throw new Error("The decoded PNG is too large to send to local VTracer. Choose a smaller image.");
    }
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

export function assertChatImageAttachment(file: File): void {
  assertLocalAssetFile(file, "image");
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error(
      "Screenshots attached to chat must be 1.5 MB or smaller. The screenshot stays local until you confirm Send."
    );
  }
}

export async function readSanitizedSvgFile(file: File): Promise<string> {
  if (!isSvgFile(file)) throw new Error("Choose an SVG file. Nothing was uploaded.");
  assertLocalAssetFile(file, "svg-or-image");
  return prepareSvgPreview(await file.text()).svg;
}

function viewportCenter(editor: Editor): { x: number; y: number } {
  try {
    const center = editor.getViewportPageBounds().center;
    if (Number.isFinite(center.x) && Number.isFinite(center.y)) return center;
  } catch {
    // A hidden or freshly mounted canvas has no camera yet.
  }
  return { x: 0, y: 0 };
}

async function hostAssetSrc(file: File): Promise<string | null> {
  if (isWebEdition()) return null;
  try {
    if (window.sessionStorage.getItem("kurva-studio-standalone") !== "1") return null;
  } catch {
    return null;
  }
  const type = file.type.split(";")[0]?.trim().toLowerCase();
  if (type !== "image/png" && type !== "image/jpeg") return null;
  if (file.size <= 0 || file.size > 1_000_000) return null;
  const id = crypto.randomUUID();
  const response = await fetch(`/assets/${id}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": type },
    body: file
  });
  if (!response.ok) throw new Error("The asset was not stored.");
  return `/assets/${id}`;
}

export async function placeFileOnCanvas(editor: Editor, file: File): Promise<void> {
  const center = viewportCenter(editor);
  if (isSvgFile(file)) {
    const svg = await readSanitizedSvgFile(file);
    const viewBox = svgViewBoxSize(svg);
    const size = fittedMediaSize(viewBox ?? { width: 400, height: 400 });
    editor.createShape({
      type: "vector-studio",
      x: center.x - size.w / 2,
      y: center.y - size.h / 2,
      props: {
        w: size.w,
        h: size.h,
        engine: "local-svg",
        openRouterModel: "",
        detail: "balanced",
        lastSvg: svg,
        isProcessing: false
      }
    } as Parameters<Editor["createShape"]>[0]);
    return;
  }
  const bitmap = await createImageBitmap(file);
  const size = fittedMediaSize({ width: bitmap.width, height: bitmap.height });
  const assetId = `asset:${crypto.randomUUID()}` as TLAssetId;
  const hostedSrc = await hostAssetSrc(file);
  editor.createAssets([
    {
      id: assetId,
      type: "image",
      typeName: "asset",
      props: {
        src: hostedSrc ?? URL.createObjectURL(file),
        w: bitmap.width,
        h: bitmap.height,
        mimeType: file.type || "image/png",
        isAnimated: false,
        name: file.name
      },
      meta: {}
    }
  ]);
  editor.createShape({
    type: "image",
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    props: { assetId, w: size.w, h: size.h }
  });
  bitmap.close();
}

export function svgTextToFile(svg: string, name: string): File {
  const base = name.replace(/\.[^.]+$/, "") || "import";
  return new File([svg], `${base}.svg`, { type: "image/svg+xml" });
}

function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
}

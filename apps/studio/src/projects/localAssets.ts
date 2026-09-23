import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import type { Editor } from "tldraw";

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

export async function traceImageFileLocally(file: File): Promise<string> {
  assertLocalAssetFile(file, "image");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot read the image.");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    if (bitmap.width * bitmap.height > 4_000_000) {
      throw new Error("This image is too large to trace locally. Use an image up to 4 megapixels.");
    }
    const traced = await traceWithImageTracer(pixels, bitmap.width, bitmap.height);
    const withoutPrelude = traced
      .replace(/<\?xml[\s\S]*?\?>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();
    const withNamespace = withoutPrelude.includes("xmlns=")
      ? withoutPrelude
      : withoutPrelude.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    return prepareSvgPreview(withNamespace).svg;
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
    throw new Error("Screenshots attached to chat must be 1.5 MB or smaller. The screenshot stays local until you confirm Send.");
  }
}

export async function readSanitizedSvgFile(file: File): Promise<string> {
  if (!isSvgFile(file)) throw new Error("Choose an SVG file. Nothing was uploaded.");
  assertLocalAssetFile(file, "svg-or-image");
  return prepareSvgPreview(await file.text()).svg;
}

export async function placeFileOnCanvas(editor: Editor, file: File): Promise<void> {
  const center = editor.getViewportPageBounds().center;
  await editor.putExternalContent({ type: "files", files: [file], point: center });
}

export function svgTextToFile(svg: string, name: string): File {
  const base = name.replace(/\.[^.]+$/, "") || "import";
  return new File([svg], `${base}.svg`, { type: "image/svg+xml" });
}

async function traceWithImageTracer(pixels: Uint8ClampedArray, width: number, height: number): Promise<string> {
  const imageTracer = (await import("imagetracerjs")).default as {
    imagedataToSVG: (
      image: { width: number; height: number; data: Uint8ClampedArray },
      options: Record<string, unknown>
    ) => string;
  };
  const svg = imageTracer.imagedataToSVG({ width, height, data: pixels }, {
    colorsampling: 0,
    numberofcolors: 16,
    pathomit: 6,
    ltres: 1,
    qtres: 1,
    layering: 0,
    linefilter: false,
    roundcoords: 2,
    viewbox: true,
    strokewidth: 0
  });
  if (!svg) throw new Error("Local image tracing did not produce SVG.");
  return svg;
}

function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
}

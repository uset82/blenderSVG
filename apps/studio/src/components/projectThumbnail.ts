import type { Editor } from "tldraw";

const CACHE_KEY = "blendersvg-studio-project-thumbnails-v1";
const MAX_ENTRIES = 24;
const MAX_DATA_URL_CHARS = 220_000;

interface ThumbnailEntry {
  url: string;
  capturedAt: number;
}

type ThumbnailCache = Record<string, ThumbnailEntry>;

function readCache(): ThumbnailCache {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const valid: ThumbnailCache = {};
    for (const [id, entry] of Object.entries(value)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.url === "string" &&
        /^data:image\/(?:png|jpeg|webp);base64,/.test(candidate.url) &&
        candidate.url.length <= MAX_DATA_URL_CHARS &&
        typeof candidate.capturedAt === "number" &&
        Number.isFinite(candidate.capturedAt)
      ) {
        valid[id] = { url: candidate.url, capturedAt: candidate.capturedAt };
      }
    }
    return valid;
  } catch {
    return {};
  }
}

export function readProjectThumbnails(): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(readCache()).map(([id, entry]) => [id, entry.url]));
}

export function removeProjectThumbnail(projectId: string): void {
  try {
    const cache = readCache();
    delete cache[projectId];
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Thumbnails are optional local previews; project data is stored separately.
  }
}

/** Render the first frame to a PNG and store it on the authenticated host. */
export async function storeFrameThumbnail(editor: Editor, projectId: string): Promise<boolean> {
  const frame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
  if (!frame) return false;
  const image = await editor.toImage([frame.id], { format: "png", pixelRatio: 1, background: true, padding: 0 });
  const response = await fetch(`/api/projects/${projectId}/thumbnail`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "image/png" },
    body: image.blob
  });
  return response.ok;
}

/** Capture a small, genuine image of the active tldraw page after it is saved. */
export async function captureProjectThumbnail(editor: Editor, projectId: string): Promise<string | null> {
  const shapes = editor.getCurrentPageShapes();
  if (!shapes.length) return null;
  try {
    const frame = shapes.find((shape) => shape.type === "frame");
    const bounds = frame ? editor.getShapePageBounds(frame.id) : editor.getCurrentPageBounds();
    const longestSide = Math.max(bounds?.w ?? 1080, bounds?.h ?? 720, 1);
    const scale = Math.min(1, 420 / longestSide);
    const result = await editor.toImageDataUrl(shapes, {
      format: "jpeg",
      quality: 0.75,
      scale,
      pixelRatio: 1,
      background: true,
      padding: 0,
      darkMode: false
    });
    if (!/^data:image\/jpeg;base64,/.test(result.url) || result.url.length > MAX_DATA_URL_CHARS) return null;
    const cache = readCache();
    cache[projectId] = { url: result.url, capturedAt: Date.now() };
    const ordered = Object.entries(cache)
      .sort((left, right) => right[1].capturedAt - left[1].capturedAt)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(ordered)));
    return result.url;
  } catch {
    // Some imported/custom shapes may not support bitmap export. The project still saves.
    return null;
  }
}

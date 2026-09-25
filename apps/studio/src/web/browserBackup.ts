import {
  isImportDocument,
  type StudioProjectDocument,
  validateSnapshot
} from "@codex-avatar-studio/studio-host-core/projectEnvelope";
import { browserAssetSrc } from "./browserAssets.js";
import {
  listBrowserProjects,
  openBrowserProject,
  putBrowserAsset,
  readBrowserAsset,
  saveBrowserProject
} from "./browserProjects.js";
import { buildStoredZip, readStoredZip } from "./storedZip.js";

export async function downloadBrowserBackup(): Promise<void> {
  const blob = await exportBrowserBackup();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kurva-backup.zip";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportBrowserBackup(): Promise<Blob> {
  const listed = await listBrowserProjects();
  const files = [];
  for (const meta of listed.projects) {
    const project = await openBrowserProject(meta.id);
    const snapshot = await inlineAssetSources(project.snapshot);
    const document = { ...project, snapshot };
    files.push({
      name: `${project.id}.studio.json`,
      data: new TextEncoder().encode(JSON.stringify(document))
    });
  }
  const bytes = buildStoredZip(files);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
}

export async function importBrowserBackup(bytes: Uint8Array): Promise<{ imported: number; skipped: number }> {
  const entries = readStoredZip(bytes).filter((entry) => entry.name.endsWith(".studio.json"));
  let imported = 0;
  let skipped = 0;
  const existing = new Set((await listBrowserProjects()).projects.map((project) => project.id));
  for (const entry of entries) {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(entry.data));
    if (!isImportDocument(parsed)) throw new Error("A backup file is not a Studio project.");
    validateSnapshot(parsed.snapshot);
    const snapshot = await storeInlinedAssets(parsed.snapshot);
    if (existing.has(parsed.id)) {
      await saveBrowserProject(crypto.randomUUID(), `${parsed.title} copy`, snapshot);
      skipped += 1;
    } else {
      await saveBrowserProject(parsed.id, parsed.title, snapshot);
      existing.add(parsed.id);
      imported += 1;
    }
  }
  return { imported, skipped };
}

export async function inlineAssetSources(snapshot: string): Promise<string> {
  const ids = new Set(
    [...snapshot.matchAll(/kurva-asset:([0-9a-f-]{36})/gi)].map((match) => match[1]?.toLowerCase() ?? "")
  );
  let next = snapshot;
  for (const id of ids) {
    if (!id) continue;
    const asset = await readBrowserAsset(id);
    if (!asset) continue;
    const dataUrl = await blobToDataUrl(asset.blob);
    next = next.replaceAll(browserAssetSrc(id), dataUrl);
  }
  return next;
}

export async function storeInlinedAssets(snapshot: string): Promise<string> {
  const matches = [...snapshot.matchAll(/data:image\/(?:png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+/g)];
  let next = snapshot;
  for (const match of matches) {
    const dataUrl = match[0];
    const blob = dataUrlToBlob(dataUrl);
    const contentType = dataUrl.startsWith("data:image/svg")
      ? "image/svg+xml"
      : dataUrl.startsWith("data:image/jpeg")
        ? "image/jpeg"
        : "image/png";
    const id = crypto.randomUUID();
    await putBrowserAsset(id, contentType, blob);
    next = next.replaceAll(dataUrl, browserAssetSrc(id));
  }
  return next;
}

export function desktopProjectDocument(project: StudioProjectDocument): string {
  return JSON.stringify({
    createdAt: project.createdAt,
    formatVersion: project.formatVersion,
    id: project.id,
    snapshot: project.snapshot,
    title: project.title,
    updatedAt: project.updatedAt
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error("The backup image is not a supported data URL.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

import {
  conversationRecord,
  FORMAT_VERSION,
  isProjectDocument,
  MAX_CONVERSATIONS,
  MAX_PROJECT_BYTES,
  MAX_PROJECTS,
  normalizeTitle,
  SCRATCHPAD_PROJECT_ID,
  type StoredConversation,
  type StudioProjectDocument,
  type StudioProjectMeta,
  StudioProjectStoreError,
  toProjectMeta,
  utf8ByteLength,
  validateProjectId,
  validateRenameTitle,
  validateSnapshot
} from "@codex-avatar-studio/studio-host-core/projectEnvelope";
import {
  isQuotaError,
  openKurvaLibrary,
  requestResult,
  type StoredAssetRow,
  type StoredProjectRow,
  type StoredThumbnailRow,
  transactionDone
} from "./browserLibrary.js";

export const BLANK_CANVAS_SNAPSHOT = JSON.stringify({ document: { schema: {}, store: {} } });
export const BROWSER_ASSET_LIMIT_BYTES = 10_000_000;
export const BROWSER_LIBRARY_LIMIT_BYTES = 200_000_000;
const ASSET_ID = /kurva-asset:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export interface BrowserProjectList {
  projects: StudioProjectMeta[];
  corruptCount: number;
}

export function assetIdsInSnapshot(snapshot: string): string[] {
  return [...snapshot.matchAll(ASSET_ID)]
    .map((match) => match[1]?.toLowerCase())
    .filter((id): id is string => Boolean(id));
}

export async function listBrowserProjects(): Promise<BrowserProjectList> {
  const database = await openKurvaLibrary();
  const rows = await requestResult(
    database.transaction("projects").objectStore("projects").getAll() as IDBRequest<StoredProjectRow[]>
  );
  const projects: StudioProjectMeta[] = [];
  let corruptCount = 0;
  for (const row of rows) {
    if (isProjectDocument(row.document, row.id)) {
      try {
        validateSnapshot(row.document.snapshot);
        projects.push(toProjectMeta(row.document));
      } catch {
        corruptCount += 1;
      }
    } else corruptCount += 1;
  }
  projects.sort((left, right) => {
    if (left.id === SCRATCHPAD_PROJECT_ID) return -1;
    if (right.id === SCRATCHPAD_PROJECT_ID) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  return { projects: projects.slice(0, MAX_PROJECTS), corruptCount };
}

export async function openBrowserProject(id: string): Promise<StudioProjectDocument> {
  const safeId = validateProjectId(id);
  const row = await readProjectRow(safeId);
  if (!row || !isProjectDocument(row.document, safeId)) {
    throw new StudioProjectStoreError(
      "corrupt",
      "This project uses an unsupported or damaged format. It was left in place so it can be recovered."
    );
  }
  validateSnapshot(row.document.snapshot);
  return row.document;
}

export async function saveBrowserProject(id: string, title: string, snapshot: string): Promise<StudioProjectMeta> {
  const safeId = validateProjectId(id);
  const safeTitle = normalizeTitle(title);
  validateSnapshot(snapshot);
  const existing = await readProjectRow(safeId);
  if (existing && !isProjectDocument(existing.document, safeId)) {
    throw new StudioProjectStoreError(
      "corrupt",
      "This project file is unreadable. It was left in place so it can be recovered."
    );
  }
  const now = new Date().toISOString();
  const document: StudioProjectDocument = {
    id: safeId,
    title: safeTitle,
    createdAt: existing && isProjectDocument(existing.document, safeId) ? existing.document.createdAt : now,
    updatedAt: now,
    formatVersion: FORMAT_VERSION,
    snapshot
  };
  if (utf8ByteLength(JSON.stringify(document)) > MAX_PROJECT_BYTES) {
    throw new StudioProjectStoreError(
      "too-large",
      "This canvas is too large to save. Remove large embedded assets and try again."
    );
  }
  const database = await openKurvaLibrary();
  const transaction = database.transaction("projects", "readwrite");
  const store = transaction.objectStore("projects");
  try {
    await requestResult(store.put({ id: safeId, document } satisfies StoredProjectRow));
    await transactionDone(transaction);
  } catch (error) {
    if (isQuotaError(error)) {
      throw new StudioProjectStoreError("io", "This browser is out of space. Export a backup, then remove a project.");
    }
    if (error instanceof StudioProjectStoreError) throw error;
    throw new StudioProjectStoreError("io", "Save failed – Retry");
  }
  return toProjectMeta(document);
}

export async function renameBrowserProject(id: string, title: string): Promise<StudioProjectMeta> {
  const project = await openBrowserProject(id);
  const safeTitle = validateRenameTitle(title);
  if (project.title === safeTitle) return toProjectMeta(project);
  return saveBrowserProject(project.id, safeTitle, project.snapshot);
}

export async function duplicateBrowserProject(id: string): Promise<StudioProjectMeta> {
  const project = await openBrowserProject(id);
  return saveBrowserProject(crypto.randomUUID(), normalizeTitle(`${project.title} copy`), project.snapshot);
}

export async function deleteBrowserProject(id: string): Promise<void> {
  const safeId = validateProjectId(id);
  if (safeId === SCRATCHPAD_PROJECT_ID) {
    throw new StudioProjectStoreError("workspace", "Scratchpad is permanent and cannot be deleted.");
  }
  const project = await openBrowserProject(safeId).catch(() => null);
  const database = await openKurvaLibrary();
  const transaction = database.transaction(["projects", "thumbnails", "conversations"], "readwrite");
  await requestResult(transaction.objectStore("projects").delete(safeId));
  await requestResult(transaction.objectStore("thumbnails").delete(safeId));
  const conversations = transaction.objectStore("conversations");
  const owned = (await requestResult(conversations.index("projectId").getAll(safeId))) as StoredConversation[];
  for (const conversation of owned) await requestResult(conversations.delete(conversation.id));
  await transactionDone(transaction);
  if (project) await releaseUnreferencedAssets(assetIdsInSnapshot(project.snapshot));
}

export async function ensureBrowserScratchpad(snapshot = BLANK_CANVAS_SNAPSHOT): Promise<StudioProjectMeta> {
  validateSnapshot(snapshot);
  const database = await openKurvaLibrary();
  const transaction = database.transaction("projects", "readwrite");
  const store = transaction.objectStore("projects");
  const existing = (await requestResult(store.get(SCRATCHPAD_PROJECT_ID))) as StoredProjectRow | undefined;
  if (existing && isProjectDocument(existing.document, SCRATCHPAD_PROJECT_ID)) {
    await transactionDone(transaction);
    return toProjectMeta(existing.document);
  }
  const now = new Date().toISOString();
  const document: StudioProjectDocument = {
    id: SCRATCHPAD_PROJECT_ID,
    title: "Scratchpad",
    createdAt: now,
    updatedAt: now,
    formatVersion: FORMAT_VERSION,
    snapshot
  };
  await requestResult(store.put({ id: SCRATCHPAD_PROJECT_ID, document }));
  await transactionDone(transaction);
  return toProjectMeta(document);
}

export async function putBrowserAsset(
  id: string,
  contentType: StoredAssetRow["contentType"],
  blob: Blob
): Promise<void> {
  if (blob.size <= 0 || blob.size > BROWSER_ASSET_LIMIT_BYTES) {
    throw new Error("Choose a PNG, JPEG, or SVG up to 10 MB.");
  }
  const data = await blob.arrayBuffer();
  const database = await openKurvaLibrary();
  const assets = (await requestResult(
    database.transaction("assets").objectStore("assets").getAll()
  )) as StoredAssetRow[];
  const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (total + data.byteLength > BROWSER_LIBRARY_LIMIT_BYTES) {
    throw new Error("This browser is out of space for images. Export a backup, then remove a project.");
  }
  const transaction = database.transaction("assets", "readwrite");
  await requestResult(
    transaction.objectStore("assets").put({
      id,
      contentType,
      data,
      bytes: data.byteLength
    } satisfies StoredAssetRow)
  );
  await transactionDone(transaction);
}

export async function readBrowserAsset(id: string): Promise<(StoredAssetRow & { blob: Blob }) | null> {
  const database = await openKurvaLibrary();
  const row = (await requestResult(database.transaction("assets").objectStore("assets").get(id))) as
    | StoredAssetRow
    | undefined;
  if (!row) return null;
  return { ...row, blob: new Blob([new Uint8Array(row.data)], { type: row.contentType }) };
}

export async function putBrowserThumbnail(projectId: string, blob: Blob): Promise<void> {
  const data = await blob.arrayBuffer();
  const database = await openKurvaLibrary();
  const transaction = database.transaction("thumbnails", "readwrite");
  await requestResult(transaction.objectStore("thumbnails").put({ projectId, data } satisfies StoredThumbnailRow));
  await transactionDone(transaction);
}

export async function readBrowserThumbnail(projectId: string): Promise<Blob | null> {
  const database = await openKurvaLibrary();
  const row = (await requestResult(database.transaction("thumbnails").objectStore("thumbnails").get(projectId))) as
    | StoredThumbnailRow
    | undefined;
  return row ? new Blob([new Uint8Array(row.data)], { type: "image/png" }) : null;
}

export async function writeBrowserConversation(conversation: StoredConversation): Promise<void> {
  const valid = conversationRecord(conversation);
  if (!valid) throw new Error("The conversation could not be saved.");
  const database = await openKurvaLibrary();
  const transaction = database.transaction("conversations", "readwrite");
  const store = transaction.objectStore("conversations");
  await requestResult(store.put(valid));
  const records = (await requestResult(store.index("projectId").getAll(valid.projectId))) as StoredConversation[];
  const extras = records
    .filter((record) => conversationRecord(record))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(MAX_CONVERSATIONS);
  for (const extra of extras) await requestResult(store.delete(extra.id));
  await transactionDone(transaction);
}

export async function listBrowserConversations(projectId: string): Promise<StoredConversation[]> {
  const database = await openKurvaLibrary();
  const records = (await requestResult(
    database.transaction("conversations").objectStore("conversations").index("projectId").getAll(projectId)
  )) as unknown[];
  return records
    .map((record) => conversationRecord(record))
    .filter((record): record is StoredConversation => record !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
}

export async function readBrowserConversation(projectId: string, id: string): Promise<StoredConversation | null> {
  const database = await openKurvaLibrary();
  const record = conversationRecord(
    await requestResult(database.transaction("conversations").objectStore("conversations").get(id))
  );
  return record?.projectId === projectId ? record : null;
}

export async function renameBrowserConversation(projectId: string, id: string, title: string): Promise<void> {
  const current = await readBrowserConversation(projectId, id);
  if (!current) throw new Error("That conversation is not in this browser.");
  const next = conversationRecord({ ...current, title, updatedAt: new Date().toISOString() });
  if (!next) throw new Error("The conversation title is not valid.");
  await writeBrowserConversation(next);
}

export async function deleteBrowserConversation(projectId: string, id: string): Promise<void> {
  const current = await readBrowserConversation(projectId, id);
  if (!current) return;
  const database = await openKurvaLibrary();
  const transaction = database.transaction("conversations", "readwrite");
  await requestResult(transaction.objectStore("conversations").delete(id));
  await transactionDone(transaction);
}

export async function clearBrowserLibrary(): Promise<void> {
  const database = await openKurvaLibrary();
  const transaction = database.transaction(["projects", "assets", "thumbnails", "conversations", "meta"], "readwrite");
  for (const name of ["projects", "assets", "thumbnails", "conversations", "meta"] as const) {
    await requestResult(transaction.objectStore(name).clear());
  }
  await transactionDone(transaction);
}

async function readProjectRow(id: string): Promise<StoredProjectRow | null> {
  const database = await openKurvaLibrary();
  const row = (await requestResult(database.transaction("projects").objectStore("projects").get(id))) as
    | StoredProjectRow
    | undefined;
  return row ?? null;
}

async function releaseUnreferencedAssets(candidates: readonly string[]): Promise<void> {
  if (candidates.length === 0) return;
  const listed = await listBrowserProjects();
  const referenced = new Set<string>();
  for (const project of listed.projects) {
    const opened = await openBrowserProject(project.id).catch(() => null);
    if (!opened) continue;
    for (const assetId of assetIdsInSnapshot(opened.snapshot)) referenced.add(assetId);
  }
  const database = await openKurvaLibrary();
  const transaction = database.transaction("assets", "readwrite");
  for (const assetId of candidates) {
    if (!referenced.has(assetId)) await requestResult(transaction.objectStore("assets").delete(assetId));
  }
  await transactionDone(transaction);
}

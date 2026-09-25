export interface StudioProjectMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectDocument extends StudioProjectMeta {
  formatVersion: 1;
  snapshot: string;
}

export type StudioProjectStoreErrorCode = "workspace" | "missing" | "corrupt" | "too-large" | "invalid-title" | "io";

export class StudioProjectStoreError extends Error {
  public constructor(
    public readonly code: StudioProjectStoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = "StudioProjectStoreError";
  }
}

export const FORMAT_VERSION = 1 as const;
export const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_SNAPSHOT_CHARS = 20_000_000;
export const MAX_PROJECT_BYTES = 24_000_000;
export const MAX_PROJECTS = 2_000;
export const SCRATCHPAD_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
export const MAX_CONVERSATIONS = 50;

const CORRUPT_PROJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;
const SECRET_KEYS = new Set(["key", "apikey", "api_key", "authorization", "token", "secret"]);

export interface StoredConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StoredConversation {
  id: string;
  projectId: string;
  title: string;
  modelId: string;
  updatedAt: string;
  messages: StoredConversationMessage[];
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Host message for damaged project files. Names are basenames only, and the text stays inside the protocol limit. */
export function formatCorruptProjectMessage(count: number, names: readonly string[]): string {
  const summary = `${count} damaged project file${count === 1 ? " was" : "s were"} left in place for recovery.`;
  const safe = names.filter((name) => CORRUPT_PROJECT_NAME.test(name)).slice(0, 6);
  if (!safe.length) return summary;
  const extra = names.length > safe.length ? ` and ${names.length - safe.length} more` : "";
  const detailed = `${summary} ${safe.join(", ")}${extra}.`;
  return detailed.length <= 500 ? detailed : summary;
}

export function validateProjectId(id: string): string {
  if (!PROJECT_ID.test(id)) throw new StudioProjectStoreError("corrupt", "The Studio project identifier is invalid.");
  return id.toLowerCase();
}

export function normalizeTitle(title: string): string {
  const normalized = title
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 120);
  return normalized || "Untitled";
}

export function validateRenameTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 120 || /\p{Cc}/u.test(trimmed)) {
    throw new StudioProjectStoreError(
      "invalid-title",
      "Use a project title of 1–120 characters without control characters."
    );
  }
  return trimmed;
}

export function validateSnapshot(snapshot: string): void {
  if (utf8ByteLength(snapshot) > MAX_SNAPSHOT_CHARS) {
    throw new StudioProjectStoreError(
      "too-large",
      "This canvas is too large to save. Remove large embedded assets and try again."
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(snapshot) as unknown;
  } catch {
    throw new StudioProjectStoreError(
      "corrupt",
      "Studio could not read the canvas data. The project was left unchanged."
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StudioProjectStoreError(
      "corrupt",
      "Studio could not read the canvas data. The project was left unchanged."
    );
  }
  const document = (value as { document?: unknown }).document;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new StudioProjectStoreError("corrupt", "The canvas snapshot is missing its document data.");
  }
  const data = document as { schema?: unknown; store?: unknown };
  if (
    !data.schema ||
    typeof data.schema !== "object" ||
    !data.store ||
    typeof data.store !== "object" ||
    Array.isArray(data.store)
  ) {
    throw new StudioProjectStoreError("corrupt", "The canvas snapshot is missing its versioned tldraw schema.");
  }
}

export function isProjectDocument(value: unknown, expectedId: string): value is StudioProjectDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<StudioProjectDocument>;
  return (
    document.formatVersion === FORMAT_VERSION &&
    document.id === expectedId &&
    typeof document.title === "string" &&
    document.title.trim().length > 0 &&
    document.title.length <= 120 &&
    typeof document.createdAt === "string" &&
    Number.isFinite(Date.parse(document.createdAt)) &&
    typeof document.updatedAt === "string" &&
    Number.isFinite(Date.parse(document.updatedAt)) &&
    typeof document.snapshot === "string"
  );
}

export function isImportDocument(value: unknown): value is StudioProjectDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "createdAt,formatVersion,id,snapshot,title,updatedAt") return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && PROJECT_ID.test(id) && isProjectDocument(value, id);
}

export function toProjectMeta(project: StudioProjectDocument): StudioProjectMeta {
  return { id: project.id, title: project.title, createdAt: project.createdAt, updatedAt: project.updatedAt };
}

/** Rejects records that carry a secret-like field name. Returns null instead of storing them. */
export function conversationRecord(value: unknown): StoredConversation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => SECRET_KEYS.has(key.toLowerCase()))) return null;
  if (typeof record.id !== "string" || !PROJECT_ID.test(record.id)) return null;
  if (typeof record.projectId !== "string" || !PROJECT_ID.test(record.projectId)) return null;
  if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 120) return null;
  if (typeof record.modelId !== "string" || record.modelId.length > 200) return null;
  if (typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) return null;
  if (!Array.isArray(record.messages) || record.messages.length > 200) return null;
  const messages: StoredConversationMessage[] = [];
  for (const message of record.messages) {
    if (!message || typeof message !== "object") return null;
    const item = message as Record<string, unknown>;
    if (
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      item.content.length > 12_000
    ) {
      return null;
    }
    if (Object.keys(item).some((key) => SECRET_KEYS.has(key.toLowerCase()))) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title.trim(),
    modelId: record.modelId,
    updatedAt: record.updatedAt,
    messages
  };
}

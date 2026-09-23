const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROJECT_BYTES = 24_000_000;
const REQUIRED_KEYS = ["createdAt", "formatVersion", "id", "snapshot", "title", "updatedAt"];

export interface ImportedStudioProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  formatVersion: 1;
  snapshot: string;
}

export function parseImportedStudioProject(text: string): ImportedStudioProject {
  if (textByteLength(text) > MAX_PROJECT_BYTES) {
    throw new Error("The selected Studio project exceeds the supported file size.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The selected file is not valid Studio project JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The selected file is not a supported Studio project.");
  }
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== REQUIRED_KEYS.join(",")) {
    throw new Error("The selected file is not a supported Studio project.");
  }
  const document = value as Record<string, unknown>;
  if (document.formatVersion !== 1 || typeof document.id !== "string" || !PROJECT_ID.test(document.id)) {
    throw new Error("The selected file is not a supported Studio project.");
  }
  if (typeof document.title !== "string" || document.title.trim().length === 0 || document.title.length > 120) {
    throw new Error("The selected file is not a supported Studio project.");
  }
  if (!isIsoDate(document.createdAt) || !isIsoDate(document.updatedAt)) {
    throw new Error("The selected file is not a supported Studio project.");
  }
  if (typeof document.snapshot !== "string" || textByteLength(document.snapshot) > 20_000_000) {
    throw new Error("The canvas snapshot is too large or missing.");
  }
  assertSnapshot(document.snapshot);
  return {
    id: document.id,
    title: document.title.trim(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    formatVersion: 1,
    snapshot: document.snapshot
  };
}

function assertSnapshot(snapshot: string): void {
  let value: unknown;
  try {
    value = JSON.parse(snapshot) as unknown;
  } catch {
    throw new Error("Studio could not read the canvas data. The project was left unchanged.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Studio could not read the canvas data. The project was left unchanged.");
  }
  const document = (value as { document?: unknown }).document;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The canvas snapshot is missing its document data.");
  }
  const data = document as { schema?: unknown; store?: unknown };
  if (
    !data.schema ||
    typeof data.schema !== "object" ||
    !data.store ||
    typeof data.store !== "object" ||
    Array.isArray(data.store)
  ) {
    throw new Error("The canvas snapshot is missing its versioned tldraw schema.");
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function textByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

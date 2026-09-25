import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

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

const FORMAT_VERSION = 1 as const;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SNAPSHOT_CHARS = 20_000_000;
const MAX_PROJECT_BYTES = 24_000_000;
const MAX_PROJECTS = 2_000;
export const SCRATCHPAD_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

/** Local, workspace-trusted project storage with a versioned envelope and atomic replacement. */
const CORRUPT_PROJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i;

/** Host message for damaged project files. Names are basenames only, and the text stays inside the protocol limit. */
export function formatCorruptProjectMessage(count: number, names: readonly string[]): string {
  const summary = `${count} damaged project file${count === 1 ? " was" : "s were"} left in place for recovery.`;
  const safe = names.filter((name) => CORRUPT_PROJECT_NAME.test(name)).slice(0, 6);
  if (!safe.length) return summary;
  const extra = names.length > safe.length ? ` and ${names.length - safe.length} more` : "";
  const detailed = `${summary} ${safe.join(", ")}${extra}.`;
  return detailed.length <= 500 ? detailed : summary;
}

export class StudioProjectStore {
  public constructor(
    private readonly workspaceRoot: () => string | undefined,
    private readonly storageMode: "workspace" | "library" = "workspace"
  ) {}

  public async list(): Promise<{ projects: StudioProjectMeta[]; corruptCount: number; corruptNames: string[] }> {
    const directory = await this.getDirectory(true);
    const entries = await readdir(directory, { withFileTypes: true });
    const projects: StudioProjectMeta[] = [];
    const corruptNames: string[] = [];

    for (const entry of entries) {
      const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i.exec(entry.name);
      if (!match) continue;
      const id = match[1];
      if (!id) continue;
      if (!entry.isFile()) {
        corruptNames.push(entry.name);
        continue;
      }
      try {
        const project = await this.read(id);
        projects.push(toMeta(project));
      } catch {
        corruptNames.push(entry.name);
      }
    }

    projects.sort((left, right) => {
      if (left.id === SCRATCHPAD_PROJECT_ID) return -1;
      if (right.id === SCRATCHPAD_PROJECT_ID) return 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    const reportedNames = corruptNames.slice(0, MAX_PROJECTS);
    return {
      projects: projects.slice(0, MAX_PROJECTS),
      corruptCount: reportedNames.length,
      corruptNames: reportedNames
    };
  }

  public async open(id: string): Promise<StudioProjectDocument> {
    const safeId = validateId(id);
    return this.read(safeId);
  }

  public async save(id: string, title: string, snapshot: string): Promise<StudioProjectMeta> {
    const safeId = validateId(id);
    const safeTitle = normalizeTitle(title);
    validateSnapshot(snapshot);
    const directory = await this.getDirectory(true);
    const target = await this.getSafeProjectPath(directory, safeId, true);
    let createdAt = new Date().toISOString();

    if (target.exists) {
      // Do not overwrite an unreadable project: preserve it for recovery instead.
      createdAt = (await this.read(safeId)).createdAt;
    }

    const now = new Date().toISOString();
    const document: StudioProjectDocument = {
      id: safeId,
      title: safeTitle,
      createdAt,
      updatedAt: now,
      formatVersion: FORMAT_VERSION,
      snapshot
    };
    const serialized = JSON.stringify(document);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError(
        "too-large",
        "This canvas is too large to save. Remove large embedded assets and try again."
      );
    }

    const temporaryPath = path.join(directory, `.${safeId}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporaryPath, target.path);
    } catch {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new StudioProjectStoreError(
        "io",
        "Studio could not save this project. Check workspace permissions and available disk space."
      );
    }
    return toMeta(document);
  }

  /** Rename only a verified existing project while preserving its canvas and creation date. */
  public async rename(id: string, title: string): Promise<StudioProjectMeta> {
    const safeId = validateId(id);
    const safeTitle = validateRenameTitle(title);
    const original = await this.read(safeId);
    if (original.title === safeTitle) return toMeta(original);

    const directory = await this.getDirectory(false);
    const updated: StudioProjectDocument = {
      id: original.id,
      title: safeTitle,
      createdAt: original.createdAt,
      updatedAt: new Date().toISOString(),
      formatVersion: FORMAT_VERSION,
      snapshot: original.snapshot
    };
    const serialized = JSON.stringify(updated);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError("too-large", "This Studio project exceeds the supported local file size.");
    }

    const temporaryPath = path.join(directory, `.${safeId}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      const target = await this.getSafeProjectPath(directory, safeId, false);
      await rename(temporaryPath, target.path);
      return toMeta(updated);
    } catch (error) {
      if (error instanceof StudioProjectStoreError) throw error;
      throw new StudioProjectStoreError("io", "Studio could not rename this project. Check workspace permissions.");
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  /** Resolve only a readable stored project for the host's native reveal action. */
  public async revealPath(id: string): Promise<string> {
    const safeId = validateId(id);
    await this.read(safeId);
    const directory = await this.getDirectory(false);
    return (await this.getSafeProjectPath(directory, safeId, false)).path;
  }

  /** Create the permanent draft only when absent; an existing file is never replaced. */
  public async ensureScratchpad(snapshot: string): Promise<StudioProjectMeta> {
    validateSnapshot(snapshot);
    const directory = await this.getDirectory(true);
    const target = await this.getSafeProjectPath(directory, SCRATCHPAD_PROJECT_ID, true);
    if (target.exists) return toMeta(await this.read(SCRATCHPAD_PROJECT_ID));

    const now = new Date().toISOString();
    const document: StudioProjectDocument = {
      id: SCRATCHPAD_PROJECT_ID,
      title: "Scratchpad",
      createdAt: now,
      updatedAt: now,
      formatVersion: FORMAT_VERSION,
      snapshot
    };
    const serialized = JSON.stringify(document);
    if (Buffer.byteLength(serialized, "utf8") > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError("too-large", "The Scratchpad canvas exceeds the supported local file size.");
    }

    const temporaryPath = path.join(directory, `.${SCRATCHPAD_PROJECT_ID}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
      try {
        // Exclusive link makes concurrent provisioning safe without replacing an existing draft.
        await link(temporaryPath, target.path);
      } catch (error) {
        if (isAlreadyExists(error)) return toMeta(await this.read(SCRATCHPAD_PROJECT_ID));
        throw error;
      }
      return toMeta(document);
    } catch (error) {
      if (error instanceof StudioProjectStoreError) throw error;
      throw new StudioProjectStoreError("io", "Studio could not create the local Scratchpad project.");
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  public async duplicate(id: string): Promise<StudioProjectMeta> {
    const original = await this.read(validateId(id));
    const title = normalizeTitle(`${original.title} copy`);
    return this.save(randomUUID(), title, original.snapshot);
  }

  /** Import an explicitly selected local project file as a new workspace project. */
  public async importFromFile(sourcePath: string): Promise<StudioProjectDocument> {
    if (!path.isAbsolute(sourcePath) || path.extname(sourcePath).toLowerCase() !== ".json") {
      throw new StudioProjectStoreError("corrupt", "Choose a local Studio project JSON file.");
    }

    let sourceInfo: Awaited<ReturnType<typeof lstat>>;
    try {
      sourceInfo = await lstat(sourcePath);
    } catch {
      throw new StudioProjectStoreError("io", "Studio could not read the selected project file.");
    }
    if (sourceInfo.isSymbolicLink() || !sourceInfo.isFile()) {
      throw new StudioProjectStoreError("corrupt", "The selected project must be a regular local JSON file.");
    }
    if (sourceInfo.size > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError("too-large", "The selected Studio project exceeds the supported file size.");
    }

    let sourceText: string;
    try {
      sourceText = await readFile(sourcePath, "utf8");
    } catch {
      throw new StudioProjectStoreError("io", "Studio could not read the selected project file.");
    }
    if (Buffer.byteLength(sourceText, "utf8") > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError("too-large", "The selected Studio project exceeds the supported file size.");
    }

    let source: unknown;
    try {
      source = JSON.parse(sourceText) as unknown;
    } catch {
      throw new StudioProjectStoreError("corrupt", "The selected file is not valid Studio project JSON.");
    }
    if (!isImportDocument(source)) {
      throw new StudioProjectStoreError("corrupt", "The selected file is not a supported Studio project.");
    }
    validateSnapshot(source.snapshot);

    const directory = await this.getDirectory(true);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = randomUUID();
      const now = new Date().toISOString();
      const document: StudioProjectDocument = {
        id,
        title: normalizeTitle(source.title),
        createdAt: now,
        updatedAt: now,
        formatVersion: FORMAT_VERSION,
        snapshot: source.snapshot
      };
      const serialized = JSON.stringify(document);
      if (Buffer.byteLength(serialized, "utf8") > MAX_PROJECT_BYTES) {
        throw new StudioProjectStoreError("too-large", "The selected Studio project exceeds the supported file size.");
      }

      const temporaryPath = path.join(directory, `.${id}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
        // A hard link creates the destination atomically and fails if it already exists.
        await link(temporaryPath, path.join(directory, `${id}.json`));
        return document;
      } catch (error) {
        if (isAlreadyExists(error)) continue;
        throw new StudioProjectStoreError("io", "Studio could not import this project into the workspace.");
      } finally {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
      }
    }
    throw new StudioProjectStoreError("io", "Studio could not create a unique project for this import.");
  }

  public async delete(id: string): Promise<void> {
    const safeId = validateId(id);
    if (safeId === SCRATCHPAD_PROJECT_ID) {
      throw new StudioProjectStoreError("workspace", "Scratchpad is permanent and cannot be deleted.");
    }
    const directory = await this.getDirectory(false);
    const file = await this.getSafeProjectPath(directory, safeId, false);
    await rm(file.path, { force: false });
  }

  private async read(id: string): Promise<StudioProjectDocument> {
    const directory = await this.getDirectory(false);
    const file = await this.getSafeProjectPath(directory, id, false);
    const fileStats = await stat(file.path).catch(() => {
      throw new StudioProjectStoreError("missing", "That Studio project no longer exists.");
    });
    if (fileStats.size > MAX_PROJECT_BYTES) {
      throw new StudioProjectStoreError("too-large", "This Studio project exceeds the supported local file size.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(file.path, "utf8")) as unknown;
    } catch {
      throw new StudioProjectStoreError(
        "corrupt",
        "This project file is unreadable. It was left in place so it can be recovered."
      );
    }
    if (!isProjectDocument(parsed, id)) {
      throw new StudioProjectStoreError(
        "corrupt",
        "This project uses an unsupported or damaged format. It was left in place so it can be recovered."
      );
    }
    validateSnapshot(parsed.snapshot);
    return parsed;
  }

  private async getDirectory(create: boolean): Promise<string> {
    const configuredRoot = this.workspaceRoot();
    if (!configuredRoot) {
      if (this.storageMode === "library")
        throw new StudioProjectStoreError("workspace", "The Studio library is not available.");
      throw new StudioProjectStoreError("workspace", "Open a trusted local workspace to save Studio projects.");
    }

    let storageRoot: string;
    try {
      storageRoot = await realpath(configuredRoot);
    } catch {
      const message =
        this.storageMode === "library"
          ? "The Studio library folder is not available on this device."
          : "The current workspace folder is not available on this device.";
      throw new StudioProjectStoreError("workspace", message);
    }

    const segments = this.storageMode === "library" ? ["projects"] : [".codex-avatar", "studio", "projects"];
    const directory = path.resolve(storageRoot, ...segments);
    const relative = path.relative(storageRoot, directory);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new StudioProjectStoreError(
        "workspace",
        this.storageMode === "library"
          ? "Studio project storage must remain inside the Studio library."
          : "Studio project storage must remain inside the current workspace."
      );
    }

    let current = storageRoot;
    for (const segment of segments) {
      current = path.join(current, segment);
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink() || !info.isDirectory()) {
          throw new StudioProjectStoreError(
            "workspace",
            "Studio project storage cannot use a symbolic link or non-folder path."
          );
        }
      } catch (error) {
        if (error instanceof StudioProjectStoreError) throw error;
        if (!isNotFound(error) || !create) {
          if (isNotFound(error))
            throw new StudioProjectStoreError("workspace", "Studio project storage is unavailable.");
          throw new StudioProjectStoreError("io", "Studio could not access the project folder.");
        }
        await mkdir(current).catch((createError: unknown) => {
          if (!isAlreadyExists(createError)) {
            throw new StudioProjectStoreError("io", "Studio could not create its local project folder.");
          }
        });
        const created = await lstat(current).catch(() => {
          throw new StudioProjectStoreError("io", "Studio could not access its local project folder.");
        });
        if (created.isSymbolicLink() || !created.isDirectory()) {
          throw new StudioProjectStoreError(
            "workspace",
            "Studio project storage cannot use a symbolic link or non-folder path."
          );
        }
      }
      const canonical = await realpath(current).catch(() => {
        throw new StudioProjectStoreError("io", "Studio could not resolve its local project folder.");
      });
      if (!isPathWithin(storageRoot, canonical)) {
        throw new StudioProjectStoreError(
          "workspace",
          this.storageMode === "library"
            ? "Studio project storage must remain inside the Studio library."
            : "Studio project storage must remain inside the current workspace."
        );
      }
      current = canonical;
    }
    return current;
  }

  private async getSafeProjectPath(
    directory: string,
    id: string,
    allowMissing: boolean
  ): Promise<{ path: string; exists: boolean }> {
    const target = path.join(directory, `${id}.json`);
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile()) {
        throw new StudioProjectStoreError("corrupt", "The project path is not a regular local file.");
      }
      const canonical = await realpath(target);
      if (!isPathWithin(directory, canonical)) {
        throw new StudioProjectStoreError(
          "workspace",
          "Studio refused a project file outside its local project folder."
        );
      }
      return { path: canonical, exists: true };
    } catch (error) {
      if (error instanceof StudioProjectStoreError) throw error;
      if (isNotFound(error) && allowMissing) return { path: target, exists: false };
      if (isNotFound(error)) throw new StudioProjectStoreError("missing", "That Studio project no longer exists.");
      throw new StudioProjectStoreError("io", "Studio could not access this project file.");
    }
  }
}

function validateId(id: string): string {
  if (!PROJECT_ID.test(id)) throw new StudioProjectStoreError("corrupt", "The Studio project identifier is invalid.");
  return id.toLowerCase();
}

function normalizeTitle(title: string): string {
  const normalized = title
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 120);
  return normalized || "Untitled";
}

function validateRenameTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 120 || /\p{Cc}/u.test(trimmed)) {
    throw new StudioProjectStoreError(
      "invalid-title",
      "Use a project title of 1–120 characters without control characters."
    );
  }
  return trimmed;
}

function validateSnapshot(snapshot: string): void {
  if (Buffer.byteLength(snapshot, "utf8") > MAX_SNAPSHOT_CHARS) {
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
  // Every canvas record carries its own id and type, as tldraw writes them. Hand-written
  // snapshots from other tools often skip these and then cannot be opened in the Studio.
  for (const [key, record] of Object.entries(data.store as Record<string, unknown>)) {
    const candidate = record as { id?: unknown; typeName?: unknown } | null;
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      candidate.id !== key ||
      typeof candidate.typeName !== "string"
    ) {
      throw new StudioProjectStoreError(
        "corrupt",
        "The canvas snapshot has a record without a matching id and type, so the Studio could not open it. The project was left unchanged."
      );
    }
  }
}

function isProjectDocument(value: unknown, expectedId: string): value is StudioProjectDocument {
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

function isImportDocument(value: unknown): value is StudioProjectDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "createdAt,formatVersion,id,snapshot,title,updatedAt") return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && PROJECT_ID.test(id) && isProjectDocument(value, id);
}

function toMeta(project: StudioProjectDocument): StudioProjectMeta {
  return { id: project.id, title: project.title, createdAt: project.createdAt, updatedAt: project.updatedAt };
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}

function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

import type { Editor, JsonObject, TLParentId, TLShapeId } from "tldraw";

/**
 * Per-reply version history for design frames. After each agent reply that changes the canvas, Kurva
 * records the design frames of the page (name, place, size and HTML). "Restore" puts the page's design
 * frames back to that version as one undoable change. Versions live in the page's meta, so they are
 * saved and exported with the project; identical HTML is stored once.
 */

export interface DesignFrameSnapshot {
  id: string;
  parentId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  html: string;
}

interface StoredFrame extends Omit<DesignFrameSnapshot, "html"> {
  /** Key into DesignVersionStore.html. */
  hash: string;
}

export interface DesignVersion {
  id: string;
  /** What the user asked for in that reply, or a note such as "Before the agent". */
  label: string;
  createdAt: string;
  frames: StoredFrame[];
}

export interface DesignVersionStore {
  versions: DesignVersion[];
  html: Record<string, string>;
}

export interface DesignVersionSummary {
  id: string;
  number: number;
  label: string;
  createdAt: string;
  frameCount: number;
  current: boolean;
}

export const DESIGN_VERSIONS_META_KEY = "kurvaDesignVersions";
export const MAX_DESIGN_VERSIONS = 30;
/** Total HTML kept across all versions; the oldest versions go first. */
export const MAX_DESIGN_VERSION_CHARS = 2_000_000;

const EMPTY_STORE: DesignVersionStore = { versions: [], html: {} };

/** FNV-1a over the HTML plus its length: a short, stable key for deduplicating identical documents. */
export function hashHtml(html: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < html.length; index += 1) {
    hash ^= html.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}-${html.length.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredFrame(value: unknown): value is StoredFrame {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.parentId === "string" &&
    typeof value.name === "string" &&
    typeof value.hash === "string" &&
    ["x", "y", "w", "h"].every((key) => typeof value[key] === "number" && Number.isFinite(value[key]))
  );
}

/** Reads the store from page meta, dropping anything malformed (meta can come from imported files). */
export function readDesignVersionStore(meta: unknown): DesignVersionStore {
  const raw = isRecord(meta) ? meta[DESIGN_VERSIONS_META_KEY] : undefined;
  if (!isRecord(raw) || !Array.isArray(raw.versions) || !isRecord(raw.html)) return EMPTY_STORE;
  const html: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.html)) if (typeof value === "string") html[key] = value;
  const versions = raw.versions.filter(
    (version): version is DesignVersion =>
      isRecord(version) &&
      typeof version.id === "string" &&
      typeof version.label === "string" &&
      typeof version.createdAt === "string" &&
      Array.isArray(version.frames) &&
      version.frames.every((frame) => isStoredFrame(frame) && frame.hash in html)
  );
  return { versions, html };
}

function signature(frames: ReadonlyArray<Omit<StoredFrame, "parentId">>): string {
  return JSON.stringify(
    [...frames]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((frame) => [frame.id, frame.name, Math.round(frame.x), Math.round(frame.y), frame.w, frame.h, frame.hash])
  );
}

function toStored(frames: readonly DesignFrameSnapshot[]): { stored: StoredFrame[]; html: Record<string, string> } {
  const html: Record<string, string> = {};
  const stored = frames.map(({ html: document, ...frame }) => {
    const hash = hashHtml(document);
    html[hash] = document;
    return { ...frame, hash };
  });
  return { stored, html };
}

/** Drops the oldest versions past the count or size limits, then the HTML no version uses. */
function prune(store: DesignVersionStore): DesignVersionStore {
  let versions = store.versions.slice(-MAX_DESIGN_VERSIONS);
  const used = () => new Set(versions.flatMap((version) => version.frames.map((frame) => frame.hash)));
  const size = (hashes: Set<string>) => [...hashes].reduce((sum, hash) => sum + (store.html[hash]?.length ?? 0), 0);
  let hashes = used();
  while (versions.length > 1 && size(hashes) > MAX_DESIGN_VERSION_CHARS) {
    versions = versions.slice(1);
    hashes = used();
  }
  const html: Record<string, string> = {};
  for (const hash of hashes) {
    const document = store.html[hash];
    if (document !== undefined) html[hash] = document;
  }
  return { versions, html };
}

/**
 * Adds a version for these frames. Returns the store unchanged when there is nothing to record: no
 * design frames, or the same frames as the latest version.
 */
export function addDesignVersion(
  store: DesignVersionStore,
  frames: readonly DesignFrameSnapshot[],
  label: string,
  now: Date,
  id: string
): DesignVersionStore {
  if (frames.length === 0) return store;
  const { stored, html } = toStored(frames);
  const latest = store.versions.at(-1);
  if (latest && signature(latest.frames) === signature(stored)) return store;
  const clean = label.replace(/\s+/g, " ").trim();
  const version: DesignVersion = {
    id,
    label: (clean.length > 80 ? `${clean.slice(0, 79)}…` : clean) || "Agent reply",
    createdAt: now.toISOString(),
    frames: stored
  };
  return prune({ versions: [...store.versions, version], html: { ...store.html, ...html } });
}

/** Newest first, numbered from the oldest kept version, with the one matching the canvas marked. */
export function summarizeDesignVersions(
  store: DesignVersionStore,
  currentFrames: readonly DesignFrameSnapshot[]
): DesignVersionSummary[] {
  const current = signature(toStored(currentFrames).stored);
  return store.versions
    .map((version, index) => ({
      id: version.id,
      number: index + 1,
      label: version.label,
      createdAt: version.createdAt,
      frameCount: version.frames.length,
      current: currentFrames.length > 0 && signature(version.frames) === current
    }))
    .reverse();
}

export interface DesignRestorePlan {
  /** Frames to put back (update in place, or re-create with the same id). */
  frames: DesignFrameSnapshot[];
  /** Design frames on the page that the version does not have. */
  remove: string[];
}

export function planDesignRestore(
  store: DesignVersionStore,
  versionId: string,
  currentFrames: readonly DesignFrameSnapshot[]
): DesignRestorePlan | null {
  const version = store.versions.find((item) => item.id === versionId);
  if (!version) return null;
  const frames = version.frames.map(({ hash, ...frame }) => ({ ...frame, html: store.html[hash] ?? "" }));
  const keep = new Set(frames.map((frame) => frame.id));
  return { frames, remove: currentFrames.filter((frame) => !keep.has(frame.id)).map((frame) => frame.id) };
}

// ---- Editor adapter -------------------------------------------------------------------------------

type DesignFrameRecord = {
  id: TLShapeId;
  type: string;
  parentId: TLParentId;
  x: number;
  y: number;
  meta: JsonObject;
  props: { name?: unknown; w?: unknown; h?: unknown; html?: unknown };
};

export function captureDesignFrames(editor: Editor): DesignFrameSnapshot[] {
  return (editor.getCurrentPageShapes() as unknown as DesignFrameRecord[])
    .filter((shape) => shape.type === "design-frame")
    .map((shape) => ({
      id: String(shape.id),
      parentId: String(shape.parentId),
      name: typeof shape.props.name === "string" ? shape.props.name : "Design",
      x: shape.x,
      y: shape.y,
      w: typeof shape.props.w === "number" ? shape.props.w : 1440,
      h: typeof shape.props.h === "number" ? shape.props.h : 900,
      html: typeof shape.props.html === "string" ? shape.props.html : ""
    }));
}

export function readEditorDesignVersions(editor: Editor): DesignVersionStore {
  return readDesignVersionStore(editor.getCurrentPage().meta);
}

function writeStore(editor: Editor, store: DesignVersionStore): void {
  const page = editor.getCurrentPage();
  // Versions are history, not an edit: Undo must not remove them.
  editor.run(
    () => {
      editor.updatePage({
        id: page.id,
        meta: { ...page.meta, [DESIGN_VERSIONS_META_KEY]: store as unknown as JsonObject }
      });
    },
    { history: "ignore" }
  );
}

/** Records the page's design frames as a new version, if they changed since the latest one. */
export function recordDesignVersion(editor: Editor, label: string): void {
  const store = readEditorDesignVersions(editor);
  const next = addDesignVersion(store, captureDesignFrames(editor), label, new Date(), crypto.randomUUID());
  if (next !== store) writeStore(editor, next);
}

/**
 * Before the agent's first change to a page that already has design frames, keeps them as a version,
 * so the state before the agent can be restored too.
 */
export function recordDesignBaseline(editor: Editor): void {
  if (readEditorDesignVersions(editor).versions.length > 0) return;
  recordDesignVersion(editor, "Before the agent");
}

/** Puts the page's design frames back to a version as one undoable change. */
export function restoreDesignVersion(editor: Editor, versionId: string): boolean {
  const current = captureDesignFrames(editor);
  const plan = planDesignRestore(readEditorDesignVersions(editor), versionId, current);
  if (!plan) return false;
  const pageId = editor.getCurrentPageId();
  editor.markHistoryStoppingPoint(`restore-design-version:${versionId}`);
  editor.run(() => {
    if (plan.remove.length) editor.deleteShapes(plan.remove as TLShapeId[]);
    for (const frame of plan.frames) {
      const id = frame.id as TLShapeId;
      const existing = editor.getShape(id) as unknown as DesignFrameRecord | undefined;
      const parentId = (editor.getShape(frame.parentId as TLShapeId) ? frame.parentId : pageId) as TLParentId;
      const props = { name: frame.name, w: frame.w, h: frame.h, html: frame.html };
      if (existing?.type === "design-frame") {
        editor.updateShape({ id, type: "design-frame", x: frame.x, y: frame.y, props } as never);
      } else {
        if (existing) editor.deleteShapes([id]);
        editor.createShape({
          id,
          type: "design-frame",
          parentId,
          x: frame.x,
          y: frame.y,
          props,
          meta: { kurva: { agent: true, autoHeight: false } }
        } as never);
      }
    }
  });
  return true;
}

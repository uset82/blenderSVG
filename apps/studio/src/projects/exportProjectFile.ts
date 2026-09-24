const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StudioProjectExportInput {
  id: string;
  title: string;
  snapshot: string;
  now?: string;
}

export function formatEditorSaveStatus(status: string): { label: string; retry: boolean } {
  if (status === "Saving…") return { label: "Saving…", retry: false };
  if (status === "Saved") return { label: "Auto-saved", retry: false };
  if (status === "Save failed") return { label: "Save failed", retry: true };
  if (status === "Browser session only" || status === "Kept in this browser session") {
    return { label: "Offline – kept locally", retry: false };
  }
  return { label: status, retry: false };
}

export function buildStudioProjectExport(input: StudioProjectExportInput): string {
  const title = input.title.trim();
  if (!PROJECT_ID.test(input.id)) throw new Error("The export needs a valid project id.");
  if (!title || title.length > 120) throw new Error("The export title must be 1 to 120 characters.");
  if (!input.snapshot.trim()) throw new Error("The export needs a canvas snapshot.");
  const now = input.now ?? new Date().toISOString();
  return JSON.stringify({
    createdAt: now,
    formatVersion: 1,
    id: input.id,
    snapshot: input.snapshot,
    title,
    updatedAt: now
  });
}

export function safeExportFileName(title: string, extension: "svg" | "png" | "json"): string {
  const safe = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${safe || "canvas"}.${extension === "json" ? "studio.json" : extension}`;
}

export function studioExportFileName(title: string): string {
  return safeExportFileName(title, "json");
}

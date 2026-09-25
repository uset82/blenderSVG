/**
 * True for a saved canvas with no records, such as the web Scratchpad placeholder
 * `{"document":{"schema":{},"store":{}}}`. tldraw cannot load a snapshot without its schema,
 * so the editor starts a fresh canvas for these instead of bouncing back to Home.
 */
export function isBlankCanvasSnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const store = (value as { document?: { store?: unknown } }).document?.store;
  return typeof store === "object" && store !== null && !Array.isArray(store) && Object.keys(store).length === 0;
}

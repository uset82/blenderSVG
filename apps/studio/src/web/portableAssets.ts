const PORTABLE_ASSET_SRC =
  /^(?:kurva-asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|blob:|data:image\/(?:png|jpeg|svg\+xml)[;,])/i;

/** Web imports keep only in-browser asset addresses. */
export function assertPortableAssetSources(snapshot: string): void {
  for (const match of snapshot.matchAll(/"src"\s*:\s*"([^"]*)"/g)) {
    const src = match[1] ?? "";
    if (!src) continue;
    if (!PORTABLE_ASSET_SRC.test(src)) {
      throw new Error("This project file points at an asset this browser will not load.");
    }
  }
}

/** A build-time tldraw license. Empty values stay unset so the watermark remains. */
export function readTldrawLicenseKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return key.length > 0 ? key : undefined;
}

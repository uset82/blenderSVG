/** A build-time tldraw license. Empty values stay unset so the SDK can show its notice. */
export function readTldrawLicenseKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return key.length > 0 ? key : undefined;
}

/** Local standalone loopback use stays available; other production builds need a license. */
export function canRenderTldrawCanvas(value: unknown, licenseRequired: boolean): boolean {
  return !licenseRequired || readTldrawLicenseKey(value) !== undefined;
}

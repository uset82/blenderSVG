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

/** The web edition always requires a license. Desktop production builds do too, except the loopback host. */
export function canvasLicenseRequired(input: {
  webEdition: boolean;
  production: boolean;
  standaloneHost: boolean;
}): boolean {
  if (input.webEdition) return true;
  return input.production && !input.standaloneHost;
}

/**
 * CI web builds fail closed without a tldraw license.
 * Local development proceeds unless CI is set. KURVA_ALLOW_MISSING_TLDRAW_LICENSE=1 is the explicit opt-out.
 */
export function webBuildLicenseBlock(input: {
  ci: boolean;
  licenseKey: string | undefined;
  allowMissing: boolean;
}): string | null {
  if (input.licenseKey?.trim()) return null;
  if (input.allowMissing) return null;
  if (!input.ci) return null;
  return "build:web refuses to build in CI without VITE_TLDRAW_LICENSE_KEY. Set KURVA_ALLOW_MISSING_TLDRAW_LICENSE=1 for a local development build.";
}

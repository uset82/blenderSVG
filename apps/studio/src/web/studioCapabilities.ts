import type { StudioHostKind } from "@codex-avatar-studio/avatar-core";

export const KURVA_DESKTOP_APP_URL = "https://kurva.agency";
export const DESKTOP_ONLY_REASON = "Available in the Kurva desktop app";

export interface StudioCapabilities {
  /** Settings → Blender, Send to Blender, and Blender shape actions. */
  blender: boolean;
  /** Connectors page cards and client tokens. */
  mcp: boolean;
  /** QuiverAI engine tab and settings. */
  quiver: boolean;
  /** Reveal in folder and other VS Code sidebar actions. */
  vscodeActions: boolean;
  /** Loopback standalone host. The only host allowed to call /api. */
  hostApi: boolean;
}

/**
 * Host-only surfaces. The web edition turns them off. Desktop hosts keep the
 * controls they already ship; MCP polling stays on the standalone host only.
 */
export function studioCapabilities(host: StudioHostKind): StudioCapabilities {
  const web = host === "web";
  return {
    blender: !web,
    mcp: host === "standalone",
    quiver: !web,
    vscodeActions: host === "vscode",
    hostApi: host === "standalone"
  };
}

export function shouldPollMcpApi(host: StudioHostKind): boolean {
  return studioCapabilities(host).hostApi;
}

/** True when the web edition should replace a host feature with a desktop link. */
export function showDesktopOnlyNotice(capabilities: StudioCapabilities): boolean {
  return !capabilities.blender && !capabilities.quiver && !capabilities.vscodeActions && !capabilities.hostApi;
}

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createWebTransport, OFFLINE_HOST_MESSAGE } from "../src/bridge/studioTransports.js";
import { canvasLicenseRequired, webBuildLicenseBlock } from "../src/tldrawLicense.js";
import { browserSupportGaps } from "../src/web/browserSupport.js";
import { createInitialHostState } from "../src/web/initialHostState.js";
import { isWebEdition, WEB_LIBRARY_STATUS } from "../src/web/kurvaTarget.js";
import { shouldPollMcpApi, showDesktopOnlyNotice, studioCapabilities } from "../src/web/studioCapabilities.js";

const licenseScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/check-web-license.mjs"
);

describe("web edition host", () => {
  it("recognizes the web build target and does not probe a desktop host", () => {
    expect(isWebEdition("web")).toBe(true);
    expect(isWebEdition(undefined)).toBe(false);
    expect(createInitialHostState({ webEdition: true, vscode: true, standalone: true })).toMatchObject({
      host: "web",
      workspaceTrusted: false,
      connection: { status: "disconnected", message: WEB_LIBRARY_STATUS }
    });
    expect(createInitialHostState({ webEdition: false, vscode: false, standalone: false })).toMatchObject({
      host: "browser",
      connection: { message: OFFLINE_HOST_MESSAGE }
    });
    expect(createInitialHostState({ webEdition: false, vscode: true, standalone: false }).host).toBe("vscode");
    expect(createInitialHostState({ webEdition: false, vscode: false, standalone: true }).host).toBe("standalone");
  });

  it("hides host-only surfaces on the web and polls MCP only on the standalone host", () => {
    const web = studioCapabilities("web");
    expect(web).toEqual({ blender: false, mcp: false, quiver: false, vscodeActions: false, hostApi: false });
    expect(showDesktopOnlyNotice(web)).toBe(true);
    expect(showDesktopOnlyNotice(studioCapabilities("standalone"))).toBe(false);
    expect(studioCapabilities("vscode").vscodeActions).toBe(true);
    expect(studioCapabilities("standalone").mcp).toBe(true);
    expect(shouldPollMcpApi("web")).toBe(false);
    expect(shouldPollMcpApi("vscode")).toBe(false);
    expect(shouldPollMcpApi("browser")).toBe(false);
    expect(shouldPollMcpApi("standalone")).toBe(true);
  });

  it("validates web transport messages without calling fetch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const transport = createWebTransport();
    transport.send({ type: "studio:ready" });
    const stop = transport.subscribe(() => undefined);
    stop();
    expect(transport.kind).toBe("web");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(() => transport.send({ type: "studio:ready", apiKey: "secret" } as never)).toThrow();
    vi.unstubAllGlobals();
  });

  it("requires a tldraw license for every web canvas and fails closed in CI", () => {
    expect(canvasLicenseRequired({ webEdition: true, production: false, standaloneHost: true })).toBe(true);
    expect(canvasLicenseRequired({ webEdition: false, production: true, standaloneHost: true })).toBe(false);
    expect(canvasLicenseRequired({ webEdition: false, production: true, standaloneHost: false })).toBe(true);
    expect(webBuildLicenseBlock({ ci: true, licenseKey: "", allowMissing: false })).toMatch(/VITE_TLDRAW_LICENSE_KEY/);
    expect(webBuildLicenseBlock({ ci: true, licenseKey: "tldraw-key", allowMissing: false })).toBeNull();
    expect(webBuildLicenseBlock({ ci: true, licenseKey: "", allowMissing: true })).toBeNull();
    expect(webBuildLicenseBlock({ ci: false, licenseKey: "", allowMissing: false })).toBeNull();
    const blocked = spawnSync(process.execPath, [licenseScript], {
      env: { ...process.env, CI: "true", VITE_TLDRAW_LICENSE_KEY: "", KURVA_ALLOW_MISSING_TLDRAW_LICENSE: "" },
      encoding: "utf8"
    });
    expect(blocked.status).toBe(1);
    const allowed = spawnSync(process.execPath, [licenseScript], {
      env: { ...process.env, CI: "true", VITE_TLDRAW_LICENSE_KEY: "", KURVA_ALLOW_MISSING_TLDRAW_LICENSE: "1" },
      encoding: "utf8"
    });
    expect(allowed.status).toBe(0);
  });

  it("lists every missing browser feature", () => {
    expect(
      browserSupportGaps({
        secureContext: true,
        subtleCrypto: true,
        indexedDB: true,
        webAssembly: true,
        moduleWorker: true,
        webLocks: true,
        broadcastChannel: true
      })
    ).toEqual([]);
    expect(
      browserSupportGaps({
        secureContext: false,
        subtleCrypto: false,
        indexedDB: true,
        webAssembly: false,
        moduleWorker: true,
        webLocks: false,
        broadcastChannel: true
      })
    ).toEqual(["a secure context (HTTPS)", "WebCrypto (crypto.subtle)", "WebAssembly", "the Web Locks API"]);
  });
});

import { describe, expect, it } from "vitest";
import { canRenderTldrawCanvas, readTldrawLicenseKey } from "../src/tldrawLicense.js";

describe("tldraw license key", () => {
  it("leaves the key unset when the env value is missing or blank", () => {
    expect(readTldrawLicenseKey(undefined)).toBeUndefined();
    expect(readTldrawLicenseKey("   ")).toBeUndefined();
  });

  it("passes through a provided key without changing it", () => {
    expect(readTldrawLicenseKey("  studio-license  ")).toBe("studio-license");
  });

  it("allows local development and standalone hosts, and requires a key for production embeds", () => {
    expect(canRenderTldrawCanvas(undefined, false)).toBe(true);
    expect(canRenderTldrawCanvas(undefined, true)).toBe(false);
    expect(canRenderTldrawCanvas("  ", true)).toBe(false);
    expect(canRenderTldrawCanvas("studio-license", true)).toBe(true);
  });
});

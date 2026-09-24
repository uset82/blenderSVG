import { describe, expect, it } from "vitest";
import { readTldrawLicenseKey } from "../src/tldrawLicense.js";

describe("tldraw license key", () => {
  it("leaves the key unset when the env value is missing or blank", () => {
    expect(readTldrawLicenseKey(undefined)).toBeUndefined();
    expect(readTldrawLicenseKey("   ")).toBeUndefined();
  });

  it("passes through a provided key without changing it", () => {
    expect(readTldrawLicenseKey("  studio-license  ")).toBe("studio-license");
  });
});

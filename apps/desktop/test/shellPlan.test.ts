import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { desktopShellPlan, readDesktopSecret, rememberDesktopSecret } from "../src/shellPlan.mjs";

describe("desktop shell", () => {
  it("uses one instance, safeStorage, the native menus, and no auto-update", () => {
    expect(desktopShellPlan()).toEqual({
      singleInstance: true,
      autoUpdate: false,
      secretStore: "safeStorage",
      menus: ["File", "Edit", "View", "Window", "Help"]
    });
    const main = readFileSync(path.join(import.meta.dirname, "../src/main.mjs"), "utf8");
    expect(main).toContain("requestSingleInstanceLock");
    expect(main).not.toContain("autoUpdater");
  });

  it("encrypts a secret only when the computer can", () => {
    const stored = rememberDesktopSecret(
      {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`enc:${value}`)
      },
      "openrouter-placeholder"
    );
    expect(readDesktopSecret({ decryptString: (value: Buffer) => value.toString().slice(4) }, stored)).toBe(
      "openrouter-placeholder"
    );
    expect(() =>
      rememberDesktopSecret({ isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0) }, "x")
    ).toThrow(/cannot encrypt/);
  });
});

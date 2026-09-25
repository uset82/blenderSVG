import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_THEME,
  isStudioTheme,
  nextStudioTheme,
  readStoredStudioTheme,
  readVsCodeTheme,
  rememberStudioTheme,
  resolveStudioTheme,
  STUDIO_THEME_PAGE_BACKGROUNDS,
  STUDIO_THEME_STORAGE_KEY,
  type StudioTheme
} from "../src/components/studioTheme.js";

const storageWith = (value: string | null) => ({ getItem: () => value });
const failingStorage = {
  getItem: (): string | null => {
    throw new Error("storage denied");
  },
  setItem: (): void => {
    throw new Error("storage denied");
  }
};
const classListWith = (...tokens: string[]) => ({ contains: (token: string) => tokens.includes(token) });

describe("studio theme resolution", () => {
  it("defaults the standalone Studio to the Kurva paper light theme", () => {
    expect(DEFAULT_STUDIO_THEME).toBe("light");
    expect(resolveStudioTheme(storageWith(null), classListWith())).toBe("light");
  });

  it("keeps the user's stored choice ahead of the editor theme and the default", () => {
    expect(resolveStudioTheme(storageWith("dark"), classListWith("vscode-light"))).toBe("dark");
    expect(resolveStudioTheme(storageWith("contrast"), classListWith())).toBe("contrast");
    expect(resolveStudioTheme(storageWith("light"), classListWith("vscode-dark"))).toBe("light");
  });

  it("ignores stored values that are not Studio themes", () => {
    expect(readStoredStudioTheme(storageWith("solarized"))).toBeNull();
    expect(resolveStudioTheme(storageWith("solarized"), classListWith())).toBe("light");
  });

  it("falls back to the default when storage is unavailable", () => {
    expect(readStoredStudioTheme(failingStorage)).toBeNull();
    expect(resolveStudioTheme(failingStorage, classListWith())).toBe("light");
    expect(() => rememberStudioTheme("dark", failingStorage)).not.toThrow();
  });

  it("follows the VS Code editor theme inside the Webview", () => {
    expect(readVsCodeTheme(classListWith("vscode-dark"))).toBe("dark");
    expect(readVsCodeTheme(classListWith("vscode-light"))).toBe("light");
    expect(readVsCodeTheme(classListWith("vscode-dark", "vscode-high-contrast"))).toBe("contrast");
    expect(readVsCodeTheme(classListWith("vscode-light", "vscode-high-contrast-light"))).toBe("contrast");
    expect(readVsCodeTheme(classListWith("some-other-class"))).toBeNull();
    expect(resolveStudioTheme(storageWith(null), classListWith("vscode-dark"))).toBe("dark");
  });

  it("saves the picked theme under the existing storage key", () => {
    const writes: Array<[string, string]> = [];
    rememberStudioTheme("dark", { setItem: (key, value) => writes.push([key, value]) });
    expect(writes).toEqual([[STUDIO_THEME_STORAGE_KEY, "dark"]]);
  });

  it("keeps Dark one click away from the Light default", () => {
    expect(nextStudioTheme("light")).toBe("dark");
    expect(nextStudioTheme("dark")).toBe("contrast");
    expect(nextStudioTheme("contrast")).toBe("light");
  });

  it("has a valid page background default for every theme", () => {
    for (const theme of ["dark", "light", "contrast"] as StudioTheme[]) {
      expect(STUDIO_THEME_PAGE_BACKGROUNDS[theme]).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(isStudioTheme("light")).toBe(true);
    expect(isStudioTheme("sepia")).toBe(false);
  });
});

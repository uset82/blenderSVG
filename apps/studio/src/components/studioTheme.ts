export type StudioTheme = "dark" | "light" | "contrast";

export const STUDIO_THEME_STORAGE_KEY = "codex-avatar-studio-theme";

/** The standalone Studio opens on the Kurva paper light theme unless the user picked another one. */
export const DEFAULT_STUDIO_THEME: StudioTheme = "light";

/** Inspector page-background default for each theme, matching the `--studio-canvas` token. */
export const STUDIO_THEME_PAGE_BACKGROUNDS: Record<StudioTheme, string> = {
  dark: "#16150f",
  light: "#f3eee3",
  contrast: "#000000"
};

interface ThemeStorage {
  getItem(key: string): string | null;
}

interface ThemeWriter {
  setItem(key: string, value: string): void;
}

interface ThemeClassList {
  contains(token: string): boolean;
}

export function isStudioTheme(value: unknown): value is StudioTheme {
  return value === "dark" || value === "light" || value === "contrast";
}

/** The theme the user explicitly picked, or null when no choice was saved. */
export function readStoredStudioTheme(storage?: ThemeStorage | null): StudioTheme | null {
  try {
    const stored = (storage ?? window.localStorage).getItem(STUDIO_THEME_STORAGE_KEY);
    return isStudioTheme(stored) ? stored : null;
  } catch {
    // Theme choice is optional; fall through when browser storage is unavailable.
    return null;
  }
}

/** Maps the VS Code Webview body classes to the matching Studio theme, or null outside VS Code. */
export function readVsCodeTheme(classList?: ThemeClassList | null): StudioTheme | null {
  const classes = classList ?? (typeof document === "undefined" ? null : document.body?.classList) ?? null;
  if (!classes) return null;
  if (classes.contains("vscode-high-contrast") || classes.contains("vscode-high-contrast-light")) return "contrast";
  if (classes.contains("vscode-light")) return "light";
  if (classes.contains("vscode-dark")) return "dark";
  return null;
}

/**
 * Resolves the opening theme: an explicit user choice wins, the VS Code editor theme is
 * followed inside the Webview, and the standalone Studio starts on the Kurva paper light theme.
 */
export function resolveStudioTheme(storage?: ThemeStorage | null, classList?: ThemeClassList | null): StudioTheme {
  return readStoredStudioTheme(storage) ?? readVsCodeTheme(classList) ?? DEFAULT_STUDIO_THEME;
}

/** Saves the theme the user picked so later sessions keep it. */
export function rememberStudioTheme(theme: StudioTheme, storage?: ThemeWriter | null): void {
  try {
    (storage ?? window.localStorage).setItem(STUDIO_THEME_STORAGE_KEY, theme);
  } catch {
    // Theme choice remains available for this session when storage is restricted.
  }
}

/** The window-bar cycle keeps Dark one click away from the Light default. */
export function nextStudioTheme(current: StudioTheme): StudioTheme {
  return current === "light" ? "dark" : current === "dark" ? "contrast" : "light";
}

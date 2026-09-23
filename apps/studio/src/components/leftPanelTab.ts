export const LEFT_PANEL_TABS = ["agent", "layers", "pages", "assets", "styles"] as const;

export type LeftPanelTab = (typeof LEFT_PANEL_TABS)[number];

const KEY = "codex-avatar-studio-left-panel-tab";

export function readLeftPanelTab(storage?: Pick<Storage, "getItem">): LeftPanelTab {
  try {
    const stored = (storage ?? window.localStorage).getItem(KEY);
    return LEFT_PANEL_TABS.find((tab) => tab === stored) ?? "agent";
  } catch {
    return "agent";
  }
}

export function writeLeftPanelTab(tab: LeftPanelTab, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? window.localStorage).setItem(KEY, tab);
  } catch {
    // The tab still changes for this visit when browser storage is unavailable.
  }
}

export type ModelNavigationKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/** Resolve a bounded listbox move; -1 means focus is outside the model options. */
export function nextModelOptionIndex(
  key: ModelNavigationKey,
  currentIndex: number,
  optionCount: number
): number | null {
  if (optionCount <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return optionCount - 1;
  if (key === "ArrowDown") return currentIndex < 0 ? 0 : Math.min(optionCount - 1, currentIndex + 1);
  return currentIndex < 0 ? optionCount - 1 : Math.max(0, currentIndex - 1);
}

import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { isDuplicateRoute, MODEL_SORT_OPTIONS, type ModelSortOrder, readCatalogPrice } from "./modelFilters.js";

export interface ModelPickerGroup {
  id: string;
  label: string;
  models: StudioModel[];
}

export type QuickModelFilter = "free" | "vision" | "tools" | "reasoning" | "intelligence";

const QUICK_FILTER_BADGE: Record<QuickModelFilter, string> = {
  free: "Free",
  vision: "Vision",
  tools: "Tools",
  reasoning: "Reasoning",
  intelligence: "Intelligence"
};

export function isFreeModel(model: StudioModel): boolean {
  const input = readCatalogPrice(model.promptPrice);
  const output = readCatalogPrice(model.completionPrice);
  return (input === 0 && output === 0) || model.id.endsWith(":free") || /\(free\)\s*$/i.test(model.name);
}

export function modelBadges(model: StudioModel): string[] {
  const badges: string[] = [];
  if (isFreeModel(model)) badges.push("Free");
  if (model.inputModalities.includes("image")) badges.push("Vision");
  if (model.supportedParameters.some((parameter) => parameter === "tools" || parameter === "tool_choice"))
    badges.push("Tools");
  if (model.supportedParameters.some((parameter) => parameter.toLowerCase().includes("reason")))
    badges.push("Reasoning");
  if (typeof model.intelligence === "number") badges.push("Intelligence");
  return badges;
}

export function filterModelsByBadges(
  models: readonly StudioModel[],
  filters: readonly QuickModelFilter[]
): StudioModel[] {
  if (filters.length === 0) return [...models];
  return models.filter((model) => {
    const badges = modelBadges(model);
    return filters.every((filter) => badges.includes(QUICK_FILTER_BADGE[filter]));
  });
}

export function groupCatalogModels(
  models: readonly StudioModel[],
  favoriteIds: readonly string[],
  recentIds: readonly string[],
  sortOrder?: ModelSortOrder
): ModelPickerGroup[] {
  // Drop OpenRouter's duplicate routes — `~vendor/model-latest` aliases and
  // `vendor/model:batch` variants — so each interactive model appears once.
  const visible = models.filter((model) => !isDuplicateRoute(model));
  const byId = new Map(visible.map((model) => [model.id, model]));
  const used = new Set<string>();
  const take = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const model = byId.get(id);
      if (!model || used.has(id)) return [];
      used.add(id);
      return [model];
    });
  const groups: ModelPickerGroup[] = [];
  const favorites = take(favoriteIds);
  const recent = take(recentIds);
  if (favorites.length > 0) groups.push({ id: "favorites", label: "Favorites", models: favorites });
  if (recent.length > 0) groups.push({ id: "recent", label: "Recent", models: recent });

  const remaining = visible.filter((model) => !used.has(model.id));

  if (sortOrder && sortOrder !== "most-popular") {
    const sortOption = MODEL_SORT_OPTIONS.find((opt) => opt.id === sortOrder);
    const label = sortOption ? sortOption.label : "Ranked";
    if (remaining.length > 0) {
      groups.push({ id: `sorted:${sortOrder}`, label, models: remaining });
    }
    return groups;
  }

  const publishers = new Map<string, StudioModel[]>();
  for (const model of remaining) {
    const label = model.author || "Other";
    const list = publishers.get(label) ?? [];
    list.push(model);
    publishers.set(label, list);
  }
  for (const label of [...publishers.keys()].sort((left, right) => left.localeCompare(right))) {
    groups.push({ id: `publisher:${label}`, label, models: publishers.get(label) ?? [] });
  }
  return groups;
}

export const FAVORITE_MODELS_KEY = "codex-avatar-studio-favorite-models";
export const RECENT_MODELS_KEY = "codex-avatar-studio-recent-models";
export const SELECTED_MODEL_KEY = "codex-avatar-studio-selected-model";

export function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function writeStoredIds(key: string, ids: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 20)));
  } catch {
    // Local storage unavailable
  }
}

export function recordRecentModel(modelId: string): void {
  const current = readStoredIds(RECENT_MODELS_KEY).filter((id) => id !== modelId);
  writeStoredIds(RECENT_MODELS_KEY, [modelId, ...current].slice(0, 5));
}

export function formatShortCatalogPrice(model: StudioModel): string {
  if (isFreeModel(model)) return "Free";
  const input = readCatalogPrice(model.promptPrice);
  const output = readCatalogPrice(model.completionPrice);
  if (input === null || output === null) return "Price n/a";
  const format = (value: number) => (value * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `$${format(input)} / $${format(output)}`;
}

export function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000)
    return `${(contextLength / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M context`;
  if (contextLength >= 1_000) return `${Math.round(contextLength / 1_000)}K context`;
  return `${contextLength.toLocaleString()} context`;
}

export function safeDomId(value: string): string {
  return Array.from(value, (character) => character.codePointAt(0)?.toString(16) ?? "0").join("-");
}

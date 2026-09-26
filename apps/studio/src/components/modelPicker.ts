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

export function modelBadges(model: StudioModel): string[] {
  const badges: string[] = [];
  const input = readCatalogPrice(model.promptPrice);
  const output = readCatalogPrice(model.completionPrice);
  if (input === 0 && output === 0) badges.push("Free");
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

import type { StudioModel } from "@codex-avatar-studio/avatar-core";

export type PriceFilter = "all" | "free" | "paid" | "unknown";
export type ModalityFilter = "all" | "text" | "vision" | "image-output";

export type ModelSortOrder =
  | "most-popular"
  | "intelligence-high-to-low"
  | "intelligence-low-to-high"
  | "coding-high-to-low"
  | "coding-low-to-high"
  | "agentic-high-to-low"
  | "agentic-low-to-high"
  | "design-arena-elo-high-to-low"
  | "design-arena-elo-low-to-high"
  | "pricing-low-to-high"
  | "pricing-high-to-low"
  | "context-high-to-low"
  | "context-low-to-high"
  | "newest"
  | "oldest";

export const MODEL_SORT_OPTIONS: ReadonlyArray<{ id: ModelSortOrder; label: string }> = [
  { id: "most-popular", label: "Most Popular" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "pricing-low-to-high", label: "Pricing: Low to High" },
  { id: "pricing-high-to-low", label: "Pricing: High to Low" },
  { id: "context-high-to-low", label: "Context: High to Low" },
  { id: "context-low-to-high", label: "Context: Low to High" },
  { id: "intelligence-high-to-low", label: "Intelligence: High to Low" },
  { id: "intelligence-low-to-high", label: "Intelligence: Low to High" },
  { id: "coding-high-to-low", label: "Coding: High to Low" },
  { id: "coding-low-to-high", label: "Coding: Low to High" },
  { id: "agentic-high-to-low", label: "Agentic: High to Low" },
  { id: "agentic-low-to-high", label: "Agentic: Low to High" },
  { id: "design-arena-elo-high-to-low", label: "Design Arena ELO: High to Low" },
  { id: "design-arena-elo-low-to-high", label: "Design Arena ELO: Low to High" }
];

export interface StudioModelFilters {
  query: string;
  author: string;
  price: PriceFilter;
  modality: ModalityFilter;
  minimumContext: number | null;
  maximumInputPricePerMillion: number | null;
  maximumOutputPricePerMillion: number | null;
}

/** Apply user-visible catalog filters without changing model availability or selection. */
export function filterStudioModels(models: StudioModel[], filters: StudioModelFilters): StudioModel[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return models.filter((model) => {
    const inputPrice = readCatalogPrice(model.promptPrice);
    const outputPrice = readCatalogPrice(model.completionPrice);
    const isFree = inputPrice === 0 && outputPrice === 0;
    const isPaid = (inputPrice !== null && inputPrice > 0) || (outputPrice !== null && outputPrice > 0);
    const hasUnknownPrice = inputPrice === null || outputPrice === null;
    const matchesPrice =
      filters.price === "all" ||
      (filters.price === "free" && isFree) ||
      (filters.price === "paid" && isPaid) ||
      (filters.price === "unknown" && hasUnknownPrice);
    const matchesModality =
      filters.modality === "all" ||
      (filters.modality === "text" && model.textChatEligible) ||
      (filters.modality === "vision" && model.textChatEligible && model.inputModalities.includes("image")) ||
      (filters.modality === "image-output" && model.outputModalities.includes("image"));
    const matchesContext = filters.minimumContext === null || model.contextLength >= filters.minimumContext;
    const matchesInputPrice =
      filters.maximumInputPricePerMillion === null ||
      (inputPrice !== null && inputPrice * 1_000_000 <= filters.maximumInputPricePerMillion);
    const matchesOutputPrice =
      filters.maximumOutputPricePerMillion === null ||
      (outputPrice !== null && outputPrice * 1_000_000 <= filters.maximumOutputPricePerMillion);
    const matchesQuery = !query || `${model.name} ${model.id} ${model.author}`.toLocaleLowerCase().includes(query);

    return (
      matchesQuery &&
      (filters.author === "all" || model.author === filters.author) &&
      matchesPrice &&
      matchesModality &&
      matchesContext &&
      matchesInputPrice &&
      matchesOutputPrice
    );
  });
}

export function readCatalogPrice(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function sortStudioModels(models: readonly StudioModel[], sortOrder: ModelSortOrder): StudioModel[] {
  if (sortOrder === "most-popular") {
    return [...models];
  }

  const list = [...models];

  switch (sortOrder) {
    case "intelligence-high-to-low":
      return list.sort((a, b) => compareMetric(a, b, "intelligence", "desc"));
    case "intelligence-low-to-high":
      return list.sort((a, b) => compareMetric(a, b, "intelligence", "asc"));
    case "coding-high-to-low":
      return list.sort((a, b) => compareMetric(a, b, "codingIndex", "desc"));
    case "coding-low-to-high":
      return list.sort((a, b) => compareMetric(a, b, "codingIndex", "asc"));
    case "agentic-high-to-low":
      return list.sort((a, b) => compareMetric(a, b, "agenticIndex", "desc"));
    case "agentic-low-to-high":
      return list.sort((a, b) => compareMetric(a, b, "agenticIndex", "asc"));
    case "design-arena-elo-high-to-low":
      return list.sort((a, b) => compareMetric(a, b, "designArenaElo", "desc"));
    case "design-arena-elo-low-to-high":
      return list.sort((a, b) => compareMetric(a, b, "designArenaElo", "asc"));
    case "pricing-low-to-high":
      return list.sort((a, b) => {
        const priceA = (readCatalogPrice(a.promptPrice) ?? 0) + (readCatalogPrice(a.completionPrice) ?? 0);
        const priceB = (readCatalogPrice(b.promptPrice) ?? 0) + (readCatalogPrice(b.completionPrice) ?? 0);
        return priceA - priceB;
      });
    case "pricing-high-to-low":
      return list.sort((a, b) => {
        const priceA = (readCatalogPrice(a.promptPrice) ?? 0) + (readCatalogPrice(a.completionPrice) ?? 0);
        const priceB = (readCatalogPrice(b.promptPrice) ?? 0) + (readCatalogPrice(b.completionPrice) ?? 0);
        return priceB - priceA;
      });
    case "context-high-to-low":
      return list.sort((a, b) => b.contextLength - a.contextLength);
    case "context-low-to-high":
      return list.sort((a, b) => a.contextLength - b.contextLength);
    case "newest":
      return list.sort((a, b) => byRecency(a, b, "desc"));
    case "oldest":
      return list.sort((a, b) => byRecency(a, b, "asc"));
    default:
      return list;
  }
}

/**
 * Order two models by a benchmark metric, keeping the result deterministic.
 *
 * Unscored models always sink below scored ones, and — crucially — the unscored
 * tail is ordered by recency rather than by name. OpenRouter only scores a
 * fraction of its catalog (roughly 136 of 628 at the time of writing), so an
 * alphabetical tail turned most of the list into what looked like random noise.
 */
function compareMetric(
  a: StudioModel,
  b: StudioModel,
  key: "intelligence" | "codingIndex" | "agenticIndex" | "designArenaElo",
  direction: "asc" | "desc"
): number {
  const aVal = a[key] ?? null;
  const bVal = b[key] ?? null;
  if (aVal !== null && bVal !== null && aVal !== bVal) {
    return direction === "desc" ? bVal - aVal : aVal - bVal;
  }
  if (aVal !== null && bVal === null) return -1;
  if (aVal === null && bVal !== null) return 1;
  // Both scored equal, or both unscored: fall back to recency, then name.
  return byRecency(a, b, "desc") || a.name.localeCompare(b.name);
}

function byRecency(a: StudioModel, b: StudioModel, direction: "asc" | "desc"): number {
  const aVal = a.created ?? null;
  const bVal = b.created ?? null;
  if (aVal === bVal) return 0;
  if (aVal === null) return 1;
  if (bVal === null) return -1;
  return direction === "desc" ? bVal - aVal : aVal - bVal;
}

/** OpenRouter lists `~vendor/model-latest` alias routes that duplicate the
 *  canonical slug. Hiding them removes near-identical rows from the picker. */
export function isAliasModel(model: StudioModel): boolean {
  return model.id.startsWith("~");
}

/** Batch-processing variants (`vendor/model:batch`) are the same model at a
 *  lower price with higher latency. There are ~76 of them, and they otherwise
 *  duplicate the interactive model in every ranked list. */
export function isBatchVariant(model: StudioModel): boolean {
  return model.id.endsWith(":batch") || /\(batch\)\s*$/i.test(model.name);
}

/** Rows that only add noise to a picker meant for interactive chat. */
export function isDuplicateRoute(model: StudioModel): boolean {
  return isAliasModel(model) || isBatchVariant(model);
}

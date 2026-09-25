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
      return list.sort((a, b) => {
        const aVal = a.intelligence;
        const bVal = b.intelligence;
        if (aVal != null && bVal != null) return bVal - aVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "intelligence-low-to-high":
      return list.sort((a, b) => {
        const aVal = a.intelligence;
        const bVal = b.intelligence;
        if (aVal != null && bVal != null) return aVal - bVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "coding-high-to-low":
      return list.sort((a, b) => {
        const aVal = a.codingIndex;
        const bVal = b.codingIndex;
        if (aVal != null && bVal != null) return bVal - aVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "coding-low-to-high":
      return list.sort((a, b) => {
        const aVal = a.codingIndex;
        const bVal = b.codingIndex;
        if (aVal != null && bVal != null) return aVal - bVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "agentic-high-to-low":
      return list.sort((a, b) => {
        const aVal = a.agenticIndex;
        const bVal = b.agenticIndex;
        if (aVal != null && bVal != null) return bVal - aVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "agentic-low-to-high":
      return list.sort((a, b) => {
        const aVal = a.agenticIndex;
        const bVal = b.agenticIndex;
        if (aVal != null && bVal != null) return aVal - bVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "design-arena-elo-high-to-low":
      return list.sort((a, b) => {
        const aVal = a.designArenaElo;
        const bVal = b.designArenaElo;
        if (aVal != null && bVal != null) return bVal - aVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
    case "design-arena-elo-low-to-high":
      return list.sort((a, b) => {
        const aVal = a.designArenaElo;
        const bVal = b.designArenaElo;
        if (aVal != null && bVal != null) return aVal - bVal;
        if (aVal != null) return -1;
        if (bVal != null) return 1;
        return a.name.localeCompare(b.name);
      });
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
      return list.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
    case "oldest":
      return list.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
    default:
      return list;
  }
}

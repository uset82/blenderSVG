import type { StudioModel } from "@codex-avatar-studio/avatar-core";

export type PriceFilter = "all" | "free" | "paid" | "unknown";
export type ModalityFilter = "all" | "text" | "vision" | "image-output";

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

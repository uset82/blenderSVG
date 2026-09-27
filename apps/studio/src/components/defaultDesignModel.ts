import type { StudioModel } from "@codex-avatar-studio/avatar-core";

function score(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function price(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function isFreeModel(model: StudioModel): boolean {
  return price(model.promptPrice) === 0 && price(model.completionPrice) === 0;
}

function canDesign(model: StudioModel): boolean {
  return model.textChatEligible && model.supportedParameters.includes("tools");
}

/** Best design ranking first: design-arena Elo, then coding index, then intelligence, then newest. */
function byDesignStrength(left: StudioModel, right: StudioModel): number {
  return (
    score(right.designArenaElo) - score(left.designArenaElo) ||
    score(right.codingIndex) - score(left.codingIndex) ||
    score(right.intelligence) - score(left.intelligence) ||
    (right.created ?? 0) - (left.created ?? 0)
  );
}

/**
 * The model a new user starts with: the strongest tool-capable model for design in their catalog.
 * Falls back to any text model when none lists tool support (it then designs through code blocks).
 */
export function pickDefaultDesignModel(models: readonly StudioModel[]): StudioModel | undefined {
  const designers = models.filter(canDesign).sort(byDesignStrength);
  if (designers[0]) return designers[0];
  return models.filter((model) => model.textChatEligible).sort(byDesignStrength)[0];
}

/** The strongest free tool-capable model, for "Use a free model". */
export function pickFreeDesignModel(models: readonly StudioModel[]): StudioModel | undefined {
  return models.filter((model) => canDesign(model) && isFreeModel(model)).sort(byDesignStrength)[0];
}

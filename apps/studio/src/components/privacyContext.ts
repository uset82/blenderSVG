export const WEB_DIRECT_REQUEST = "Requests go directly from this browser to OpenRouter. Kurva has no server.";

export function sendContextLines(input: {
  modelName: string | null;
  draftCharacters: number;
  historyCount: number;
  attachmentName: string | null;
  direct?: boolean;
}): string[] {
  return [
    input.modelName ? `Model: ${input.modelName}` : "No model selected.",
    `Draft: ${input.draftCharacters} characters.`,
    `Earlier messages included: ${input.historyCount}.`,
    input.attachmentName ? `Image: ${input.attachmentName}.` : "No image attached.",
    "The OpenRouter key is not included.",
    ...(input.direct ? [WEB_DIRECT_REQUEST] : [])
  ];
}

export function paidModelCue(inputPrice: number | null, outputPrice: number | null): string | null {
  if (inputPrice === null || outputPrice === null)
    return "Catalog price was not returned, so Studio cannot tell whether this model is free.";
  if (inputPrice > 0 || outputPrice > 0) return "This model is listed as paid.";
  return null;
}

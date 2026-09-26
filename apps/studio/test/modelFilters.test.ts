import { describe, expect, it } from "vitest";
import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import {
  filterStudioModels,
  isAliasModel,
  isBatchVariant,
  isDuplicateRoute,
  sortStudioModels,
  type StudioModelFilters
} from "../src/components/modelFilters.js";

const models: StudioModel[] = [
  makeModel({
    id: "openai/free-text",
    name: "Free Text",
    author: "openai",
    contextLength: 32_000,
    promptPrice: "0",
    completionPrice: "0"
  }),
  makeModel({
    id: "anthropic/vision-paid",
    name: "Vision Paid",
    author: "anthropic",
    contextLength: 200_000,
    inputModalities: ["text", "image"],
    promptPrice: "0.000002",
    completionPrice: "0.000008"
  }),
  makeModel({
    id: "example/image-output",
    name: "Image Output",
    author: "example",
    contextLength: 16_000,
    outputModalities: ["image"],
    textChatEligible: false,
    promptPrice: "0.00001",
    completionPrice: "0.00002"
  }),
  makeModel({
    id: "example/unknown-price",
    name: "Unknown Price",
    author: "example",
    promptPrice: "",
    completionPrice: ""
  })
];

const noFilters: StudioModelFilters = {
  query: "",
  author: "all",
  price: "all",
  modality: "all",
  minimumContext: null,
  maximumInputPricePerMillion: null,
  maximumOutputPricePerMillion: null
};

describe("OpenRouter model catalog filters", () => {
  it("keeps all catalog entries visible until a filter is selected", () => {
    expect(filterStudioModels(models, noFilters).map((model) => model.id)).toEqual(models.map((model) => model.id));
  });

  it("filters by publisher, ID/name search, and capability without changing eligibility", () => {
    expect(
      filterStudioModels(models, { ...noFilters, author: "anthropic", modality: "vision" }).map((model) => model.id)
    ).toEqual(["anthropic/vision-paid"]);
    expect(
      filterStudioModels(models, { ...noFilters, query: "IMAGE OUTPUT", modality: "image-output" }).map(
        (model) => model.id
      )
    ).toEqual(["example/image-output"]);
    expect(filterStudioModels(models, { ...noFilters, modality: "text" }).map((model) => model.id)).toEqual([
      "openai/free-text",
      "anthropic/vision-paid",
      "example/unknown-price"
    ]);
  });

  it("filters free, paid, unknown-price, context, and per-million-token limits", () => {
    expect(filterStudioModels(models, { ...noFilters, price: "free" }).map((model) => model.id)).toEqual([
      "openai/free-text"
    ]);
    expect(filterStudioModels(models, { ...noFilters, price: "paid" }).map((model) => model.id)).toEqual([
      "anthropic/vision-paid",
      "example/image-output"
    ]);
    expect(filterStudioModels(models, { ...noFilters, price: "unknown" }).map((model) => model.id)).toEqual([
      "example/unknown-price"
    ]);
    expect(filterStudioModels(models, { ...noFilters, minimumContext: 128_000 }).map((model) => model.id)).toEqual([
      "anthropic/vision-paid"
    ]);
    expect(
      filterStudioModels(models, { ...noFilters, maximumInputPricePerMillion: 1 }).map((model) => model.id)
    ).toEqual(["openai/free-text"]);
    expect(
      filterStudioModels(models, { ...noFilters, maximumOutputPricePerMillion: 8 }).map((model) => model.id)
    ).toEqual(["openai/free-text", "anthropic/vision-paid"]);
  });

  it("sorts models by intelligence (high to low and low to high)", () => {
    const list: StudioModel[] = [
      makeModel({ id: "a/no-intel", name: "A", intelligence: null }),
      makeModel({ id: "b/high-intel", name: "B", intelligence: 60.5 }),
      makeModel({ id: "c/mid-intel", name: "C", intelligence: 45.2 })
    ];

    expect(sortStudioModels(list, "intelligence-high-to-low").map((entry) => entry.id)).toEqual([
      "b/high-intel",
      "c/mid-intel",
      "a/no-intel"
    ]);

    expect(sortStudioModels(list, "intelligence-low-to-high").map((entry) => entry.id)).toEqual([
      "c/mid-intel",
      "b/high-intel",
      "a/no-intel"
    ]);
  });

  it("sorts models by context length and price", () => {
    const list: StudioModel[] = [
      makeModel({ id: "low-ctx", contextLength: 8_000, promptPrice: "0.000005", completionPrice: "0.000005" }),
      makeModel({ id: "high-ctx", contextLength: 200_000, promptPrice: "0.000001", completionPrice: "0.000001" })
    ];

    expect(sortStudioModels(list, "context-high-to-low").map((entry) => entry.id)).toEqual(["high-ctx", "low-ctx"]);

    expect(sortStudioModels(list, "pricing-low-to-high").map((entry) => entry.id)).toEqual(["high-ctx", "low-ctx"]);
  });

  it("orders the unscored tail by recency instead of by name", () => {
    // OpenRouter only scores a fraction of its catalog, so the unscored tail is
    // most of the list. It must stay newest-first rather than alphabetical.
    const list: StudioModel[] = [
      makeModel({ id: "zzz/old-unscored", name: "Zzz Old", created: 100, intelligence: null }),
      makeModel({ id: "aaa/new-unscored", name: "Aaa New", created: 900, intelligence: null }),
      makeModel({ id: "mmm/mid-unscored", name: "Mmm Mid", created: 500, intelligence: null }),
      makeModel({ id: "top/scored", name: "Top Scored", created: 50, intelligence: 71.2 })
    ];

    expect(sortStudioModels(list, "intelligence-high-to-low").map((entry) => entry.id)).toEqual([
      "top/scored",
      "aaa/new-unscored",
      "mmm/mid-unscored",
      "zzz/old-unscored"
    ]);
  });

  it("sinks unscored models below scored ones in both directions", () => {
    const list: StudioModel[] = [
      makeModel({ id: "a/unscored", name: "A", created: 10, intelligence: null }),
      makeModel({ id: "b/scored", name: "B", created: 20, intelligence: 40 })
    ];

    // Even low-to-high keeps unscored entries last: they are absent data, not zero.
    expect(sortStudioModels(list, "intelligence-low-to-high").map((entry) => entry.id)).toEqual([
      "b/scored",
      "a/unscored"
    ]);
  });

  it("sorts newest first and oldest first by creation time", () => {
    const list: StudioModel[] = [
      makeModel({ id: "old", created: 100 }),
      makeModel({ id: "new", created: 900 }),
      makeModel({ id: "nodate", created: undefined })
    ];

    expect(sortStudioModels(list, "newest").map((entry) => entry.id)).toEqual(["new", "old", "nodate"]);
    expect(sortStudioModels(list, "oldest").map((entry) => entry.id)).toEqual(["old", "new", "nodate"]);
  });

  it("treats `~vendor/model-latest` alias routes as aliases", () => {
    expect(isAliasModel(makeModel({ id: "~openai/gpt-sol-latest" }))).toBe(true);
    expect(isAliasModel(makeModel({ id: "openai/gpt-sol" }))).toBe(false);
  });

  it("detects batch variants by id suffix and by name", () => {
    expect(isBatchVariant(makeModel({ id: "openai/gpt-sol:batch" }))).toBe(true);
    expect(isBatchVariant(makeModel({ id: "x/y", name: "OpenAI: GPT-6 Sol (batch)" }))).toBe(true);
    expect(isBatchVariant(makeModel({ id: "openai/gpt-sol" }))).toBe(false);
  });

  it("marks aliases and batch variants as duplicate routes, keeping real models", () => {
    expect(isDuplicateRoute(makeModel({ id: "~openai/gpt-sol-latest" }))).toBe(true);
    expect(isDuplicateRoute(makeModel({ id: "openai/gpt-sol:batch" }))).toBe(true);
    expect(isDuplicateRoute(makeModel({ id: "openai/gpt-sol" }))).toBe(false);
  });
});

function makeModel(overrides: Partial<StudioModel>): StudioModel {
  return {
    id: "publisher/model",
    name: "Model",
    author: "publisher",
    description: "",
    inputModalities: ["text"],
    outputModalities: ["text"],
    contextLength: 8_000,
    promptPrice: "0.000001",
    completionPrice: "0.000001",
    supportedParameters: [],
    textChatEligible: true,
    ...overrides
  };
}

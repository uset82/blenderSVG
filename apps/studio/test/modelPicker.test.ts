import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { filterModelsByBadges, groupCatalogModels, modelBadges, quickFilterConflict, quickFilterCounts } from "../src/components/modelPicker.js";
import { nextModelOptionIndex } from "../src/components/modelPickerNavigation.js";

function model(id: string, author: string, extra: Partial<StudioModel> = {}): StudioModel {
  return {
    id,
    name: id.split("/")[1] ?? id,
    author,
    description: "",
    inputModalities: ["text"],
    outputModalities: ["text"],
    contextLength: 128000,
    promptPrice: "0",
    completionPrice: "0",
    supportedParameters: [],
    textChatEligible: true,
    ...extra
  };
}

describe("model picker", () => {
  it("badges free, vision, tools, reasoning, and intelligence from catalog fields", () => {
    expect(
      modelBadges(
        model("openai/example", "openai", {
          inputModalities: ["text", "image"],
          supportedParameters: ["tools", "reasoning"],
          intelligence: 58.4
        })
      )
    ).toEqual(["Free", "Vision", "Tools", "Reasoning", "Intelligence"]);
  });

  it("puts favorites and recent models ahead of publisher groups", () => {
    const models = [model("a/one", "alpha"), model("b/two", "beta"), model("a/three", "alpha")];
    const groups = groupCatalogModels(models, ["b/two"], ["a/one"]);
    expect(groups.map((group) => group.label)).toEqual(["Favorites", "Recent", "alpha"]);
    expect(groups[0]?.models.map((entry) => entry.id)).toEqual(["b/two"]);
  });

  it("groups remaining models under a single ranked group when a non-default sortOrder is used", () => {
    const models = [
      model("anthropic/claude-3-5", "anthropic", { intelligence: 58.4 }),
      model("openai/gpt-4o", "openai", { intelligence: 56.1 })
    ];
    const groups = groupCatalogModels(models, [], [], "intelligence-high-to-low");
    expect(groups.map((group) => group.label)).toEqual(["Intelligence: High to Low"]);
    expect(groups[0]?.models.map((entry) => entry.id)).toEqual(["anthropic/claude-3-5", "openai/gpt-4o"]);
  });

  it("hides `~vendor/model-latest` alias routes so each model appears once", () => {
    const models = [
      model("openai/gpt-sol", "openai"),
      model("~openai/gpt-sol-latest", "openai"),
      model("anthropic/claude", "anthropic")
    ];
    const groups = groupCatalogModels(models, [], []);
    const ids = groups.flatMap((group) => group.models.map((entry) => entry.id));
    expect(ids).toEqual(["anthropic/claude", "openai/gpt-sol"]);
    expect(ids).not.toContain("~openai/gpt-sol-latest");
  });

  it("hides `:batch` variants so a model is not listed twice", () => {
    const models = [
      model("openai/gpt-sol", "openai"),
      model("openai/gpt-sol:batch", "openai"),
      model("anthropic/claude:batch", "anthropic")
    ];
    const groups = groupCatalogModels(models, [], []);
    const ids = groups.flatMap((group) => group.models.map((entry) => entry.id));
    expect(ids).toEqual(["openai/gpt-sol"]);
  });

  it("keeps an alias route visible when it is the selected favorite", () => {
    const models = [model("~openai/gpt-sol-latest", "openai"), model("openai/gpt-sol", "openai")];
    const groups = groupCatalogModels(models, ["~openai/gpt-sol-latest"], []);
    // Favorites resolve against the visible set, so an alias in storage does not
    // resurrect a duplicate row.
    expect(groups.map((group) => group.label)).toEqual(["openai"]);
    expect(groups[0]?.models.map((entry) => entry.id)).toEqual(["openai/gpt-sol"]);
  });

  it("applies quick filters together and returns all models when none are active", () => {
    const models = [
      model("free/vision-tools", "free", {
        inputModalities: ["text", "image"],
        supportedParameters: ["tools"]
      }),
      model("paid/tools", "paid", {
        promptPrice: "0.1",
        completionPrice: "0.2",
        supportedParameters: ["tools"]
      }),
      model("free/text", "free", { intelligence: 52.0 })
    ];

    expect(filterModelsByBadges(models, [])).toEqual(models);
    expect(filterModelsByBadges(models, ["free", "vision"])).toEqual([models[0]]);
    expect(filterModelsByBadges(models, ["tools"])).toEqual([models[0], models[1]]);
    expect(filterModelsByBadges(models, ["reasoning"])).toEqual([]);
    expect(filterModelsByBadges(models, ["intelligence"])).toEqual([models[2]]);
  });

  it("counts each quick filter on its own and the AND across the active ones", () => {
    const models = [
      model("free/vision", "free", { inputModalities: ["text", "image"], intelligence: 30 }),
      model("free/plain", "free", { intelligence: 20 }),
      model("paid/vision", "paid", {
        promptPrice: "0.1",
        completionPrice: "0.2",
        inputModalities: ["text", "image"]
      }),
      model("free/unscored", "free")
    ];

    const idle = quickFilterCounts(models, []);
    expect(idle.perFilter).toEqual({ free: 3, vision: 2, tools: 0, reasoning: 0, intelligence: 2 });
    expect(idle.combined).toBe(4);

    // Free AND Intelligence is the combination from the reported bug.
    const freeIntel = quickFilterCounts(models, ["free", "intelligence"]);
    expect(freeIntel.combined).toBe(2);
    expect(quickFilterConflict(freeIntel, ["free", "intelligence"])).toBe(false);
  });

  it("flags a filter pair that intersects to nothing only when each side matches alone", () => {
    const models = [
      model("free/one", "free", { intelligence: 30 }),
      model("paid/tools", "paid", { promptPrice: "0.1", completionPrice: "0.2", supportedParameters: ["tools"] })
    ];

    // Free (1) and Tools (1) both match, but never on the same model.
    const conflict = quickFilterCounts(models, ["free", "tools"]);
    expect(conflict.combined).toBe(0);
    expect(quickFilterConflict(conflict, ["free", "tools"])).toBe(true);

    // A genuinely empty filter is not a conflict — it is just empty.
    const empty = quickFilterCounts(models, ["reasoning"]);
    expect(empty.perFilter.reasoning).toBe(0);
    expect(quickFilterConflict(empty, ["reasoning"])).toBe(false);

    // A single active filter is never reported as a conflict.
    const single = quickFilterCounts(models, ["free"]);
    expect(quickFilterConflict(single, ["free"])).toBe(false);
  });

  it("moves model focus with arrows and Home/End without skipping the first option", () => {
    expect(nextModelOptionIndex("ArrowDown", -1, 4)).toBe(0);
    expect(nextModelOptionIndex("ArrowUp", -1, 4)).toBe(3);
    expect(nextModelOptionIndex("ArrowDown", 1, 4)).toBe(2);
    expect(nextModelOptionIndex("ArrowUp", 2, 4)).toBe(1);
    expect(nextModelOptionIndex("ArrowUp", 0, 4)).toBe(0);
    expect(nextModelOptionIndex("ArrowDown", 3, 4)).toBe(3);
    expect(nextModelOptionIndex("Home", 2, 4)).toBe(0);
    expect(nextModelOptionIndex("End", 1, 4)).toBe(3);
    expect(nextModelOptionIndex("ArrowDown", -1, 0)).toBeNull();
  });
});

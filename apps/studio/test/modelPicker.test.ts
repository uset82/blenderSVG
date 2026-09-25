import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { filterModelsByBadges, groupCatalogModels, modelBadges } from "../src/components/modelPicker.js";
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

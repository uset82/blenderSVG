import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { filterModelsByBadges, groupCatalogModels, modelBadges } from "../src/components/modelPicker.js";

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
  it("badges free, vision, tools, and reasoning from catalog fields", () => {
    expect(
      modelBadges(
        model("openai/example", "openai", {
          inputModalities: ["text", "image"],
          supportedParameters: ["tools", "reasoning"]
        })
      )
    ).toEqual(["Free", "Vision", "Tools", "Reasoning"]);
  });

  it("puts favorites and recent models ahead of publisher groups", () => {
    const models = [model("a/one", "alpha"), model("b/two", "beta"), model("a/three", "alpha")];
    const groups = groupCatalogModels(models, ["b/two"], ["a/one"]);
    expect(groups.map((group) => group.label)).toEqual(["Favorites", "Recent", "alpha"]);
    expect(groups[0]?.models.map((entry) => entry.id)).toEqual(["b/two"]);
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
      model("free/text", "free")
    ];

    expect(filterModelsByBadges(models, [])).toEqual(models);
    expect(filterModelsByBadges(models, ["free", "vision"])).toEqual([models[0]]);
    expect(filterModelsByBadges(models, ["tools"])).toEqual([models[0], models[1]]);
    expect(filterModelsByBadges(models, ["reasoning"])).toEqual([]);
  });
});

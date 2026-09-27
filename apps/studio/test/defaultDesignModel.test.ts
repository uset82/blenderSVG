import type { StudioModel } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { pickDefaultDesignModel, pickFreeDesignModel } from "../src/components/defaultDesignModel.js";

function model(id: string, overrides: Partial<StudioModel> = {}): StudioModel {
  return {
    id,
    name: id,
    author: id.split("/")[0] ?? "",
    description: "",
    inputModalities: ["text"],
    outputModalities: ["text"],
    contextLength: 200_000,
    promptPrice: "0.000003",
    completionPrice: "0.000015",
    supportedParameters: ["tools", "max_tokens"],
    textChatEligible: true,
    ...overrides
  };
}

describe("default design model", () => {
  const catalog = [
    model("stealth/no-tools", { supportedParameters: ["max_tokens"], designArenaElo: 1500 }),
    model("a/coder", { codingIndex: 60 }),
    model("b/designer", { designArenaElo: 1320, codingIndex: 40 }),
    model("c/free", { designArenaElo: 1100, promptPrice: "0", completionPrice: "0" }),
    model("d/image", { outputModalities: ["image"], textChatEligible: false, designArenaElo: 1600 })
  ];

  it("picks the strongest tool-capable model for design", () => {
    expect(pickDefaultDesignModel(catalog)?.id).toBe("b/designer");
    expect(pickDefaultDesignModel(catalog.filter((item) => item.id !== "b/designer" && item.id !== "c/free"))?.id).toBe(
      "a/coder"
    );
  });

  it("falls back to a text model without tools, and offers a free designer", () => {
    expect(pickDefaultDesignModel([catalog[0] as StudioModel])?.id).toBe("stealth/no-tools");
    expect(pickFreeDesignModel(catalog)?.id).toBe("c/free");
    expect(pickDefaultDesignModel([])).toBeUndefined();
  });
});

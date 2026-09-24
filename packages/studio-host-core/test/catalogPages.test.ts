import { describe, expect, it } from "vitest";
import { nextOpenRouterCatalogUrl } from "../src/openRouterChat.js";

describe("OpenRouter catalog pages", () => {
  it("follows only another OpenRouter models page", () => {
    expect(nextOpenRouterCatalogUrl({ next: "https://openrouter.ai/api/v1/models?output_modalities=all&page=2" })).toBe(
      "https://openrouter.ai/api/v1/models?output_modalities=all&page=2"
    );
    expect(nextOpenRouterCatalogUrl({ next: "https://evil.test/api/v1/models" })).toBeNull();
    expect(nextOpenRouterCatalogUrl({})).toBeNull();
  });
});

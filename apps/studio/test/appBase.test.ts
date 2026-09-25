import { describe, expect, it } from "vitest";
import { appBasePath, appPath } from "../src/web/appBase.js";

describe("web app base path", () => {
  it("keeps root-hosted paths unchanged", () => {
    expect(appBasePath("/")).toBe("/");
    expect(appBasePath("./")).toBe("/");
    expect(appPath("/oauth/openrouter", "/")).toBe("/oauth/openrouter");
  });

  it("prefixes paths when the app is served under /app/", () => {
    expect(appBasePath("/app/")).toBe("/app/");
    expect(appBasePath("/app")).toBe("/app/");
    expect(appPath("/oauth/openrouter", "/app/")).toBe("/app/oauth/openrouter");
    expect(appPath("#/p/123", "/app/")).toBe("/app/#/p/123");
  });
});

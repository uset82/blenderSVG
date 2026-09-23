import { describe, expect, it } from "vitest";
import { formatStudioHash, parseStudioHash } from "../src/router/studioRoute.js";

describe("studio hash routes", () => {
  it("maps the home, project, connectors, settings, and gallery addresses", () => {
    expect(parseStudioHash("")).toEqual({ name: "home" });
    expect(parseStudioHash("#/")).toEqual({ name: "home" });
    expect(parseStudioHash("#/p/project-1")).toEqual({ name: "project", projectId: "project-1" });
    expect(parseStudioHash("#/p/a%20b")).toEqual({ name: "project", projectId: "a b" });
    expect(parseStudioHash("#/connectors")).toEqual({ name: "connectors" });
    expect(parseStudioHash("#/settings")).toEqual({ name: "settings" });
    expect(parseStudioHash("#/gallery")).toEqual({ name: "gallery" });
  });

  it("keeps unknown addresses from being treated as projects", () => {
    expect(parseStudioHash("#/missing")).toEqual({ name: "unknown", hash: "#/missing" });
    expect(parseStudioHash("#/p/")).toEqual({ name: "unknown", hash: "#/p/" });
    expect(parseStudioHash("#/p/a/b")).toEqual({ name: "unknown", hash: "#/p/a/b" });
    expect(parseStudioHash("#/p/a%2Fb")).toEqual({ name: "unknown", hash: "#/p/a%2Fb" });
    expect(parseStudioHash("#/p/%zz")).toEqual({ name: "unknown", hash: "#/p/%zz" });
  });

  it("round-trips every named route", () => {
    const routes = [
      { name: "home" },
      { name: "project", projectId: "draft 1" },
      { name: "project", projectId: "åland" },
      { name: "connectors" },
      { name: "settings" },
      { name: "gallery" }
    ] as const;
    for (const route of routes) {
      expect(parseStudioHash(formatStudioHash(route))).toEqual(route);
    }
  });
});

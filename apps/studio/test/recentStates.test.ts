import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  RecentEmptyState,
  RecentLoadingCards,
  RecentProjectNotice,
  recentListMode
} from "../src/components/recentStates.js";

describe("recent list states", () => {
  it("chooses loading, empty, and damaged-file states without hiding a recovered list", () => {
    expect(
      recentListMode({
        projectMode: true,
        projectStatus: "loading",
        visibleProjects: 0,
        visibleCanvases: 0,
        corruptCount: 0
      })
    ).toBe("loading");
    expect(
      recentListMode({
        projectMode: true,
        projectStatus: "ready",
        visibleProjects: 0,
        visibleCanvases: 0,
        corruptCount: 0
      })
    ).toBe("empty");
    expect(
      recentListMode({
        projectMode: false,
        projectStatus: "idle",
        visibleProjects: 0,
        visibleCanvases: 0,
        corruptCount: 0
      })
    ).toBe("empty");
    expect(
      recentListMode({
        projectMode: true,
        projectStatus: "ready",
        visibleProjects: 0,
        visibleCanvases: 0,
        corruptCount: 2
      })
    ).toBe("unavailable");
    expect(
      recentListMode({
        projectMode: true,
        projectStatus: "ready",
        visibleProjects: 1,
        visibleCanvases: 0,
        corruptCount: 2
      })
    ).toBe("projects");
  });

  it("renders the corrupt count, details, loading cards, and empty search", () => {
    const alert = renderToStaticMarkup(
      createElement(RecentProjectNotice, {
        projectMode: true,
        projectStatus: "ready",
        corruptCount: 2,
        projectMessage: "2 damaged project files were left in place for recovery. a.json, b.json.",
        onRetry: () => undefined
      })
    );
    expect(alert).toContain("2 project files need attention");
    expect(alert).toContain("Details");
    expect(alert).toContain("a.json, b.json");
    expect(alert).toContain("Try again");

    const loading = renderToStaticMarkup(createElement(RecentLoadingCards));
    expect(loading.match(/recents__skeleton/g)).toHaveLength(4);
    expect(loading).toContain("Loading workspace projects");

    const empty = renderToStaticMarkup(
      createElement(RecentEmptyState, {
        query: "missing",
        projectMode: false,
        onClearSearch: () => undefined,
        onNewCanvas: () => undefined
      })
    );
    expect(empty).toContain("No matches found");
    expect(empty).toContain("Clear search");
  });
});

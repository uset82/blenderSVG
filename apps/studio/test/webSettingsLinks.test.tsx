/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentsDashboard } from "../src/components/RecentsDashboard.js";
import { StudioRouteNotice } from "../src/routes/StudioRoutePages.js";
import { DesktopOnlyNotice } from "../src/web/DesktopOnlyNotice.js";
import { KURVA_DESKTOP_APP_URL } from "../src/web/studioCapabilities.js";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function webSettings(): string {
  return renderToStaticMarkup(
    <StudioRouteNotice
      route={{ name: "settings" }}
      theme="light"
      onHome={vi.fn()}
      onConnectors={vi.fn()}
      onSettings={vi.fn()}
      onTheme={vi.fn()}
      onRefreshCatalog={vi.fn()}
      catalogStatus=""
      launchToken={null}
      host="web"
    />
  );
}

describe("web settings links", () => {
  it("links the privacy and notices pages under the app base", () => {
    vi.stubEnv("BASE_URL", "/app/");
    const html = webSettings();
    expect(html).toContain('href="/app/privacy.html"');
    expect(html).toContain('href="/app/notices.html"');
    expect(html).not.toContain('href="/privacy.html"');
  });

  it("sends every desktop-app link to the install steps, not the empty releases page", () => {
    expect(KURVA_DESKTOP_APP_URL).toBe("https://kurva.agency/#try");
    expect(webSettings()).not.toContain("/releases");
    expect(renderToStaticMarkup(<DesktopOnlyNotice feature="Blender" />)).toContain(`href="${KURVA_DESKTOP_APP_URL}"`);
  });
});

describe("home search", () => {
  function dashboard(props: { companion?: React.ReactNode; onNavigate?: (route: "home") => void }) {
    return (
      <RecentsDashboard
        isOpen
        canvases={[]}
        currentCanvasId={null}
        projects={[]}
        projectMode
        projectStatus="ready"
        projectMessage=""
        activeProjectId={null}
        onClose={vi.fn()}
        onOpenCanvas={vi.fn()}
        onOpenProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onRefreshProjects={vi.fn()}
        onNewCanvas={vi.fn()}
        onNavigate={props.onNavigate}
        companion={props.companion}
      />
    );
  }

  it("Ctrl+K focuses the search field on Home", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(dashboard({ onNavigate: vi.fn() }));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search projects"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("Search on Connectors returns Home and focuses the search field", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onNavigate = vi.fn();
    const view = render(dashboard({ onNavigate, companion: <p>Connectors</p> }));
    expect(screen.queryByPlaceholderText("Search projects")).toBeNull();

    fireEvent.click(screen.getByTitle("Search (Ctrl+K)"));
    expect(onNavigate).toHaveBeenCalledWith("home");

    act(() => view.rerender(dashboard({ onNavigate })));
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search projects"));
  });
});

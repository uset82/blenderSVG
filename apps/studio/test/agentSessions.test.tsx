import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sessionPillStatus, stopRunningReply } from "../src/components/agentSessions.js";
import { StudioWindowBar } from "../src/components/StudioWindowBar.js";

describe("agent session pill", () => {
  it("marks only the active chat as running or finished", () => {
    expect(sessionPillStatus(true, "streaming")).toBe("running");
    expect(sessionPillStatus(true, "stopping")).toBe("running");
    expect(sessionPillStatus(true, "complete")).toBe("finished");
    expect(sessionPillStatus(false, "streaming")).toBe("idle");
    expect(sessionPillStatus(true, null)).toBe("idle");
  });

  it("shows Stop for a running session and cancels that reply", () => {
    const cancelled: string[] = [];
    expect(stopRunningReply("streaming", (id) => cancelled.push(id), "chat-1")).toBe(true);
    expect(stopRunningReply("complete", (id) => cancelled.push(id), "chat-1")).toBe(false);
    expect(cancelled).toEqual(["chat-1"]);
    const html = renderToStaticMarkup(
      <StudioWindowBar
        projectTitle="Untitled"
        saveStatus="Saved"
        theme="light"
        onCycleTheme={() => undefined}
        onTitleChange={() => undefined}
        onOpenFile={() => undefined}
        onDuplicate={() => undefined}
        onExport={() => undefined}
        onDelete={() => undefined}
        canDelete={false}
        onRetrySave={() => undefined}
        isHome={false}
        onShowHome={() => undefined}
        isAgentSidebarOpen={false}
        onToggleAgentSidebar={() => undefined}
        isInspectorOpen={false}
        onToggleInspector={() => undefined}
        canPresent={false}
        onPresent={() => undefined}
        zoomLevel={1}
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
        onZoomCommand={() => undefined}
        canZoomSelection={false}
        canManageConnection={false}
        connected={false}
        onConnectionAction={() => undefined}
        agentSessions={[{ id: "session-1", title: "Library desk", status: "running" }]}
        onStopAgent={() => undefined}
      />
    );
    expect(html).toContain("Library desk");
    expect(html).toContain("running");
    expect(html).toContain("Stop");
  });
});

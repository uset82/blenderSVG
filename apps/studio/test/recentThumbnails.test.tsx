import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { projectThumbnailSource, RecentsDashboard } from "../src/components/RecentsDashboard.js";

const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";

describe("recent project thumbnails", () => {
  it("loads the authenticated host thumbnail and retains the local preview as fallback", () => {
    const html = renderToStaticMarkup(
      <RecentsDashboard
        isOpen
        canvases={[]}
        currentCanvasId={null}
        projects={[
          {
            id: projectId,
            title: "First canvas",
            createdAt: "2026-09-24T10:00:00.000Z",
            updatedAt: "2026-09-24T10:05:00.000Z"
          }
        ]}
        projectMode
        projectStatus="ready"
        projectMessage=""
        activeProjectId={null}
        hostProjectThumbnails
        hostThumbnailVersions={{ [projectId]: 3 }}
        thumbnailUrls={{ [projectId]: "data:image/jpeg;base64,ZmFsbGJhY2s=" }}
        onClose={vi.fn()}
        onOpenCanvas={vi.fn()}
        onOpenProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onRefreshProjects={vi.fn()}
        onNewCanvas={vi.fn()}
      />
    );

    expect(html).toContain(`/api/projects/${projectId}/thumbnail?v=3`);
    expect(
      projectThumbnailSource(`/api/projects/${projectId}/thumbnail?v=3`, "data:image/jpeg;base64,ZmFsbGJhY2s=", true)
    ).toBe("data:image/jpeg;base64,ZmFsbGJhY2s=");
  });
});

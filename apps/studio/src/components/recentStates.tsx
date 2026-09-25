import { FolderOpen, Plus } from "lucide-react";

export type RecentListMode = "loading" | "projects" | "canvases" | "empty" | "unavailable";

export function recentListMode(input: {
  projectMode: boolean;
  projectStatus: "idle" | "loading" | "ready" | "error";
  visibleProjects: number;
  visibleCanvases: number;
  corruptCount: number;
}): RecentListMode {
  if (input.projectMode && input.projectStatus === "loading") return "loading";
  if (input.projectMode && input.visibleProjects > 0) return "projects";
  if (!input.projectMode && input.visibleCanvases > 0) return "canvases";
  if (input.projectMode && (input.projectStatus === "error" || input.corruptCount > 0)) return "unavailable";
  return "empty";
}

export function recentProjectAlertTitle(corruptCount: number): string {
  if (corruptCount === 1) return "1 project file needs attention";
  if (corruptCount > 1) return `${corruptCount} project files need attention`;
  return "Could not load projects";
}

export function RecentProjectNotice({
  projectMode,
  projectStatus,
  corruptCount,
  projectMessage,
  onRetry
}: {
  projectMode: boolean;
  projectStatus: "idle" | "loading" | "ready" | "error";
  corruptCount: number;
  projectMessage: string;
  onRetry: () => void;
}) {
  if (!projectMode || (projectStatus !== "error" && corruptCount <= 0)) return null;
  return (
    <div className="recents__notice recents__notice--error" role="alert">
      <strong>{recentProjectAlertTitle(corruptCount)}</strong>
      <p>Existing files were left in place so they can be recovered.</p>
      {projectMessage && (
        <details>
          <summary>Details</summary>
          <p>{projectMessage}</p>
        </details>
      )}
      <button className="recents__notice-retry" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function RecentLoadingCards() {
  return (
    <div className="recents__canvases recents__canvases--grid" role="status" aria-label="Loading workspace projects">
      {[0, 1, 2, 3].map((index) => (
        <div className="recents__skeleton" key={index} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
      <span className="sr-only">Loading workspace projects…</span>
    </div>
  );
}

export function RecentEmptyState({
  query,
  projectMode,
  onClearSearch,
  onNewCanvas
}: {
  query: string;
  projectMode: boolean;
  onClearSearch: () => void;
  onNewCanvas: () => void;
}) {
  return (
    <div className="recents__empty" role="status">
      <span className="recents__empty-mark" aria-hidden="true">
        <FolderOpen size={24} strokeWidth={1.5} />
      </span>
      <h3>{query ? "No matches found" : projectMode ? "No projects yet" : "No canvases yet"}</h3>
      <p>{query ? "Try another name or clear the search." : "Create a file to start designing."}</p>
      {query ? (
        <button className="recents__button recents__button--quiet" type="button" onClick={onClearSearch}>
          Clear search
        </button>
      ) : (
        <button className="recents__button recents__button--primary" type="button" onClick={onNewCanvas}>
          <Plus size={16} aria-hidden="true" /> New file
        </button>
      )}
    </div>
  );
}

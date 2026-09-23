import { LayoutGrid, Minus, PanelRight, Plus, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";
import brandMarkUrl from "../assets/brand-mark.svg?inline";

export interface StudioWindowBarProps {
  projectTitle: string;
  saveStatus: string;
  theme: "dark" | "light" | "contrast";
  onCycleTheme: () => void;
  onTitleChange: (title: string) => void;
  isHome: boolean;
  onShowHome: () => void;
  isAgentSidebarOpen: boolean;
  onToggleAgentSidebar: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function StudioWindowBar({
  projectTitle,
  saveStatus,
  theme,
  onCycleTheme,
  onTitleChange,
  isHome,
  onShowHome,
  isAgentSidebarOpen,
  onToggleAgentSidebar,
  isInspectorOpen,
  onToggleInspector,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset
}: StudioWindowBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);

  useEffect(() => {
    if (!isEditingTitle) setTitleInput(projectTitle);
  }, [isEditingTitle, projectTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) onTitleChange(titleInput.trim());
    else setTitleInput(projectTitle);
  };

  return (
    <header className="studio-windowbar">
      <div className="studio-windowbar__left">
        <button
          className="studio-windowbar__recents studio-windowbar__control"
          type="button"
          onClick={onShowHome}
          title="Home"
          aria-label="Home"
          aria-pressed={isHome}
        >
          <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="studio-windowbar__project">
          <span className="studio-windowbar__brand">
            <img className="studio-windowbar__brand-mark" src={brandMarkUrl} alt="" aria-hidden="true" />
            blenderSVG Studio
          </span>
          <span className="studio-windowbar__separator">/</span>

          {isEditingTitle ? (
            <input
              className="studio-windowbar__title-input"
              type="text"
              value={titleInput}
              autoFocus
              onChange={(event) => setTitleInput(event.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(event) => event.key === "Enter" && handleTitleSubmit()}
            />
          ) : (
            <button
              className="studio-windowbar__rename"
              type="button"
              aria-label="Rename current canvas"
              onClick={() => setIsEditingTitle(true)}
            >
              <span className="studio-windowbar__title">{projectTitle}</span>
              <span className="studio-windowbar__unsaved" role="status">
                — {saveStatus}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="studio-windowbar__actions">
        <button
          className="studio-windowbar__panel-toggle studio-windowbar__control"
          type="button"
          aria-pressed={isAgentSidebarOpen}
          aria-label={isAgentSidebarOpen ? "Close AI setup" : "Open AI setup"}
          onClick={onToggleAgentSidebar}
        >
          <span className="studio-windowbar__status-dot" aria-hidden="true" />
          <span className="studio-windowbar__action-label">AI setup</span>
        </button>

        <button
          className="studio-windowbar__panel-toggle studio-windowbar__control"
          type="button"
          aria-pressed={isInspectorOpen}
          aria-label={isInspectorOpen ? "Close inspector" : "Open inspector"}
          onClick={onToggleInspector}
        >
          <span className="studio-windowbar__inspector-icon" aria-hidden="true">
            <PanelRight size={15} strokeWidth={1.75} />
          </span>
          <span className="studio-windowbar__inspector-label">Inspector</span>
        </button>

        <button
          className="studio-windowbar__theme studio-windowbar__control"
          type="button"
          aria-label={`Change theme, current theme ${theme}`}
          title={`Theme: ${theme}`}
          onClick={onCycleTheme}
        >
          <SunMoon size={17} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">Theme: {theme}</span>
        </button>

        <div className="studio-windowbar__zoom">
          <button type="button" aria-label="Zoom out" onClick={onZoomOut}>
            <Minus size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            className="studio-windowbar__zoom-level"
            type="button"
            aria-label="Reset zoom to 100%"
            onClick={onZoomReset}
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={onZoomIn}>
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

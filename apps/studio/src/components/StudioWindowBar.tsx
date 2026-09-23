import {
  Bot,
  Copy,
  Download,
  FolderOpen,
  House,
  Minus,
  MoreHorizontal,
  PanelRight,
  Play,
  Plus,
  Settings,
  Trash2
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import brandMarkUrl from "../assets/brand-mark.svg?inline";
import { formatEditorSaveStatus } from "../projects/exportProjectFile.js";

export interface StudioWindowBarProps {
  projectTitle: string;
  saveStatus: string;
  theme: "dark" | "light" | "contrast";
  onCycleTheme: () => void;
  onTitleChange: (title: string) => void;
  onOpenFile: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  canDelete: boolean;
  onRetrySave: () => void;
  isHome: boolean;
  onShowHome: () => void;
  isAgentSidebarOpen: boolean;
  onToggleAgentSidebar: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  canPresent: boolean;
  onPresent: () => void;
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
  onOpenFile,
  onDuplicate,
  onExport,
  onDelete,
  canDelete,
  onRetrySave,
  isHome,
  onShowHome,
  isAgentSidebarOpen,
  onToggleAgentSidebar,
  isInspectorOpen,
  onToggleInspector,
  canPresent,
  onPresent,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset
}: StudioWindowBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingTitle) setTitleInput(projectTitle);
  }, [isEditingTitle, projectTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) onTitleChange(titleInput.trim());
    else setTitleInput(projectTitle);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleTitleSubmit();
    if (event.key === "Escape") {
      setTitleInput(projectTitle);
      setIsEditingTitle(false);
    }
  };

  const displayedSaveStatus = formatEditorSaveStatus(saveStatus);

  const runMenuAction = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  const themeLabel = theme === "contrast" ? "High contrast" : theme === "light" ? "Light" : "Dark";

  return (
    <>
      <header className="studio-windowbar">
        <div className="studio-windowbar__left">
          <button
            className="studio-windowbar__brand studio-windowbar__brand-button"
            type="button"
            onClick={onShowHome}
            aria-label="Home"
            title="Home"
          >
            <img className="studio-windowbar__brand-mark" src={brandMarkUrl} alt="" aria-hidden="true" />
          </button>
          <button
            className="studio-windowbar__recents studio-windowbar__control"
            type="button"
            onClick={onShowHome}
            title="Home"
            aria-label="All files"
            aria-pressed={isHome}
          >
            <House size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            className="studio-windowbar__control studio-windowbar__open"
            type="button"
            onClick={onOpenFile}
            title="Open project file"
            aria-label="Open project file"
          >
            <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="studio-windowbar__separator" aria-hidden="true" />

          <div className="studio-windowbar__project">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                className="studio-windowbar__title-input"
                type="text"
                aria-label="Canvas title"
                value={titleInput}
                onChange={(event) => setTitleInput(event.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
              />
            ) : (
              <button
                className="studio-windowbar__rename"
                type="button"
                aria-label="Rename current canvas"
                onClick={() => setIsEditingTitle(true)}
              >
                <span className="studio-windowbar__title">{projectTitle}</span>
              </button>
            )}
            {displayedSaveStatus.retry ? (
              <button className="studio-windowbar__retry" type="button" onClick={onRetrySave}>
                Save failed – Retry
              </button>
            ) : (
              <span className="studio-windowbar__unsaved" role="status">
                — {displayedSaveStatus.label}
              </span>
            )}
            <details
              className="studio-windowbar__menu"
              open={isMenuOpen}
              onToggle={(event) => setIsMenuOpen(event.currentTarget.open)}
            >
              <summary className="studio-windowbar__control" aria-label="Canvas actions" title="Canvas actions">
                <MoreHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
              </summary>
              <div className="studio-windowbar__menu-popover">
                <button type="button" onClick={() => runMenuAction(() => setIsEditingTitle(true))}>
                  Rename
                </button>
                <button type="button" onClick={() => runMenuAction(onDuplicate)}>
                  <Copy size={14} aria-hidden="true" /> Duplicate
                </button>
                <button type="button" onClick={() => runMenuAction(onExport)}>
                  <Download size={14} aria-hidden="true" /> Export…
                </button>
                <div className="studio-windowbar__menu-divider" />
                <button
                  className="studio-windowbar__menu-delete"
                  type="button"
                  disabled={!canDelete}
                  title={canDelete ? "Delete this canvas" : "Scratchpad or the last canvas cannot be deleted"}
                  onClick={() => runMenuAction(onDelete)}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete…
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="studio-windowbar__actions">
          <details className="studio-windowbar__menu">
            <summary className="studio-windowbar__control studio-windowbar__labeled" aria-label="Agents">
              <Bot size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>Agents</span>
            </summary>
            <div className="studio-windowbar__menu-popover">
              <p className="studio-windowbar__menu-note">
                This editor keeps one conversation. It does not store other agent sessions.
              </p>
              <button type="button" onClick={onToggleAgentSidebar}>
                {isAgentSidebarOpen ? "Close conversation" : "Open conversation"}
              </button>
            </div>
          </details>
          <button className="studio-windowbar__control studio-windowbar__labeled" type="button" onClick={onExport}>
            <Download size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>Export</span>
          </button>
          <span className="studio-windowbar__separator" aria-hidden="true" />
          <details className="studio-windowbar__menu">
            <summary className="studio-windowbar__control" aria-label="Settings" title="Settings">
              <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="studio-windowbar__menu-popover">
              <p className="studio-windowbar__menu-note">
                Theme is {themeLabel}. API keys stay in the host and are not edited here.
              </p>
              <button type="button" onClick={onCycleTheme}>
                Use the next theme
              </button>
              <button type="button" onClick={onToggleInspector}>
                <PanelRight size={14} aria-hidden="true" />
                {isInspectorOpen ? "Hide properties" : "Show properties"}
              </button>
            </div>
          </details>
          <button
            className="studio-windowbar__control"
            type="button"
            aria-label="Present selected frame"
            title={canPresent ? "Present the selected frame" : "Select a frame to present it"}
            disabled={!canPresent}
            onClick={onPresent}
          >
            <Play size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="studio-zoom-cluster">
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
    </>
  );
}

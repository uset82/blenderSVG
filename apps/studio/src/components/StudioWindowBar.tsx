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
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { formatEditorSaveStatus } from "../projects/exportProjectFile.js";
import { DESKTOP_ONLY_REASON, KURVA_DESKTOP_APP_URL } from "../web/studioCapabilities.js";
import { BrandMark } from "./BrandMark.js";
import { type ZoomCommand, zoomMenuItems } from "./zoomMenu.js";

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
  onZoomCommand: (command: ZoomCommand) => void;
  canZoomSelection: boolean;
  canManageConnection: boolean;
  browserConnection?: boolean;
  rememberOpenRouter?: boolean;
  onRememberOpenRouter?: (remember: boolean) => void;
  openRouterRevoke?: { settingsUrl: string; activityUrl: string } | null;
  connected: boolean;
  onConnectionAction: (action: "connect" | "replace" | "test" | "disconnect") => void;
  onSaveHostKey?: (key: string) => void;
  showBlenderActions?: boolean;
  canSendToBlender?: boolean;
  onSendToBlender?: () => string;
  onBlenderAssets?: (result: { sceneFile: string; pngSrc: string; glbSrc: string }) => void;
  agentSessions?: Array<{ id: string; title: string; status: "running" | "finished" | "idle" }>;
  onStopAgent?: () => void;
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
  onZoomCommand,
  canZoomSelection,
  canManageConnection,
  browserConnection = false,
  rememberOpenRouter = true,
  onRememberOpenRouter,
  openRouterRevoke = null,
  connected,
  onConnectionAction,
  onSaveHostKey,
  showBlenderActions = true,
  canSendToBlender = false,
  onSendToBlender,
  onBlenderAssets,
  agentSessions = [],
  onStopAgent
}: StudioWindowBarProps) {
  const [blenderStatus, setBlenderStatus] = useState("Blender has not been checked.");
  const [titleInput, setTitleInput] = useState(projectTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isZoomMenuOpen, setZoomMenuOpen] = useState(false);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']")) return;
      if (event.code === "Digit1") {
        event.preventDefault();
        onZoomCommand("fit");
      } else if (event.code === "Digit2") {
        event.preventDefault();
        onZoomCommand("selection");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onZoomCommand]);

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

  const closePopover = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
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
            <BrandMark className="studio-windowbar__brand-mark" />
          </button>
          <button
            className="studio-windowbar__recents studio-windowbar__control studio-windowbar__desktop-only"
            type="button"
            onClick={onShowHome}
            title="Home"
            aria-label="All files"
            aria-pressed={isHome}
          >
            <House size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            className="studio-windowbar__control studio-windowbar__open studio-windowbar__desktop-only"
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
                <span className="studio-windowbar__status-dash" aria-hidden="true">
                  —{" "}
                </span>
                {displayedSaveStatus.label}
              </span>
            )}
            {displayedSaveStatus.exportBackup ? (
              <button
                className="studio-windowbar__retry"
                type="button"
                onClick={() => {
                  void import("../web/browserBackup.js")
                    .then((backup) => backup.downloadBrowserBackup())
                    .catch(() => undefined);
                }}
              >
                Export backup
              </button>
            ) : null}
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
          <details className="studio-windowbar__menu studio-windowbar__desktop-only">
            <summary className="studio-windowbar__control studio-windowbar__labeled" aria-label="Agents">
              <Bot size={15} strokeWidth={1.75} aria-hidden="true" />
              <span className="studio-windowbar__action-label">Agents</span>
              {agentSessions.some((session) => session.status !== "idle") ? (
                <span className="studio-windowbar__count">
                  {agentSessions.filter((session) => session.status !== "idle").length}
                </span>
              ) : null}
            </summary>
            <div className="studio-windowbar__menu-popover">
              <p className="studio-windowbar__menu-note">
                {agentSessions.length === 0
                  ? "No agent sessions in this editor yet."
                  : "Sessions in this editor. Stop only cancels a running reply."}
              </p>
              <ul>
                {agentSessions.map((session) => (
                  <li key={session.id}>
                    {session.title} · {session.status}
                    {session.status === "running" ? (
                      <button type="button" onClick={() => onStopAgent?.()}>
                        Stop
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={(event) => {
                  closePopover(event);
                  onToggleAgentSidebar();
                }}
              >
                {isAgentSidebarOpen ? "Close conversation" : "Open conversation"}
              </button>
            </div>
          </details>
          <button
            className="studio-windowbar__control studio-windowbar__labeled"
            type="button"
            aria-label="Export"
            onClick={onExport}
          >
            <Download size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="studio-windowbar__action-label">Export</span>
          </button>
          <span className="studio-windowbar__separator" aria-hidden="true" />
          <details className="studio-windowbar__menu studio-windowbar__menu--settings studio-windowbar__desktop-only">
            <summary className="studio-windowbar__control" aria-label="Settings" title="Settings">
              <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="studio-windowbar__menu-popover">
              <p className="studio-windowbar__menu-note">
                {browserConnection
                  ? "Connect sends you to OpenRouter. The key stays in this browser and is sent only to OpenRouter. Kurva has no server."
                  : "The key is sent once to this computer and is not kept in the page."}
              </p>
              {browserConnection ? (
                <label>
                  <input
                    type="checkbox"
                    checked={rememberOpenRouter}
                    onChange={(event) => onRememberOpenRouter?.(event.target.checked)}
                  />
                  Remember on this device
                </label>
              ) : null}
              {onSaveHostKey && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem("openrouter-key");
                    if (!(input instanceof HTMLInputElement)) return;
                    const key = input.value;
                    input.value = "";
                    onSaveHostKey(key);
                  }}
                >
                  <label>
                    OpenRouter key
                    <input name="openrouter-key" type="password" autoComplete="off" aria-label="OpenRouter key" />
                  </label>
                  <button type="submit">Save key on this computer</button>
                </form>
              )}
              <p className="studio-windowbar__menu-status">
                Key label: {connected ? "configured" : "not configured"}. The key is not shown. Credit usage was not
                returned by the host.
              </p>
              <button
                type="button"
                disabled={!canManageConnection || connected}
                onClick={() => onConnectionAction("connect")}
              >
                Connect
              </button>
              <button
                type="button"
                disabled={!canManageConnection || !connected}
                onClick={() => onConnectionAction("test")}
              >
                Test
              </button>
              <button
                type="button"
                disabled={!canManageConnection || !connected}
                onClick={() => onConnectionAction("replace")}
              >
                Replace
              </button>
              <button
                type="button"
                disabled={!canManageConnection || !connected}
                onClick={() => onConnectionAction("disconnect")}
              >
                Disconnect
              </button>
              {openRouterRevoke ? (
                <p className="studio-windowbar__menu-note">
                  The key was removed from this browser. Revoke it on OpenRouter if you no longer want it:{" "}
                  <a href={openRouterRevoke.settingsUrl} rel="noreferrer" target="_blank">
                    key settings
                  </a>{" "}
                  and{" "}
                  <a href={openRouterRevoke.activityUrl} rel="noreferrer" target="_blank">
                    activity
                  </a>
                  .
                </p>
              ) : null}
              {showBlenderActions ? (
                <>
                  <p className="studio-windowbar__menu-status" role="status">
                    {blenderStatus}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void fetch("/api/blender", { credentials: "same-origin" })
                        .then((response) => response.json())
                        .then((body: { message?: string }) =>
                          setBlenderStatus(body.message ?? "Blender could not be checked.")
                        )
                        .catch(() => setBlenderStatus("Blender could not be checked. No scene file was changed."));
                    }}
                  >
                    Check Blender
                  </button>
                  <button
                    type="button"
                    disabled={!canSendToBlender}
                    onClick={() => {
                      const svg = onSendToBlender?.() ?? "";
                      void fetch("/api/blender", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ svg, sourceName: "selection.svg" })
                      })
                        .then(async (response) => ({
                          ok: response.ok,
                          body: (await response.json()) as {
                            message?: string;
                            sent?: boolean;
                            sceneFile?: string;
                            pngSrc?: string;
                            glbSrc?: string;
                          }
                        }))
                        .then(({ ok, body }) => {
                          setBlenderStatus(
                            body.message ?? (ok ? "SVG sent to a new Blender copy." : "Send to Blender failed.")
                          );
                          if (body.sent && body.sceneFile && body.pngSrc && body.glbSrc) {
                            onBlenderAssets?.({ sceneFile: body.sceneFile, pngSrc: body.pngSrc, glbSrc: body.glbSrc });
                          }
                        })
                        .catch(() => setBlenderStatus("Send to Blender failed. No scene file was changed."));
                    }}
                  >
                    Send to Blender
                  </button>
                </>
              ) : (
                <p className="studio-windowbar__menu-status">
                  Blender: {DESKTOP_ONLY_REASON}.{" "}
                  <a href={KURVA_DESKTOP_APP_URL} rel="noreferrer">
                    Get the desktop app
                  </a>
                </p>
              )}
              <button
                type="button"
                onClick={(event) => {
                  closePopover(event);
                  onToggleInspector();
                }}
              >
                <PanelRight size={14} aria-hidden="true" />
                {isInspectorOpen ? "Hide properties" : "Show properties"}
              </button>
              <button
                type="button"
                onClick={onCycleTheme}
                title="Switch theme (Light → Dark → High contrast)"
                aria-label={`Theme: ${themeLabel}. Activate to switch.`}
              >
                Theme: {themeLabel}
              </button>
            </div>
          </details>
          <button
            className="studio-windowbar__control studio-windowbar__desktop-only"
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
          aria-label="Zoom options"
          aria-expanded={isZoomMenuOpen}
          aria-controls="studio-zoom-menu"
          onClick={() => setZoomMenuOpen((open) => !open)}
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {isZoomMenuOpen && (
          <div className="studio-zoom-menu" id="studio-zoom-menu" role="menu" aria-label="Zoom">
            {zoomMenuItems(canZoomSelection).map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={!item.enabled}
                title={item.reason ?? ""}
                onClick={() => {
                  setZoomMenuOpen(false);
                  onZoomCommand(item.id);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

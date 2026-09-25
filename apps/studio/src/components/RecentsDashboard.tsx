import {
  ArrowLeft,
  Cable,
  ChevronDown,
  Clock3,
  FolderOpen,
  House,
  Image,
  LayoutGrid,
  List,
  Menu,
  MoreHorizontal,
  Plus,
  ScanLine,
  Search,
  Settings,
  Upload,
  X
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioProjectMeta } from "../bridge/studioHost.js";
import { Button, Dialog } from "../ui/index.js";
import { BrandMark } from "./BrandMark.js";
import { formatEditedLabel } from "./recentCanvas.js";
import { RecentEmptyState, RecentLoadingCards, RecentProjectNotice, recentListMode } from "./recentStates.js";
import { HOME_CATEGORY_PRESETS, type HomeCategory, StudioComposer } from "./StudioComposer.js";

export interface SessionCanvas {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

export const SCRATCHPAD_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

type HomeRoute = "home" | "settings" | "connectors";
type Layout = "grid" | "list";
type SortOrder = "updated" | "name" | "created";

export interface RecentsDashboardProps {
  isOpen: boolean;
  canvases: SessionCanvas[];
  currentCanvasId: string | null;
  projects: StudioProjectMeta[];
  projectMode: boolean;
  projectStatus: "idle" | "loading" | "ready" | "error";
  projectMessage: string;
  activeProjectId: string | null;
  projectActionMessage?: string | undefined;
  corruptCount?: number;
  thumbnailUrls?: Readonly<Record<string, string>> | undefined;
  hostProjectThumbnails?: boolean | undefined;
  hostThumbnailVersions?: Readonly<Record<string, number>> | undefined;
  onClose: () => void;
  onOpenCanvas: (canvasId: string) => void;
  onOpenProject: (projectId: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRefreshProjects: () => void;
  onNewCanvas: (categoryId?: string) => void;
  onOpenFile?: (() => void) | undefined;
  onNavigate?: ((route: HomeRoute) => void) | undefined;
  onStartDesign?: ((categoryId: string, prompt: string) => void) | undefined;
  onRenameProject?: ((projectId: string, title: string) => void) | undefined;
  onRevealProject?: ((projectId: string) => void) | undefined;
  onRenameCanvas?: ((canvasId: string, title: string) => void) | undefined;
  onDuplicateCanvas?: ((canvasId: string) => void) | undefined;
  onDeleteCanvas?: ((canvasId: string) => void) | undefined;
  onImageToSvg?: (() => void) | undefined;
  onRecreateScreenshot?: (() => void) | undefined;
  onImportAsset?: (() => void) | undefined;
  currentNav?: "home" | "connectors" | undefined;
  companion?: React.ReactNode | undefined;
  libraryNote?: string | undefined;
  workspaceTitle?: string | undefined;
  workspaceDetail?: string | undefined;
}

const LAYOUT_KEY = "codex-avatar-studio-home-layout";
const SORT_KEY = "codex-avatar-studio-home-sort";

function readPreference<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return values.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

function rememberPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The dashboard remains usable when Webview storage is unavailable.
  }
}

function closeCardMenu(event: React.MouseEvent<HTMLButtonElement>): void {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function RecentsDashboard({
  isOpen,
  canvases,
  currentCanvasId,
  projects,
  projectMode,
  projectStatus,
  projectMessage,
  activeProjectId,
  projectActionMessage,
  corruptCount = 0,
  thumbnailUrls,
  hostProjectThumbnails = false,
  hostThumbnailVersions,
  onClose,
  onOpenCanvas,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onRefreshProjects,
  onNavigate,
  onNewCanvas,
  onOpenFile,
  onStartDesign,
  onRenameProject,
  onRevealProject,
  onRenameCanvas,
  onDuplicateCanvas,
  onDeleteCanvas,
  onImageToSvg,
  onRecreateScreenshot,
  onImportAsset,
  currentNav = "home",
  companion,
  libraryNote,
  workspaceTitle,
  workspaceDetail
}: RecentsDashboardProps) {
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<Layout>(() => readPreference(LAYOUT_KEY, ["grid", "list"], "grid"));
  const [sortOrder, setSortOrder] = useState<SortOrder>(() =>
    readPreference(SORT_KEY, ["updated", "name", "created"], "updated")
  );
  const [categoryId, setCategoryId] = useState<HomeCategory["id"]>("landing-page");
  const [prompt, setPrompt] = useState<string>(HOME_CATEGORY_PRESETS[0].starterPrompt);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renamingProject, setRenamingProject] = useState<StudioProjectMeta | null>(null);
  const [renamingCanvas, setRenamingCanvas] = useState<SessionCanvas | null>(null);
  const [deletingCanvas, setDeletingCanvas] = useState<SessionCanvas | null>(null);
  // Projects are confirmed in this dialog, not window.confirm, which some browsers block or auto-cancel.
  const [deletingProject, setDeletingProject] = useState<StudioProjectMeta | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const renameFieldRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const recentsRef = useRef<HTMLDivElement>(null);
  const brandDetailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => rememberPreference(LAYOUT_KEY, layout), [layout]);
  useEffect(() => rememberPreference(SORT_KEY, sortOrder), [sortOrder]);

  useEffect(() => {
    if (!isOpen) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDrawerOpen(false);
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isOpen]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return projects
      .filter((project) => project.title.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        if (left.id === SCRATCHPAD_PROJECT_ID) return -1;
        if (right.id === SCRATCHPAD_PROJECT_ID) return 1;
        if (sortOrder === "name") return left.title.localeCompare(right.title);
        const field = sortOrder === "created" ? "createdAt" : "updatedAt";
        return right[field].localeCompare(left[field]);
      });
  }, [projects, query, sortOrder]);

  const visibleCanvases = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matching = canvases.filter((canvas) => canvas.title.toLocaleLowerCase().includes(normalizedQuery));
    return [...matching].sort((left, right) => {
      if (left.pinned && !right.pinned) return -1;
      if (right.pinned && !left.pinned) return 1;
      if (sortOrder === "name") return left.title.localeCompare(right.title);
      const field = sortOrder === "created" ? "createdAt" : "updatedAt";
      return right[field].localeCompare(left[field]);
    });
  }, [canvases, query, sortOrder]);

  if (!isOpen) return null;

  const goToHome = () => {
    setDrawerOpen(false);
    brandDetailsRef.current?.removeAttribute("open");
    setQuery("");
    onNavigate?.("home");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToRecents = () => {
    setDrawerOpen(false);
    brandDetailsRef.current?.removeAttribute("open");
    if (companion) {
      onNavigate?.("home");
      requestAnimationFrame(() => {
        recentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      recentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const category = HOME_CATEGORY_PRESETS.find((preset) => preset.id === categoryId) ?? HOME_CATEGORY_PRESETS[0];
  const selectCategory = (preset: HomeCategory) => {
    const previous = HOME_CATEGORY_PRESETS.find((item) => item.id === categoryId);
    setCategoryId(preset.id);
    setPrompt((current) =>
      current === previous?.starterPrompt || current.trim() === "" ? preset.starterPrompt : current
    );
  };
  const hasCurrentCanvas = projectMode ? Boolean(activeProjectId) : Boolean(currentCanvasId);
  const currentSort = sortOrder;
  const visibleCount = projectMode ? visibleProjects.length : visibleCanvases.length;

  return (
    <section className="recents" aria-label={companion ? "Studio connectors" : "Studio home"}>
      {drawerOpen && (
        <button
          className="recents__drawer-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside className={`recents__rail${drawerOpen ? " recents__rail--open" : ""}`} aria-label="Studio navigation">
        <div className="recents__brand">
          <button
            type="button"
            className="recents__brand-home"
            onClick={goToHome}
            title="Kurva Home"
            aria-label="Kurva Home"
          >
            <BrandMark className="recents__brand-mark" />
            <span className="recents__rail-text recents__wordmark">kurva</span>
          </button>
          <details ref={brandDetailsRef} className="recents__brand-menu">
            <summary
              className="recents__brand-chevron"
              aria-label="Workspace menu"
              title={workspaceTitle ?? (projectMode ? "Trusted VS Code workspace" : "Browser session")}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="recents__brand-menu-content">
              <span className="recents__brand-menu-label">Current workspace</span>
              <strong>{workspaceTitle ?? (projectMode ? "Trusted VS Code workspace" : "Browser session")}</strong>
              <span className="recents__brand-menu-note">
                {workspaceDetail ??
                  (projectMode
                    ? "Projects are saved locally in this workspace."
                    : "Canvases last for this browser session.")}
              </span>
              <div className="recents__brand-menu-actions">
                <button
                  type="button"
                  onClick={(event) => {
                    closeCardMenu(event);
                    goToHome();
                  }}
                >
                  <House size={15} aria-hidden="true" /> Home
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    closeCardMenu(event);
                    onNewCanvas(categoryId);
                  }}
                >
                  <Plus size={15} aria-hidden="true" /> New file
                </button>
                {onOpenFile && (
                  <button
                    type="button"
                    onClick={(event) => {
                      closeCardMenu(event);
                      onOpenFile();
                    }}
                  >
                    <FolderOpen size={15} aria-hidden="true" /> Open file
                  </button>
                )}
              </div>
            </div>
          </details>
          <button
            className="recents__drawer-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          className="recents__nav-search"
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            searchRef.current?.focus();
          }}
          title="Search (Ctrl+K)"
          aria-keyshortcuts="Control+K"
        >
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="recents__rail-text">Search</span>
          <kbd className="recents__rail-text">Ctrl K</kbd>
        </button>
        <nav className="recents__nav" aria-label="Workspace">
          <button
            className={`recents__nav-item${currentNav === "home" && !companion ? " recents__nav-item--active" : ""}`}
            type="button"
            onClick={goToHome}
            aria-current={currentNav === "home" && !companion ? "page" : undefined}
            title="Home"
          >
            <House size={17} strokeWidth={1.75} aria-hidden="true" />
            <span className="recents__rail-text">Home</span>
          </button>
          <button className="recents__nav-item" type="button" onClick={goToRecents} title="Recents">
            <Clock3 size={17} strokeWidth={1.75} aria-hidden="true" />
            <span className="recents__rail-text">Recents</span>
          </button>
          {projects.some((project) => project.id === SCRATCHPAD_PROJECT_ID) && (
            <button className="recents__nav-item" type="button" onClick={() => onOpenProject(SCRATCHPAD_PROJECT_ID)}>
              <span className="recents__rail-text">Scratchpad</span>
            </button>
          )}
        </nav>
        <div className="recents__rail-bottom">
          {onNavigate && (
            <>
              <button
                className={`recents__nav-item${currentNav === "connectors" ? " recents__nav-item--active" : ""}`}
                type="button"
                aria-current={currentNav === "connectors" ? "page" : undefined}
                onClick={() => {
                  setDrawerOpen(false);
                  onNavigate("connectors");
                }}
                title="Connectors"
              >
                <Cable size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className="recents__rail-text">Connectors</span>
              </button>
              <button
                className="recents__nav-item"
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onNavigate("settings");
                }}
                title="Settings"
              >
                <Settings size={17} strokeWidth={1.75} aria-hidden="true" />
                <span className="recents__rail-text">Settings</span>
              </button>
            </>
          )}
          {hasCurrentCanvas && (
            <button className="recents__nav-item" type="button" onClick={onClose} title="Return to canvas">
              <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="recents__rail-text">Return to canvas</span>
            </button>
          )}
          <p className={`recents__rail-note recents__rail-text${projectMode ? " recents__rail-note--saved" : ""}`}>
            {libraryNote ?? (projectMode ? "Local host · saved to disk" : "Browser session · not saved to disk")}
          </p>
        </div>
      </aside>

      <main className="recents__main">
        <header className="recents__header">
          <button
            className="recents__mobile-nav"
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          {companion ? (
            <h1 className="recents__page-title">
              <button type="button" className="recents__page-title-button" onClick={goToHome} title="Return to Home">
                Connectors
              </button>
            </h1>
          ) : (
            <h1 className="recents__page-title">
              <button type="button" className="recents__page-title-button" onClick={goToHome} title="Return to top">
                Home
              </button>
            </h1>
          )}
          {!companion && (
            <div className="recents__header-actions">
              {onOpenFile && (
                <button className="recents__button recents__button--quiet" type="button" onClick={onOpenFile}>
                  <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Open file
                </button>
              )}
              <button
                className="recents__button recents__button--primary"
                type="button"
                data-category={categoryId}
                onClick={() => onNewCanvas(categoryId)}
              >
                <Plus size={16} strokeWidth={2} aria-hidden="true" /> New file
              </button>
            </div>
          )}
        </header>

        {companion ? (
          <div className="recents__content recents__companion">{companion}</div>
        ) : (
          <div className="recents__content" ref={contentRef}>
            <div className="recents__content-inner">
              <StudioComposer
                className="studio-composer--home"
                prompt={prompt}
                onPromptChange={setPrompt}
                categories={HOME_CATEGORY_PRESETS}
                categoryId={categoryId}
                onCategoryChange={selectCategory}
                onSubmit={onStartDesign ? () => onStartDesign(categoryId, prompt.trim()) : undefined}
                submitEnabled={Boolean(onStartDesign && prompt.trim() !== category.starterPrompt.trim())}
                submitHelp={
                  onStartDesign
                    ? "Open this prompt in the editor"
                    : "Prompt handoff is coming soon. Use New file to start a canvas."
                }
                footnote={
                  <>
                    <span>
                      New frame: {category.label} · {category.width} × {category.height}
                    </span>
                    <span>
                      {onStartDesign ? "Opens in editor · review before sending" : "Use New file to start a canvas"}
                    </span>
                  </>
                }
              />

              <section className="recents__start-cards" aria-label="Other ways to start">
                <StartCard
                  title="Image → SVG"
                  description="Trace a picture into editable vectors on this computer."
                  icon={<ScanLine size={20} strokeWidth={1.7} aria-hidden="true" />}
                  onClick={onImageToSvg}
                />
                <StartCard
                  title="Recreate a screenshot"
                  description="Place it locally and attach it to a reviewed vision-model request."
                  icon={<Image size={20} strokeWidth={1.7} aria-hidden="true" />}
                  onClick={onRecreateScreenshot}
                />
                <StartCard
                  title="Import SVG or image"
                  description="Bring a local file in as a sanitized canvas asset."
                  icon={<Upload size={20} strokeWidth={1.7} aria-hidden="true" />}
                  onClick={onImportAsset}
                />
              </section>

              <div className="recents__recents" id="recents" ref={recentsRef}>
                <div className="recents__section-heading">
                  <h2>Recents</h2>
                  <span>
                    {visibleCount}{" "}
                    {visibleCount === 1 ? (projectMode ? "project" : "canvas") : projectMode ? "projects" : "canvases"}
                  </span>
                  <div className="recents__section-controls">
                    <label className="recents__sort">
                      <span className="sr-only">Sort recents</span>
                      <select
                        value={currentSort}
                        onChange={(event) => setSortOrder(event.currentTarget.value as SortOrder)}
                      >
                        <option value="updated">Last edited</option>
                        <option value="name">Name</option>
                        <option value="created">Created</option>
                      </select>
                    </label>
                    <fieldset className="recents__layout">
                      <legend className="sr-only">Layout</legend>
                      <button
                        type="button"
                        aria-label="Grid view"
                        aria-pressed={layout === "grid"}
                        onClick={() => setLayout("grid")}
                      >
                        <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="List view"
                        aria-pressed={layout === "list"}
                        onClick={() => setLayout("list")}
                      >
                        <List size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </fieldset>
                  </div>
                </div>

                <label className="recents__search">
                  <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="sr-only">Search {projectMode ? "projects" : "canvases"}</span>
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder={`Search ${projectMode ? "projects" : "canvases"}`}
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                      <X size={15} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  )}
                </label>

                {projectActionMessage && (
                  <p className="recents__notice" role="status">
                    {projectActionMessage}
                  </p>
                )}
                <RecentProjectNotice
                  projectMode={projectMode}
                  projectStatus={projectStatus}
                  corruptCount={corruptCount}
                  projectMessage={projectMessage}
                  onRetry={onRefreshProjects}
                />

                {recentListMode({
                  projectMode,
                  projectStatus,
                  visibleProjects: visibleProjects.length,
                  visibleCanvases: visibleCanvases.length,
                  corruptCount
                }) === "loading" ? (
                  <RecentLoadingCards />
                ) : projectMode && visibleProjects.length > 0 ? (
                  <div className={`recents__canvases recents__canvases--${layout}`}>
                    {visibleProjects.map((project) => (
                      <div className="recents__project-card" key={project.id}>
                        <button
                          className={`recents__canvas${project.id === activeProjectId ? " recents__canvas--current" : ""}`}
                          type="button"
                          onClick={() => onOpenProject(project.id)}
                        >
                          <Preview
                            key={`${project.id}:${hostThumbnailVersions?.[project.id] ?? 0}`}
                            thumbnailUrl={thumbnailUrls?.[project.id]}
                            hostThumbnailUrl={
                              hostProjectThumbnails
                                ? `/api/projects/${encodeURIComponent(project.id)}/thumbnail?v=${hostThumbnailVersions?.[project.id] ?? 0}`
                                : undefined
                            }
                          />
                          <span className="recents__canvas-details">
                            <span className="recents__canvas-title">
                              {project.title}
                              {project.id === SCRATCHPAD_PROJECT_ID && <span className="recents__pinned">Pinned</span>}
                            </span>
                            <time className="recents__canvas-meta" dateTime={project.updatedAt}>
                              {formatEditedLabel(project.updatedAt)}
                            </time>
                          </span>
                        </button>
                        <details className="recents__card-menu">
                          <summary aria-label={`More actions for ${project.title}`} title="More actions">
                            <MoreHorizontal size={19} strokeWidth={1.8} aria-hidden="true" />
                          </summary>
                          <div className="recents__card-menu-items">
                            <button
                              type="button"
                              onClick={(event) => {
                                closeCardMenu(event);
                                onOpenProject(project.id);
                              }}
                            >
                              Open
                            </button>
                            {onRenameProject && project.id !== SCRATCHPAD_PROJECT_ID && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  setRenamingProject(project);
                                  setRenameTitle(project.title);
                                }}
                              >
                                Rename
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                closeCardMenu(event);
                                onDuplicateProject(project.id);
                              }}
                            >
                              Duplicate
                            </button>
                            {onRevealProject && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  onRevealProject(project.id);
                                }}
                              >
                                Reveal in folder
                              </button>
                            )}
                            {project.id !== SCRATCHPAD_PROJECT_ID && (
                              <button
                                className="recents__delete-action"
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  setDeletingProject(project);
                                }}
                              >
                                Delete…
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : !projectMode && visibleCanvases.length > 0 ? (
                  <div className={`recents__canvases recents__canvases--${layout}`}>
                    {visibleCanvases.map((canvas) => (
                      <div className="recents__project-card" key={canvas.id}>
                        <button
                          className={`recents__canvas${canvas.id === currentCanvasId ? " recents__canvas--current" : ""}`}
                          type="button"
                          onClick={() => onOpenCanvas(canvas.id)}
                        >
                          <Preview thumbnailUrl={thumbnailUrls?.[canvas.id]} />
                          <span className="recents__canvas-details">
                            <span className="recents__canvas-title">
                              {canvas.title}
                              {canvas.pinned && <span className="recents__pinned">Pinned</span>}
                            </span>
                            <time className="recents__canvas-meta" dateTime={canvas.updatedAt}>
                              {formatEditedLabel(canvas.updatedAt)}
                            </time>
                          </span>
                        </button>
                        <details className="recents__card-menu">
                          <summary aria-label={`More actions for ${canvas.title}`} title="More actions">
                            <MoreHorizontal size={19} strokeWidth={1.8} aria-hidden="true" />
                          </summary>
                          <div className="recents__card-menu-items">
                            <button
                              type="button"
                              onClick={(event) => {
                                closeCardMenu(event);
                                onOpenCanvas(canvas.id);
                              }}
                            >
                              Open
                            </button>
                            {onRenameCanvas && !canvas.pinned && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  setRenamingCanvas(canvas);
                                  setRenameTitle(canvas.title);
                                }}
                              >
                                Rename
                              </button>
                            )}
                            {onDuplicateCanvas && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  onDuplicateCanvas(canvas.id);
                                }}
                              >
                                Duplicate
                              </button>
                            )}
                            {onDeleteCanvas && !canvas.pinned && canvases.length > 1 && (
                              <button
                                className="recents__delete-action"
                                type="button"
                                onClick={(event) => {
                                  closeCardMenu(event);
                                  setDeletingCanvas(canvas);
                                }}
                              >
                                Delete…
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : recentListMode({
                    projectMode,
                    projectStatus,
                    visibleProjects: visibleProjects.length,
                    visibleCanvases: visibleCanvases.length,
                    corruptCount
                  }) === "empty" ? (
                  <RecentEmptyState
                    query={query}
                    projectMode={projectMode}
                    onClearSearch={() => setQuery("")}
                    onNewCanvas={() => onNewCanvas(categoryId)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>
      <Dialog.Root
        open={renamingProject !== null || renamingCanvas !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenamingProject(null);
            setRenamingCanvas(null);
          }
        }}
      >
        <Dialog.Content
          aria-describedby="rename-project-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => renameFieldRef.current?.focus());
          }}
        >
          <form
            className="recents__rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              const title = renameTitle.trim();
              const currentTitle = renamingProject?.title ?? renamingCanvas?.title;
              if (!currentTitle || !title || title.length > 120 || title === currentTitle) return;
              if (renamingProject) onRenameProject?.(renamingProject.id, title);
              if (renamingCanvas) onRenameCanvas?.(renamingCanvas.id, title);
              setRenamingProject(null);
              setRenamingCanvas(null);
            }}
          >
            <Dialog.Title>{renamingCanvas ? "Rename canvas" : "Rename project"}</Dialog.Title>
            <Dialog.Description id="rename-project-description">
              Choose a title up to 120 characters.
            </Dialog.Description>
            <label className="recents__rename-label" htmlFor="rename-project-title">
              Name
            </label>
            <input
              ref={renameFieldRef}
              className="recents__rename-field"
              id="rename-project-title"
              maxLength={120}
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.currentTarget.value)}
            />
            <div className="recents__rename-actions">
              <Button
                type="button"
                onClick={() => {
                  setRenamingProject(null);
                  setRenamingCanvas(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !renameTitle.trim() || renameTitle.trim() === (renamingProject?.title ?? renamingCanvas?.title)
                }
              >
                Save name
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={deletingCanvas !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCanvas(null);
        }}
      >
        <Dialog.Content aria-describedby="delete-canvas-description">
          <div className="recents__rename-form">
            <Dialog.Title>Delete “{deletingCanvas?.title}”?</Dialog.Title>
            <Dialog.Description id="delete-canvas-description">
              This removes the canvas from the current browser session and cannot be undone.
            </Dialog.Description>
            <div className="recents__rename-actions">
              <Button type="button" onClick={() => setDeletingCanvas(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  if (deletingCanvas) onDeleteCanvas?.(deletingCanvas.id);
                  setDeletingCanvas(null);
                }}
              >
                Delete canvas
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={deletingProject !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingProject(null);
        }}
      >
        <Dialog.Content aria-describedby="delete-project-description">
          <div className="recents__rename-form">
            <Dialog.Title>Delete “{deletingProject?.title}”?</Dialog.Title>
            <Dialog.Description id="delete-project-description">
              This removes the project and its canvas. It cannot be undone.
            </Dialog.Description>
            <div className="recents__rename-actions">
              <Button type="button" onClick={() => setDeletingProject(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  if (deletingProject) onDeleteProject(deletingProject.id);
                  setDeletingProject(null);
                }}
              >
                Delete project
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
}

function Preview({
  thumbnailUrl,
  hostThumbnailUrl
}: {
  thumbnailUrl?: string | undefined;
  hostThumbnailUrl?: string | undefined;
}) {
  const [hostThumbnailFailed, setHostThumbnailFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hostLoaded, setHostLoaded] = useState(false);
  const retryTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(retryTimer.current), []);
  useEffect(() => {
    setHostLoaded(false);
  }, [hostThumbnailUrl]);

  const hostSrc =
    hostThumbnailUrl && !hostThumbnailFailed
      ? retry > 0
        ? `${hostThumbnailUrl}${hostThumbnailUrl.includes("?") ? "&" : "?"}retry=${retry}`
        : hostThumbnailUrl
      : undefined;

  // Local cache paints immediately. Host PNG replaces it only after a successful load,
  // so missing host thumbnails never sit on "Loading preview…".
  const displaySrc = hostLoaded && hostSrc ? hostSrc : thumbnailUrl;

  return (
    <span className="recents__canvas-preview" aria-hidden="true">
      {hostSrc ? (
        <img
          className="recents__preview-image recents__preview-image--probe"
          src={hostSrc}
          alt=""
          onLoad={() => setHostLoaded(true)}
          onError={() => {
            setHostLoaded(false);
            if (retry < 2) {
              window.clearTimeout(retryTimer.current);
              retryTimer.current = window.setTimeout(() => setRetry((current) => current + 1), 1200);
              return;
            }
            setHostThumbnailFailed(true);
          }}
        />
      ) : null}
      {displaySrc ? (
        <img className="recents__preview-image" src={displaySrc} alt="" />
      ) : (
        <span className="recents__preview-caption">No preview yet</span>
      )}
    </span>
  );
}

export function projectThumbnailSource(
  hostThumbnailUrl: string | undefined,
  fallbackUrl: string | undefined,
  hostThumbnailFailed: boolean
): string | undefined {
  return hostThumbnailUrl && !hostThumbnailFailed ? hostThumbnailUrl : fallbackUrl;
}

function StartCard({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      className="recents__start-card"
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? undefined : `${title} is coming soon`}
    >
      <span className="recents__start-icon">{icon}</span>
      <span className="recents__start-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {!onClick && <em>Coming soon</em>}
      </span>
    </button>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { type Editor, GeoShapeGeoStyle, type TLDefaultColorStyle, type TLPageId, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import "./styles/studio.css";
import { type StudioProjectsState, useStudioHost } from "./bridge/studioHost.js";
import { decodeAssetDrag, placeCanvasAsset } from "./components/canvasAssets.js";
import { applyProposal, type CanvasProposal } from "./components/canvasProposal.js";
import type { PaletteCommand } from "./components/commandPalette.js";
import { capCanvasSummary } from "./components/contextBudget.js";
import { executeCanvasTool } from "./components/executeCanvasTool.js";
import { summarizeShapeSelection } from "./components/inspectorSelection.js";
import { ProposalBar } from "./components/ProposalBar.js";
import {
  clampPanelSize,
  getPanelSizeRange,
  type PanelSizeAxis,
  type ResizablePanel,
  readPanelSize,
  writePanelSize
} from "./components/panelSizing.js";
import {
  captureProjectThumbnail,
  readProjectThumbnails,
  removeProjectThumbnail,
  storeFrameThumbnail
} from "./components/projectThumbnail.js";
import { RecentsDashboard, SCRATCHPAD_PROJECT_ID, type SessionCanvas } from "./components/RecentsDashboard.js";
import { readCanvasTimes, rememberCanvasTimes, stampCanvasTimes } from "./components/recentCanvas.js";
import { StudioCanvasMenu } from "./components/StudioCanvasMenu.js";
import { StudioCommandPalette } from "./components/StudioCommandPalette.js";
import { HOME_CATEGORY_PRESETS } from "./components/StudioComposer.js";
import {
  type GeometryProperty,
  type InspectedShape,
  type PageProperties,
  StudioInspector
} from "./components/StudioInspector.js";
import { StudioLeftPanel } from "./components/StudioLeftPanel.js";
import { StudioToolbar } from "./components/StudioToolbar.js";
import { StudioWindowBar } from "./components/StudioWindowBar.js";
import { ensureSessionScratchpad, isSessionScratchpad } from "./components/sessionScratchpad.js";
import { setRichTextWeight } from "./components/textWeight.js";
import { VectorAssetDialog } from "./components/VectorAssetDialog.js";
import { type ZoomCommand, zoomScale } from "./components/zoomMenu.js";
import { buildStudioProjectExport, studioExportFileName } from "./projects/exportProjectFile.js";
import { createHostAssetStore } from "./projects/hostAssetStore.js";
import {
  hostProjectSaveRequest,
  hostSaveTarget,
  shouldBootstrapStandaloneProject,
  studioHostToken
} from "./projects/hostProjectSave.js";
import { parseImportedStudioProject } from "./projects/importProjectFile.js";
import {
  assertChatImageAttachment,
  imageFileToTracePng,
  placeFileOnCanvas,
  readSanitizedSvgFile,
  svgTextToFile,
  traceImageFileLocally
} from "./projects/localAssets.js";
import {
  deleteStandaloneProject,
  duplicateStandaloneProject,
  listStandaloneProjects,
  openStandaloneProject,
  renameStandaloneProject
} from "./projects/standaloneProjects.js";
import { type StudioRoute, useStudioRoute } from "./router/studioRoute.js";
import { AvatarShapeUtil } from "./shapes/AvatarCanvasShape.js";
import { BlenderConnectorShapeUtil } from "./shapes/BlenderConnectorCanvasShape.js";
import { DesignFrameShapeUtil } from "./shapes/DesignFrameShape.js";
import { StudioFrameShapeUtil } from "./shapes/StudioFrameShapeUtil.js";
import { StudioGeoShapeUtil } from "./shapes/StudioGeoShapeUtil.js";
import { VectorStudioShapeUtil } from "./shapes/VectorStudioCanvasShape.js";
import { tldrawAssetUrls } from "./tldrawAssets.js";
import { readTldrawLicenseKey } from "./tldrawLicense.js";

const customShapeUtils = [
  AvatarShapeUtil,
  VectorStudioShapeUtil,
  BlenderConnectorShapeUtil,
  StudioGeoShapeUtil,
  StudioFrameShapeUtil,
  DesignFrameShapeUtil
];
const DevGallery = import.meta.env.DEV ? React.lazy(() => import("./components/ComponentGallery.js")) : null;
type StudioTheme = "dark" | "light" | "contrast";
interface ActivePanelResize {
  panel: ResizablePanel;
  axis: PanelSizeAxis;
  pointerId: number;
  startCoordinate: number;
  startSize: number;
  direction: 1 | -1;
}

function readStudioTheme(): StudioTheme {
  try {
    const stored = window.localStorage.getItem("codex-avatar-studio-theme");
    if (stored === "light" || stored === "contrast" || stored === "dark") return stored;
  } catch {
    // Theme choice is optional; use the default when browser storage is unavailable.
  }
  return "dark";
}

function readStandaloneHostMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem("kurva-studio-standalone") === "1";
  } catch {
    return false;
  }
}

function fitCurrentFrame(editor: Editor): number {
  const frame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
  const bounds = frame ? editor.getShapePageBounds(frame.id) : undefined;
  if (!bounds) {
    editor.zoomToFit();
    return editor.getZoomLevel();
  }
  editor.centerOnPoint({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 });
  editor.zoomToBounds(bounds, { inset: 40 });
  return editor.getZoomLevel();
}

function inspectSelection(editor: Editor): InspectedShape | null {
  return summarizeShapeSelection(
    editor.getSelectedShapes().map((shape) => ({
      id: String(shape.id),
      type: shape.type,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation,
      opacity: shape.opacity,
      props: shape.props as {
        w?: unknown;
        h?: unknown;
        fill?: unknown;
        dash?: unknown;
        color?: unknown;
        font?: unknown;
        size?: unknown;
        textAlign?: unknown;
        geo?: unknown;
        richText?: unknown;
      },
      meta: shape.meta as { studioRadius?: unknown }
    }))
  );
}

export function App() {
  const {
    hostState,
    modelCatalog,
    chatRun,
    toolCalls,
    pendingToolExecutions,
    projects,
    projectAction,
    onConnectionAction,
    requestModelCatalog,
    sendChat,
    traceImage,
    cancelChat,
    clearChatRun,
    approveToolCall,
    rejectToolCall,
    completeToolExecution,
    requestProjects,
    importProject,
    ensureScratchpad,
    openProject,
    saveProject,
    duplicateProject,
    renameProject,
    revealProject,
    deleteProject,
    clearProjectAction
  } = useStudioHost();
  const launchToken = typeof window === "undefined" ? null : studioHostToken(window.location.search);
  const [isStandaloneHost] = useState(() => Boolean(launchToken) || readStandaloneHostMode());
  useEffect(() => {
    if (!launchToken) return;
    try {
      window.sessionStorage.setItem("kurva-studio-standalone", "1");
    } catch {
      // The host mode marker is optional; the current page already has the launch state.
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("studioToken");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [launchToken]);
  const standaloneListRequestRef = useRef(0);
  const [standaloneProjects, setStandaloneProjects] = useState<StudioProjectsState>({
    status: isStandaloneHost ? "loading" : "idle",
    message: isStandaloneHost
      ? "Loading Studio projects…"
      : "Projects are available in a trusted local VS Code workspace.",
    projects: [],
    corruptCount: 0
  });
  const projectLibraryState = isStandaloneHost ? standaloneProjects : projects;
  const refreshProjectLibrary = React.useCallback(() => {
    if (!isStandaloneHost) {
      requestProjects();
      return;
    }
    const requestId = ++standaloneListRequestRef.current;
    setStandaloneProjects((current) => ({ ...current, status: "loading", message: "Loading Studio projects…" }));
    void listStandaloneProjects()
      .then((result) => {
        if (requestId !== standaloneListRequestRef.current) return;
        setStandaloneProjects({ status: "ready", message: "", ...result });
      })
      .catch((error: unknown) => {
        if (requestId !== standaloneListRequestRef.current) return;
        setStandaloneProjects((current) => ({
          ...current,
          status: "error",
          message: error instanceof Error ? error.message : "Studio could not load its local projects."
        }));
      });
  }, [isStandaloneHost, requestProjects]);
  useEffect(() => {
    if (isStandaloneHost) refreshProjectLibrary();
  }, [isStandaloneHost, refreshProjectLibrary]);
  const editorRef = useRef<Editor | null>(null);
  const startedToolExecutionsRef = useRef(new Set<string>());
  const shouldAutoFitRef = useRef(true);
  const projectIdRef = useRef<string | null>(null);
  const projectTitleRef = useRef("Untitled");
  const projectWritableRef = useRef(false);
  const pendingSnapshotRef = useRef<unknown>(null);
  const initialBlankSnapshotRef = useRef<string | null>(null);
  const scratchpadRequestedRef = useRef(false);
  const pendingNewCanvasRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const stampCanvasTimerRef = useRef<number | undefined>(undefined);
  const refreshCanvasesRef = useRef<(editor: Editor, touchCurrent?: boolean) => void>(() => undefined);
  const stopStoreListenerRef = useRef<(() => void) | null>(null);
  const stopInspectorListenerRef = useRef<(() => void) | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectSaveStatus, setProjectSaveStatus] = useState("Browser session only");
  const [canvasProposal, setCanvasProposal] = useState<CanvasProposal | null>(null);
  const [agentSessions, setAgentSessions] = useState<
    Array<{ id: string; title: string; status: "running" | "finished" | "idle" }>
  >([]);
  const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
  const [theme, setTheme] = useState<StudioTheme>(readStudioTheme);
  const [editorReady, setEditorReady] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [route, navigateRoute] = useStudioRoute();
  const routedProjectRef = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const traceInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | undefined>(undefined);
  const [isAgentSidebarOpen, setAgentSidebarOpen] = useState(false);
  const [isAgentPanelCollapsed, setAgentPanelCollapsed] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [isInspectorOpen, setInspectorOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedShape, setSelectedShape] = useState<InspectedShape | null>(null);
  const [pageProperties, setPageProperties] = useState<PageProperties>({
    background: "#16150f",
    opacity: 100,
    grid: true
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!editorReady) return;
    for (const execution of pendingToolExecutions) {
      const key = `${execution.requestId}::${execution.callId}`;
      if (startedToolExecutionsRef.current.has(key)) continue;
      startedToolExecutionsRef.current.add(key);
      const editor = editorRef.current;
      if (!editor) {
        completeToolExecution(execution.requestId, execution.callId, {
          ok: false,
          content: "The canvas is still starting. No changes were made."
        });
        continue;
      }
      void executeCanvasTool(editor, execution.name, execution.arguments)
        .then((result) => completeToolExecution(execution.requestId, execution.callId, { ok: true, ...result }))
        .catch((error: unknown) =>
          completeToolExecution(execution.requestId, execution.callId, {
            ok: false,
            content: error instanceof Error ? error.message.slice(0, 2_000) : "Studio could not run this canvas action."
          })
        );
    }
  }, [completeToolExecution, editorReady, pendingToolExecutions]);
  const tldrawLicenseKey = readTldrawLicenseKey(import.meta.env.VITE_TLDRAW_LICENSE_KEY);
  const [chatPanelWidth, setChatPanelWidth] = useState(() => readPanelSize("chat", "width"));
  const [chatPanelHeight, setChatPanelHeight] = useState(() => readPanelSize("chat", "height"));
  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(() => readPanelSize("inspector", "width"));
  const [inspectorPanelHeight, setInspectorPanelHeight] = useState(() => readPanelSize("inspector", "height"));
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 700);
  const [workspaceHeight, setWorkspaceHeight] = useState(() => window.innerHeight);
  const [canvases, setCanvases] = useState<SessionCanvas[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState(readProjectThumbnails);
  const [draftPrefill, setDraftPrefill] = useState<{ id: string; text: string } | null>(null);
  const [draftImagePrefill, setDraftImagePrefill] = useState<{ id: string; file: File } | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const panelResizeRef = useRef<ActivePanelResize | null>(null);
  const panelSizesRef = useRef({
    chat: { width: chatPanelWidth, height: chatPanelHeight },
    inspector: { width: inspectorPanelWidth, height: inspectorPanelHeight }
  });
  panelSizesRef.current = {
    chat: { width: chatPanelWidth, height: chatPanelHeight },
    inspector: { width: inspectorPanelWidth, height: inspectorPanelHeight }
  };
  const effectiveChatPanelHeight = clampPanelSize("chat", "height", chatPanelHeight, workspaceHeight);
  const effectiveInspectorPanelHeight = clampPanelSize("inspector", "height", inspectorPanelHeight, workspaceHeight);

  const setPanelSize = (panel: ResizablePanel, axis: PanelSizeAxis, size: number) => {
    const bounded = clampPanelSize(panel, axis, size, workspaceRef.current?.clientHeight);
    panelSizesRef.current[panel][axis] = bounded;
    if (panel === "chat" && axis === "width") setChatPanelWidth(bounded);
    if (panel === "chat" && axis === "height") setChatPanelHeight(bounded);
    if (panel === "inspector" && axis === "width") setInspectorPanelWidth(bounded);
    if (panel === "inspector" && axis === "height") setInspectorPanelHeight(bounded);
    return bounded;
  };

  const beginPanelResize = (panel: ResizablePanel, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const axis: PanelSizeAxis = isCompactViewport ? "height" : "width";
    const coordinate = axis === "width" ? event.clientX : event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    panelResizeRef.current = {
      panel,
      axis,
      pointerId: event.pointerId,
      startCoordinate: coordinate,
      startSize: clampPanelSize(panel, axis, panelSizesRef.current[panel][axis], workspaceRef.current?.clientHeight),
      direction: axis === "height" || panel === "inspector" ? -1 : 1
    };
    document.body.style.cursor = axis === "width" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const handlePanelResizeKey = (panel: ResizablePanel, event: React.KeyboardEvent<HTMLDivElement>) => {
    const axis: PanelSizeAxis = isCompactViewport ? "height" : "width";
    const range = getPanelSizeRange(panel, axis, workspaceRef.current?.clientHeight);
    const current = clampPanelSize(panel, axis, panelSizesRef.current[panel][axis], workspaceRef.current?.clientHeight);
    const increaseKey = axis === "height" ? "ArrowUp" : panel === "chat" ? "ArrowRight" : "ArrowLeft";
    const decreaseKey = axis === "height" ? "ArrowDown" : panel === "chat" ? "ArrowLeft" : "ArrowRight";
    let next: number;
    if (event.key === increaseKey) next = current + 24;
    else if (event.key === decreaseKey) next = current - 24;
    else if (event.key === "Home") next = range.minimum;
    else if (event.key === "End") next = range.maximum;
    else return;
    event.preventDefault();
    const bounded = setPanelSize(panel, axis, next);
    writePanelSize(panel, axis, bounded);
  };

  const persistProjectNow = React.useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    const editor = editorRef.current;
    const projectId = projectIdRef.current;
    if (!editor || !projectId || !projectWritableRef.current) return;
    const target = hostSaveTarget({
      vscode: hostState.host === "vscode" && hostState.workspaceTrusted,
      standaloneHost: isStandaloneHost,
      projectId
    });
    if (target === "offline") return;
    try {
      const snapshot = JSON.stringify(editor.getSnapshot());
      if (!snapshot) throw new Error("Snapshot serialization failed.");
      setProjectSaveStatus("Saving…");
      if (target === "vscode") {
        saveProject(projectId, projectTitleRef.current, snapshot);
        return;
      }
      const request = hostProjectSaveRequest({
        id: projectId,
        title: projectTitleRef.current,
        snapshot
      });
      void fetch(request.url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: request.body
      })
        .then((response) => {
          setProjectSaveStatus(response.ok ? "Saved" : "Save failed");
          if (response.ok && isStandaloneHost) {
            void storeFrameThumbnail(editor, projectId).catch(() => undefined);
            refreshProjectLibrary();
          }
        })
        .catch(() => setProjectSaveStatus("Save failed"));
    } catch {
      setProjectSaveStatus("Save failed");
    }
  }, [hostState.host, hostState.workspaceTrusted, saveProject, refreshProjectLibrary, isStandaloneHost]);

  const scheduleProjectSaveRef = useRef<() => void>(() => undefined);
  const scheduleProjectSave = React.useCallback(() => {
    const target = hostSaveTarget({
      vscode: hostState.host === "vscode" && hostState.workspaceTrusted,
      standaloneHost: isStandaloneHost,
      projectId: projectIdRef.current
    });
    if (target === "offline" || !projectWritableRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    setProjectSaveStatus("Saving…");
    saveTimerRef.current = window.setTimeout(persistProjectNow, 650);
  }, [hostState.host, hostState.workspaceTrusted, persistProjectNow, isStandaloneHost]);

  React.useEffect(() => {
    scheduleProjectSaveRef.current = scheduleProjectSave;
  }, [scheduleProjectSave]);

  React.useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
      window.clearTimeout(stampCanvasTimerRef.current);
      stopStoreListenerRef.current?.();
      stopInspectorListenerRef.current?.();
    },
    []
  );

  React.useEffect(() => {
    const updateViewportMode = () => setIsCompactViewport(window.innerWidth <= 700);
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  React.useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const updateWorkspaceHeight = () => setWorkspaceHeight(workspace.clientHeight);
    const observer = new ResizeObserver(updateWorkspaceHeight);
    observer.observe(workspace);
    updateWorkspaceHeight();
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resize = panelResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;
      const coordinate = resize.axis === "width" ? event.clientX : event.clientY;
      setPanelSize(
        resize.panel,
        resize.axis,
        resize.startSize + (coordinate - resize.startCoordinate) * resize.direction
      );
    };
    const finishResize = (event?: PointerEvent) => {
      const resize = panelResizeRef.current;
      if (!resize || (event && resize.pointerId !== event.pointerId)) return;
      writePanelSize(resize.panel, resize.axis, panelSizesRef.current[resize.panel][resize.axis]);
      panelResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      finishResize();
    };
  }, []);

  useEffect(() => {
    if (
      hostState.host !== "vscode" ||
      !hostState.workspaceTrusted ||
      projects.status !== "ready" ||
      !editorReady ||
      projects.projects.some((project) => project.id === SCRATCHPAD_PROJECT_ID) ||
      scratchpadRequestedRef.current ||
      !initialBlankSnapshotRef.current
    )
      return;
    scratchpadRequestedRef.current = true;
    ensureScratchpad(initialBlankSnapshotRef.current);
  }, [hostState.host, hostState.workspaceTrusted, projects.status, projects.projects, editorReady, ensureScratchpad]);

  React.useEffect(() => {
    if (!projectAction) return;
    if ((projectAction.status === "opened" || projectAction.status === "imported") && projectAction.project) {
      window.clearTimeout(saveTimerRef.current);
      const { project } = projectAction;
      // A navigation back to Home while the host was loading must stay on Home.
      if (projectAction.status === "opened" && (route.name !== "project" || route.projectId !== project.id)) {
        clearProjectAction();
        return;
      }
      projectIdRef.current = project.id;
      projectWritableRef.current = false;
      setActiveProjectId(project.id);
      projectTitleRef.current = project.title;
      pendingSnapshotRef.current = JSON.parse(project.snapshot) as unknown;
      setProjectTitle(project.title);
      setProjectSaveStatus("Saved");
      setEditorGeneration((generation) => generation + 1);
      if (projectAction.status === "imported") navigateRoute({ name: "project", projectId: project.id });
      clearProjectAction();
    } else if (projectAction.status === "saved") {
      if (projectAction.projectId === projectIdRef.current) setProjectSaveStatus("Saved");
    } else if (projectAction.status === "ensured") {
      clearProjectAction();
    } else if (projectAction.status === "renamed" && projectAction.projectId) {
      const renamed = projects.projects.find((project) => project.id === projectAction.projectId);
      if (renamed && projectAction.projectId === projectIdRef.current) {
        projectTitleRef.current = renamed.title;
        setProjectTitle(renamed.title);
        editorRef.current?.renamePage(editorRef.current.getCurrentPageId(), renamed.title);
        scheduleProjectSave();
      }
      clearProjectAction();
    } else if (projectAction.status === "revealed") {
      clearProjectAction();
    } else if (projectAction.status === "deleted" && projectAction.projectId) {
      removeProjectThumbnail(projectAction.projectId);
      setThumbnailUrls(readProjectThumbnails());
      if (projectAction.projectId === projectIdRef.current) {
        projectIdRef.current = null;
        projectWritableRef.current = false;
        setActiveProjectId(null);
        setProjectSaveStatus("Deleted · session only");
        navigateRoute({ name: "home" });
      }
    } else if (projectAction.status === "error" || projectAction.status === "cancelled") {
      setProjectSaveStatus(projectAction.status === "cancelled" ? "Delete cancelled" : "Project action failed");
    }
  }, [projectAction, clearProjectAction, navigateRoute, route, projects.projects, scheduleProjectSave]);

  useEffect(() => {
    try {
      window.localStorage.setItem("codex-avatar-studio-theme", theme);
    } catch {
      // Theme choice remains available for this session when storage is restricted.
    }
  }, [theme]);

  useEffect(() => {
    const canvas = document.querySelector(".studio-canvas-content");
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let refitTimer: number | undefined;
    const observer = new ResizeObserver(() => {
      if (!editorRef.current || !shouldAutoFitRef.current) return;
      window.clearTimeout(refitTimer);
      refitTimer = window.setTimeout(() => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const editor = editorRef.current;
            if (editor && shouldAutoFitRef.current) setZoomLevel(fitCurrentFrame(editor));
          })
        );
      }, 120);
    });
    observer.observe(canvas);
    return () => {
      window.clearTimeout(refitTimer);
      observer.disconnect();
    };
  }, []);

  const refreshCanvases = (editor: Editor, touchCurrent = false) => {
    const pages = editor.getPages().map((page) => ({
      id: String(page.id),
      title: page.name,
      pinned: isSessionScratchpad(page)
    }));
    const currentId = String(editor.getCurrentPageId());
    const stamped = stampCanvasTimes(readCanvasTimes(), pages, currentId, touchCurrent);
    const kept: ReturnType<typeof readCanvasTimes> = {};
    for (const page of pages) {
      const time = stamped[page.id];
      if (time) kept[page.id] = time;
    }
    rememberCanvasTimes(kept);
    const fallback = new Date().toISOString();
    setCanvases(
      pages.map((page) => ({
        ...page,
        createdAt: kept[page.id]?.createdAt ?? fallback,
        updatedAt: kept[page.id]?.updatedAt ?? fallback
      }))
    );
    setCurrentCanvasId(currentId);
  };
  refreshCanvasesRef.current = refreshCanvases;

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;
    const pendingSnapshot = pendingSnapshotRef.current;
    if (pendingSnapshot) {
      try {
        editor.loadSnapshot(pendingSnapshot as Parameters<Editor["loadSnapshot"]>[0]);
        projectWritableRef.current = true;
      } catch {
        projectIdRef.current = null;
        setActiveProjectId(null);
        setProjectSaveStatus("Could not open project");
        navigateRoute({ name: "home" });
      }
      pendingSnapshotRef.current = null;
    } else {
      editor.renamePage(editor.getCurrentPageId(), projectTitleRef.current);
      const existingFrames = editor.getCurrentPageShapes().filter((shape) => shape.type === "frame");
      if (existingFrames.length === 0) {
        const center = editor.getViewportPageBounds().center;
        editor.createShape({
          type: "frame",
          x: center.x - 540,
          y: center.y - 360,
          props: { w: 1080, h: 720, name: "Frame" }
        });
      }
      if (!initialBlankSnapshotRef.current) {
        try {
          initialBlankSnapshotRef.current = JSON.stringify(editor.getSnapshot());
        } catch {
          // Scratchpad creation can retry after a valid canvas snapshot is available.
        }
      }
    }

    // Keep inspector values tied to the real current selection.
    editor.sideEffects.registerAfterChangeHandler("instance_page_state", () => {
      setSelectedShape(inspectSelection(editor));
      setZoomLevel(editor.getZoomLevel());
    });

    stopStoreListenerRef.current?.();
    stopStoreListenerRef.current = editor.store.listen(
      () => {
        scheduleProjectSaveRef.current();
        window.clearTimeout(stampCanvasTimerRef.current);
        stampCanvasTimerRef.current = window.setTimeout(() => {
          const current = editorRef.current;
          if (current) {
            refreshCanvasesRef.current(current, true);
            setCanvasEpoch((epoch) => epoch + 1);
          }
        }, 500);
      },
      { scope: "document" }
    );
    stopInspectorListenerRef.current?.();
    stopInspectorListenerRef.current = editor.store.listen(() => setSelectedShape(inspectSelection(editor)), {
      scope: "document"
    });
    requestAnimationFrame(() => requestAnimationFrame(() => setZoomLevel(fitCurrentFrame(editor))));
    if (hostState.host !== "vscode") {
      if (!isStandaloneHost) ensureSessionScratchpad(editor);
      const routedHostProject = route.name === "project" && isProjectUuid(route.projectId);
      if (
        shouldBootstrapStandaloneProject({
          standaloneHost: isStandaloneHost,
          routeName: route.name,
          projectId: projectIdRef.current,
          routedHostProject
        })
      ) {
        projectIdRef.current = crypto.randomUUID();
        projectWritableRef.current = true;
        setActiveProjectId(projectIdRef.current);
        scheduleProjectSaveRef.current();
      }
    }
    refreshCanvases(editor);
    setEditorReady(true);
    if (pendingNewCanvasRef.current !== null) {
      const categoryId = pendingNewCanvasRef.current;
      pendingNewCanvasRef.current = null;
      window.setTimeout(() => handleNewCanvas(categoryId || undefined), 0);
    }
  };

  const handleTitleChange = (title: string) => {
    projectTitleRef.current = title;
    setProjectTitle(title);
    const editor = editorRef.current;
    if (!editor) return;
    editor.renamePage(editor.getCurrentPageId(), title);
    refreshCanvases(editor, true);
    scheduleProjectSave();
  };

  const handleExportProject = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const title = projectTitleRef.current.trim() || "Untitled";
    const storedId = activeProjectId ?? projectIdRef.current;
    const id =
      storedId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storedId)
        ? storedId
        : crypto.randomUUID();
    const json = buildStudioProjectExport({ id, title, snapshot: JSON.stringify(editor.getSnapshot()) });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = studioExportFileName(title);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleDuplicateCurrent = () => {
    if (((hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost) && activeProjectId) {
      handleDuplicateProject(activeProjectId);
      return;
    }
    if (currentCanvasId) handleDuplicateCanvas(currentCanvasId);
  };

  const handleDeleteCurrent = () => {
    if (((hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost) && activeProjectId) {
      handleDeleteProject(activeProjectId);
      return;
    }
    const editor = editorRef.current;
    const currentId = currentCanvasId;
    const page = editor?.getCurrentPage();
    if (!editor || !currentId || !page || isSessionScratchpad(page) || editor.getPages().length < 2) return;
    if (!window.confirm(`Delete “${projectTitleRef.current}”? This cannot be undone.`)) return;
    handleDeleteCanvas(currentId);
    navigateRoute({ name: "project", projectId: String(editor.getCurrentPageId()) });
  };

  const canDeleteCurrent = (() => {
    if ((hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost)
      return Boolean(activeProjectId && activeProjectId !== SCRATCHPAD_PROJECT_ID);
    const editor = editorRef.current;
    const page = editor?.getCurrentPage();
    return Boolean(editor && editor.getPages().length > 1 && page && !isSessionScratchpad(page));
  })();

  const handleOpenCanvas = (canvasId: string) => {
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === canvasId);
    if (!editor || !page) return;
    shouldAutoFitRef.current = true;
    editor.setCurrentPage(page);
    setZoomLevel(fitCurrentFrame(editor));
    projectTitleRef.current = page.name;
    setProjectTitle(page.name);
    if (hostState.host !== "vscode") setProjectSaveStatus("Browser session only");
    refreshCanvases(editor);
    scheduleProjectSave();
    routedProjectRef.current = canvasId;
    navigateRoute({ name: "project", projectId: canvasId });
  };

  const handleNewCanvas = (categoryId?: string) => {
    const editor = editorRef.current;
    if (!editor) {
      pendingNewCanvasRef.current = categoryId ?? "";
      return;
    }
    const preset = HOME_CATEGORY_PRESETS.find((candidate) => candidate.id === categoryId);
    const frameWidth = preset?.width ?? 1080;
    const frameHeight = preset?.height ?? 720;
    shouldAutoFitRef.current = true;
    if ((hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost) {
      persistProjectNow();
      const title = "Untitled";
      const nextProjectId = crypto.randomUUID();
      projectIdRef.current = nextProjectId;
      projectWritableRef.current = true;
      projectTitleRef.current = title;
      setActiveProjectId(nextProjectId);
      setProjectTitle(title);
      routedProjectRef.current = nextProjectId;
      navigateRoute({ name: "project", projectId: nextProjectId });
      // The canvas is hidden on Home. tldraw cannot change pages until it has a camera.
      const startBlankProject = (attempt = 0) => {
        const current = editorRef.current;
        const canvas = document.querySelector(".studio-canvas-content");
        const workspace = document.querySelector(".studio-workspace");
        const visible =
          canvas instanceof HTMLElement &&
          workspace instanceof HTMLElement &&
          !workspace.hasAttribute("hidden") &&
          canvas.clientWidth > 0 &&
          canvas.clientHeight > 0;
        if (!current || projectIdRef.current !== nextProjectId || !visible) {
          if (attempt < 30) window.requestAnimationFrame(() => startBlankProject(attempt + 1));
          else setProjectSaveStatus("Could not create a page");
          return;
        }
        try {
          const previousPages = [...current.getPages()];
          const created = current.createPage({ name: title });
          const createdId = typeof created === "string" ? created : created.id;
          const newPage =
            current.getPages().find((page) => page.id === createdId) ??
            current.getPages().find((page) => !previousPages.some((previous) => previous.id === page.id));
          if (!newPage) throw new Error("Missing new page");
          current.setCurrentPage(newPage);
          for (const page of previousPages) {
            const shapes = current.getPageShapeIds(page.id);
            if (shapes.size) current.deleteShapes([...shapes]);
            current.deletePage(page.id);
          }
          current.clearHistory();
          const placed = current.getViewportPageBounds().center;
          current.createShape({
            type: "frame",
            x: placed.x - frameWidth / 2,
            y: placed.y - frameHeight / 2,
            props: { w: frameWidth, h: frameHeight, name: "Frame" }
          });
          setZoomLevel(fitCurrentFrame(current));
          refreshCanvases(current, true);
          scheduleProjectSave();
        } catch {
          if (attempt < 30) window.requestAnimationFrame(() => startBlankProject(attempt + 1));
          else setProjectSaveStatus("Could not create a page");
        }
      };
      window.requestAnimationFrame(() => startBlankProject());
      return;
    }
    shouldAutoFitRef.current = true;
    const title = `Untitled canvas ${editor.getPages().length + 1}`;
    editor.createPage({ name: title });
    const page = editor.getPages().find((candidate) => candidate.name === title);
    if (!page) return;
    editor.setCurrentPage(page);
    const center = editor.getViewportPageBounds().center;
    editor.createShape({
      type: "frame",
      x: center.x - frameWidth / 2,
      y: center.y - frameHeight / 2,
      props: { w: frameWidth, h: frameHeight, name: "Frame" }
    });
    setZoomLevel(fitCurrentFrame(editor));
    setProjectTitle(page.name);
    refreshCanvases(editor, true);
    routedProjectRef.current = String(page.id);
    navigateRoute({ name: "project", projectId: String(page.id) });
  };

  const handleStartDesign = (categoryId: string, prompt: string) => {
    if (!prompt.trim()) return;
    handleNewCanvas(categoryId);
    setDraftPrefill({ id: crypto.randomUUID(), text: prompt.trim() });
    setAgentSidebarOpen(true);
  };

  const openLocalAsset = async (file: File | undefined, mode: "trace" | "screenshot" | "import") => {
    if (!file) return;
    const editor = editorRef.current;
    if (!editor) {
      setImportNotice("The editor is still starting. Try again.");
      return;
    }
    try {
      if (mode === "trace") {
        setImportNotice("Tracing on this computer. The picture is not uploaded.");
        let svg: string;
        if (hostState.host === "vscode") {
          const pngBytes = await imageFileToTracePng(file);
          svg = await traceImage(encodeBase64(pngBytes));
        } else {
          svg = await traceImageFileLocally(file);
        }
        handleNewCanvas();
        await placeFileOnCanvas(editor, svgTextToFile(svg, file.name));
        setProjectSaveStatus(
          hostState.host === "vscode"
            ? "Traced locally with VTracer. Nothing was uploaded."
            : "Traced locally in this browser preview. Nothing was uploaded."
        );
        setImportNotice(undefined);
        return;
      }
      if (mode === "screenshot") {
        assertChatImageAttachment(file);
        handleNewCanvas();
        await placeFileOnCanvas(editor, file);
        setDraftPrefill({
          id: crypto.randomUUID(),
          text: "Recreate the attached screenshot as an editable design."
        });
        setDraftImagePrefill({ id: crypto.randomUUID(), file });
        setAgentSidebarOpen(true);
        setProjectSaveStatus(
          "Screenshot added locally. It will only be sent after you review and confirm the request."
        );
        setImportNotice(undefined);
        return;
      }
      if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
        const svg = await readSanitizedSvgFile(file);
        handleNewCanvas();
        await placeFileOnCanvas(editor, svgTextToFile(svg, file.name));
      } else {
        handleNewCanvas();
        await placeFileOnCanvas(editor, file);
      }
      setProjectSaveStatus("Imported locally. Nothing was uploaded.");
      setImportNotice(undefined);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "The file could not be imported locally.");
    }
  };

  const handleToggleAgentSidebar = () => setAgentSidebarOpen((current) => !current);
  const conversationHostTarget = (conversationId: string) => {
    const projectId = projectIdRef.current;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isStandaloneHost || !projectId || !uuid.test(projectId) || !uuid.test(conversationId)) return null;
    return { projectId, url: `/api/projects/${projectId}/conversations/${conversationId}` };
  };
  const handleToggleInspector = () => setInspectorOpen((current) => !current);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isBackslash =
        event.key === "\\" ||
        event.key === "\\\\" ||
        event.code === "Backslash" ||
        event.code === "IntlBackslash" ||
        event.code === "\\\\";
      if (!(event.ctrlKey || event.metaKey) || !isBackslash || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (editorRef.current?.getEditingShapeId()) return;
      event.preventDefault();
      const show = !(isAgentSidebarOpen || isInspectorOpen);
      setAgentSidebarOpen(show);
      setInspectorOpen(show);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isAgentSidebarOpen, isInspectorOpen]);

  useEffect(() => {
    if (route.name !== "project") return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey)
        return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [route.name]);
  const handleCycleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : current === "light" ? "contrast" : "dark"));

  const handleInspectorUpdate = (property: GeometryProperty | "rotation" | "opacity" | "radius", value: number) => {
    if (!Number.isFinite(value)) return;
    const minimum = property === "width" || property === "height" ? 1 : -1_000_000;
    const maximum = 1_000_000;
    if (value < minimum || value > maximum) return;
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectedShapes();
    if (selected.length === 0) return;
    const updates = selected.flatMap((shape) => {
      const identity = { id: shape.id, type: shape.type };
      if (property === "x" || property === "y" || property === "rotation") return { ...identity, [property]: value };
      if (property === "opacity") return { ...identity, opacity: value };
      if (property === "radius") {
        if (
          shape.type !== "geo" ||
          !["rectangle", "studio-rounded-rectangle"].includes(String((shape.props as { geo?: unknown }).geo))
        )
          return [];
        const props = shape.props as { w: number; h: number; geo: string };
        const radius = Math.min(value, props.w / 2, props.h / 2);
        return {
          ...identity,
          props: { geo: radius === 0 ? "rectangle" : "studio-rounded-rectangle" },
          meta: { ...shape.meta, studioRadius: radius }
        };
      }
      const dimension = property === "width" ? "w" : "h";
      if (typeof (shape.props as { w?: unknown; h?: unknown })[dimension] !== "number") return [];
      return { ...identity, props: { [dimension]: value } };
    });
    if (updates.length === 0) return;
    editor.updateShapes(updates as Parameters<Editor["updateShapes"]>[0]);
    setSelectedShape(inspectSelection(editor));
  };

  const handlePageChange = (page: PageProperties) => {
    const background = /^#[0-9a-fA-F]{6}$/.test(page.background) ? page.background : pageProperties.background;
    const opacity = Math.min(100, Math.max(0, page.opacity));
    const next = { background, opacity, grid: page.grid };
    setPageProperties(next);
    document.querySelector(".studio-app")?.setAttribute("data-grid", next.grid ? "on" : "off");
    document.querySelector(".studio-app")?.setAttribute("data-page-opacity", String(next.opacity));
    const editor = editorRef.current;
    if (editor) editor.updateInstanceState({ isGridMode: next.grid });
    const canvas = document.querySelector(".tl-background");
    if (canvas instanceof HTMLElement) {
      const alpha = Math.round((next.opacity / 100) * 255)
        .toString(16)
        .padStart(2, "0");
      canvas.style.backgroundColor = `${next.background}${alpha}`;
    }
  };

  const handleFramePreset = (width: number, height: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const frames = editor.getSelectedShapes().filter((shape) => shape.type === "frame");
    if (frames.length === 0) return;
    editor.updateShapes(
      frames.map((shape) => ({ id: shape.id, type: "frame" as const, props: { w: width, h: height } }))
    );
    setSelectedShape(inspectSelection(editor));
  };

  const handleShapeStyle = (property: "fill" | "dash" | "color" | "frameColor", value: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (property === "frameColor") {
      const frames = editor.getSelectedShapes().filter((shape) => shape.type === "frame");
      if (frames.length === 0) return;
      editor.updateShapes(
        frames.map((shape) => ({
          id: shape.id,
          type: "frame" as const,
          props: { color: value as TLDefaultColorStyle }
        }))
      );
      setSelectedShape(inspectSelection(editor));
      return;
    }
    const shapes = editor.getSelectedShapes().filter((shape) => shape.type === "geo");
    if (shapes.length === 0) return;
    editor.updateShapes(shapes.map((shape) => ({ id: shape.id, type: "geo" as const, props: { [property]: value } })));
    setSelectedShape(inspectSelection(editor));
  };

  const handleTextStyle = (property: "font" | "size" | "weight" | "textAlign", value: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const texts = editor.getSelectedShapes().filter((shape) => shape.type === "text");
    if (texts.length === 0) return;
    editor.updateShapes(
      texts.map((shape) => ({
        id: shape.id,
        type: "text" as const,
        props:
          property === "weight"
            ? { richText: setRichTextWeight(shape.props.richText, value === "bold" ? "bold" : "regular") }
            : { [property]: value }
      })) as Parameters<Editor["updateShapes"]>[0]
    );
    setSelectedShape(inspectSelection(editor));
  };

  const handleOpenFile = () => {
    setImportNotice(undefined);
    if (hostState.host === "vscode" && hostState.workspaceTrusted) {
      importProject();
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 24_000_000) {
      setImportNotice("The selected Studio project exceeds the supported file size.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportNotice("Choose a Studio project JSON file.");
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      setImportNotice("The editor is still starting. Try Open file again.");
      return;
    }
    try {
      const imported = parseImportedStudioProject(await file.text());
      editor.loadSnapshot(JSON.parse(imported.snapshot) as Parameters<Editor["loadSnapshot"]>[0]);
      projectIdRef.current = null;
      projectWritableRef.current = false;
      setActiveProjectId(null);
      projectTitleRef.current = imported.title;
      setProjectTitle(imported.title);
      editor.renamePage(editor.getCurrentPageId(), imported.title);
      setProjectSaveStatus("Imported into this browser session. It is not saved to a workspace.");
      setImportNotice(undefined);
      const pageId = String(editor.getCurrentPageId());
      routedProjectRef.current = pageId;
      navigateRoute({ name: "project", projectId: pageId });
      refreshCanvases(editor, true);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "The selected file is not a supported Studio project.");
    }
  };

  const handleOpenProject = (projectId: string) => {
    if (projectId !== projectIdRef.current) persistProjectNow();
    routedProjectRef.current = null;
    navigateRoute({ name: "project", projectId });
  };

  const showEditor = () => {
    const projectId = hostState.host === "vscode" || isStandaloneHost ? projectIdRef.current : currentCanvasId;
    if (!projectId) return;
    routedProjectRef.current = projectId;
    navigateRoute({ name: "project", projectId });
  };

  useEffect(() => {
    if (route.name !== "project") routedProjectRef.current = null;
  }, [route.name]);

  useEffect(() => {
    if (route.name !== "home") return;
    const editor = editorRef.current;
    if (!editor) return;
    let cancelled = false;
    const projectId = hostState.host === "vscode" || isStandaloneHost ? projectIdRef.current : null;
    const originalPageId = editor.getCurrentPageId();
    const capture = async () => {
      if (projectId) {
        const url = await captureProjectThumbnail(editor, projectId);
        if (!cancelled && url) setThumbnailUrls((current) => ({ ...current, [projectId]: url }));
        return;
      }
      const pages = [...editor.getPages()];
      const captured: Record<string, string> = {};
      for (const page of pages) {
        if (cancelled) return;
        editor.setCurrentPage(page);
        const url = await captureProjectThumbnail(editor, String(page.id));
        if (url) captured[String(page.id)] = url;
      }
      if (!cancelled && editor.getCurrentPageId() !== originalPageId) editor.setCurrentPage(originalPageId);
      if (!cancelled && Object.keys(captured).length) {
        setThumbnailUrls((current) => ({ ...current, ...captured }));
      }
    };
    void capture();
    return () => {
      cancelled = true;
    };
  }, [route.name, hostState.host, currentCanvasId]);

  useEffect(() => {
    if (route.name !== "project" || route.projectId === projectIdRef.current) return;
    if (routedProjectRef.current === route.projectId) return;
    if (hostState.host === "vscode") {
      if (!hostState.workspaceTrusted) {
        setProjectSaveStatus("Trust a local workspace to open this project.");
        return;
      }
      routedProjectRef.current = route.projectId;
      persistProjectNow();
      setProjectSaveStatus("Opening…");
      openProject(route.projectId);
      return;
    }
    if (isStandaloneHost && isProjectUuid(route.projectId)) {
      if (!editorReady) return;
      routedProjectRef.current = route.projectId;
      if (projectIdRef.current && projectIdRef.current !== route.projectId) persistProjectNow();
      setProjectSaveStatus("Opening…");
      void openStandaloneProject(route.projectId)
        .then((project) => {
          if (routedProjectRef.current !== project.id) return;
          projectIdRef.current = project.id;
          projectWritableRef.current = false;
          setActiveProjectId(project.id);
          projectTitleRef.current = project.title;
          pendingSnapshotRef.current = JSON.parse(project.snapshot) as unknown;
          setProjectTitle(project.title);
          setProjectSaveStatus("Saved");
          setEditorGeneration((generation) => generation + 1);
          refreshProjectLibrary();
        })
        .catch((error: unknown) => {
          if (routedProjectRef.current !== route.projectId) return;
          setProjectSaveStatus(error instanceof Error ? error.message : "Could not open project");
        });
      return;
    }
    if (!editorReady) return;
    routedProjectRef.current = route.projectId;
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === route.projectId);
    if (!editor || !page) {
      setProjectSaveStatus("This link does not match a project in this browser session.");
      return;
    }
    shouldAutoFitRef.current = true;
    editor.setCurrentPage(page);
    projectTitleRef.current = page.name;
    setProjectTitle(page.name);
    setProjectSaveStatus("Browser session only");
    setZoomLevel(fitCurrentFrame(editor));
    refreshCanvases(editor);
  }, [
    route,
    hostState.host,
    hostState.workspaceTrusted,
    editorReady,
    openProject,
    persistProjectNow,
    isStandaloneHost,
    refreshProjectLibrary
  ]);

  const handleRenameCanvas = (canvasId: string, title: string) => {
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === canvasId);
    const nextTitle = title.trim();
    if (!editor || !page || isSessionScratchpad(page) || !nextTitle || nextTitle.length > 120) return;
    editor.renamePage(page.id, nextTitle);
    if (String(editor.getCurrentPageId()) === canvasId) {
      projectTitleRef.current = nextTitle;
      setProjectTitle(nextTitle);
    }
    refreshCanvases(editor, true);
  };

  const handleDuplicateCanvas = (canvasId: string) => {
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === canvasId);
    if (!editor || !page) return;
    const newId = `page:${crypto.randomUUID().replace(/-/g, "")}` as TLPageId;
    editor.duplicatePage(page.id, newId);
    const created = editor.getPage(newId);
    if (created) {
      if (isSessionScratchpad(page))
        editor.updatePage({ id: created.id, meta: { ...created.meta, studioScratchpad: false } });
      editor.setCurrentPage(created);
      projectTitleRef.current = created.name;
      setProjectTitle(created.name);
    }
    refreshCanvases(editor, true);
  };

  const handleDeleteCanvas = (canvasId: string) => {
    const editor = editorRef.current;
    if (!editor || editor.getPages().length < 2) return;
    const page = editor.getPages().find((candidate) => String(candidate.id) === canvasId);
    if (!page || isSessionScratchpad(page)) return;
    const wasCurrent = String(editor.getCurrentPageId()) === canvasId;
    editor.deletePage(page.id);
    if (wasCurrent) {
      const next = editor.getCurrentPage();
      projectTitleRef.current = next.name;
      setProjectTitle(next.name);
      setZoomLevel(fitCurrentFrame(editor));
      if (route.name === "project" && route.projectId === canvasId) {
        const nextId = String(next.id);
        routedProjectRef.current = nextId;
        navigateRoute({ name: "project", projectId: nextId });
      }
    }
    refreshCanvases(editor, false);
  };

  const handleDuplicateProject = (projectId: string) => {
    if (isStandaloneHost) {
      void duplicateStandaloneProject(projectId)
        .then((project) => {
          refreshProjectLibrary();
          handleOpenProject(project.id);
        })
        .catch((error: unknown) =>
          setProjectSaveStatus(error instanceof Error ? error.message : "Project could not be duplicated.")
        );
      return;
    }
    duplicateProject(projectId);
  };

  const handleDeleteProject = (projectId: string) => {
    if (isStandaloneHost) {
      const project = projectLibraryState.projects.find((candidate) => candidate.id === projectId);
      const title = project?.title ?? "this project";
      if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
      if (projectId === projectIdRef.current) persistProjectNow();
      void deleteStandaloneProject(projectId)
        .then(() => {
          refreshProjectLibrary();
          removeProjectThumbnail(projectId);
          setThumbnailUrls(readProjectThumbnails());
          if (projectId === projectIdRef.current) {
            projectIdRef.current = null;
            projectWritableRef.current = false;
            setActiveProjectId(null);
            navigateRoute({ name: "home" });
          }
          setProjectSaveStatus("Project deleted");
        })
        .catch((error: unknown) =>
          setProjectSaveStatus(error instanceof Error ? error.message : "Project could not be deleted.")
        );
      return;
    }
    if (projectId === projectIdRef.current) persistProjectNow();
    deleteProject(projectId);
  };

  const handleRenameProject = (projectId: string, title: string) => {
    if (!title.trim()) return;
    if (projectId === projectIdRef.current) {
      projectTitleRef.current = title.trim();
      setProjectTitle(title.trim());
      editorRef.current?.renamePage(editorRef.current.getCurrentPageId(), title.trim());
      window.clearTimeout(saveTimerRef.current);
    }
    if (isStandaloneHost) {
      void renameStandaloneProject(projectId, title.trim())
        .then(() => refreshProjectLibrary())
        .catch((error: unknown) =>
          setProjectSaveStatus(error instanceof Error ? error.message : "Project could not be renamed.")
        );
      return;
    }
    renameProject(projectId, title.trim());
  };

  const handleZoomIn = () => {
    shouldAutoFitRef.current = false;
    editorRef.current?.zoomIn();
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel());
  };

  const handleZoomOut = () => {
    shouldAutoFitRef.current = false;
    editorRef.current?.zoomOut();
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel());
  };

  const handleZoomCommand = (command: ZoomCommand) => {
    const editor = editorRef.current;
    if (!editor) return;
    shouldAutoFitRef.current = false;
    const scale = zoomScale(command);
    if (scale !== null) {
      const camera = editor.getCamera();
      editor.setCamera({ x: camera.x, y: camera.y, z: scale });
    } else if (command === "fit") {
      fitCurrentFrame(editor);
    } else if (editor.getSelectedShapeIds().length > 0) {
      editor.zoomToSelection();
    }
    setZoomLevel(editor.getZoomLevel());
  };

  const handlePresentFrame = () => {
    const editor = editorRef.current;
    const frame = editor?.getSelectedShapes().find((shape) => shape.type === "frame");
    if (!editor || !frame) return;
    const bounds = editor.getShapePageBounds(frame.id);
    if (!bounds) return;
    editor.centerOnPoint({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 });
    editor.zoomToBounds(bounds, { inset: 24 });
    setZoomLevel(editor.getZoomLevel());
    const canvas = document.querySelector(".studio-canvas");
    if (canvas instanceof HTMLElement && document.fullscreenElement !== canvas) {
      void canvas.requestFullscreen().catch(() => undefined);
    }
  };

  const paletteCommands: PaletteCommand[] = [
    { id: "tool:select", group: "Tools", label: "Select", keywords: "v" },
    { id: "tool:hand", group: "Tools", label: "Hand", keywords: "h" },
    { id: "tool:frame", group: "Tools", label: "Frame", keywords: "f" },
    { id: "tool:rectangle", group: "Tools", label: "Rectangle", keywords: "r" },
    { id: "tool:ellipse", group: "Tools", label: "Ellipse", keywords: "o" },
    { id: "tool:draw", group: "Tools", label: "Pen", keywords: "p" },
    { id: "tool:text", group: "Tools", label: "Text", keywords: "t" },
    { id: "tool:note", group: "Tools", label: "Sticky", keywords: "n" },
    { id: "action:export", group: "Actions", label: "Export project", keywords: "download" },
    { id: "action:home", group: "Actions", label: "All files", keywords: "home" },
    { id: "action:panels", group: "Actions", label: "Toggle panels", keywords: "sidebar" },
    ...canvases.map((canvas) => ({
      id: `project:${canvas.id}`,
      group: "Projects" as const,
      label: canvas.title,
      keywords: "page"
    }))
  ];

  const runPaletteCommand = (id: string) => {
    const editor = editorRef.current;
    if (id.startsWith("tool:") && editor) {
      const tool = id.slice("tool:".length);
      if (tool === "rectangle" || tool === "ellipse") {
        editor.setStyleForNextShapes(GeoShapeGeoStyle, tool === "rectangle" ? "rectangle" : "ellipse");
        editor.setCurrentTool("geo");
      } else {
        editor.setCurrentTool(tool);
      }
      return;
    }
    if (id === "action:export") handleExportProject();
    if (id === "action:home") navigateRoute({ name: "home" });
    if (id === "action:panels") {
      const show = !(isAgentSidebarOpen || isInspectorOpen);
      setAgentSidebarOpen(show);
      setInspectorOpen(show);
    }
    if (id.startsWith("project:")) handleOpenCanvas(id.slice("project:".length));
  };

  return (
    <div className="studio-app" data-theme={theme}>
      {/* Keep the canvas mounted across routes, but remove it from interaction outside a project. */}
      <div
        ref={workspaceRef}
        className="studio-workspace"
        hidden={route.name !== "project"}
        inert={route.name !== "project"}
        aria-hidden={route.name !== "project"}
      >
        {/* Conversation and canvas utility tabs share one resizable left panel. */}
        {isAgentSidebarOpen && (
          <StudioLeftPanel
            panelCollapsed={isAgentPanelCollapsed}
            onPanelCollapsedChange={setAgentPanelCollapsed}
            onOpenPage={handleOpenCanvas}
            onDeletePage={handleDeleteCanvas}
            draftPrefill={draftPrefill}
            draftImagePrefill={draftImagePrefill}
            onClose={() => setAgentSidebarOpen(false)}
            connectionHost={hostState.host}
            connection={hostState.connection}
            workspaceTrusted={hostState.workspaceTrusted}
            modelCatalog={modelCatalog}
            chatRun={chatRun}
            toolCalls={toolCalls}
            panelWidth={chatPanelWidth}
            panelHeight={effectiveChatPanelHeight}
            onConnectionAction={onConnectionAction}
            onRefreshModels={requestModelCatalog}
            onSendChat={sendChat}
            onCancelChat={cancelChat}
            onClearChatRun={clearChatRun}
            onApproveToolCall={approveToolCall}
            onRejectToolCall={rejectToolCall}
            onPersistConversation={(conversation) => {
              const target = conversationHostTarget(conversation.id);
              if (!target) return;
              void fetch(`/api/projects/${target.projectId}/conversations`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ...conversation, projectId: target.projectId })
              });
            }}
            onRenameConversation={(id, title) => {
              const target = conversationHostTarget(id);
              if (!target) return;
              void fetch(`${target.url}/rename`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ title })
              });
            }}
            onDeleteConversation={(id) => {
              const target = conversationHostTarget(id);
              if (!target) return;
              void fetch(`${target.url}/delete`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ confirm: true })
              });
            }}
            projectId={activeProjectId}
            onSessionsChange={setAgentSessions}
            onOpenVectorDialog={() => setVectorDialogOpen(true)}
            editor={canvasEpoch >= 0 ? editorRef.current : null}
          />
        )}
        {isAgentSidebarOpen && !isAgentPanelCollapsed && (
          <PanelResizer
            panel="chat"
            compact={isCompactViewport}
            size={isCompactViewport ? effectiveChatPanelHeight : chatPanelWidth}
            maximum={getPanelSizeRange("chat", isCompactViewport ? "height" : "width", workspaceHeight).maximum}
            onPointerDown={(event) => beginPanelResize("chat", event)}
            onKeyDown={(event) => handlePanelResizeKey("chat", event)}
          />
        )}

        {/* Central Infinite Canvas Container */}
        <div
          className="studio-canvas"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("text/plain")) event.preventDefault();
          }}
          onPaste={(event) => {
            const file = [...event.clipboardData.files].find(
              (item) =>
                /^(image\/(?:png|jpeg)|image\/svg\+xml)$/.test(item.type) || /\.(png|jpe?g|svg)$/i.test(item.name)
            );
            if (!file || !editorRef.current) return;
            event.preventDefault();
            void placeFileOnCanvas(editorRef.current, file);
          }}
          onDrop={(event) => {
            const file = [...event.dataTransfer.files].find(
              (item) =>
                /^(image\/(?:png|jpeg)|image\/svg\+xml)$/.test(item.type) || /\.(png|jpe?g|svg)$/i.test(item.name)
            );
            if (file && editorRef.current) {
              event.preventDefault();
              void placeFileOnCanvas(editorRef.current, file);
              return;
            }
            const payload = decodeAssetDrag(event.dataTransfer.getData("text/plain"));
            const editor = editorRef.current;
            if (!payload || !editor) return;
            event.preventDefault();
            const point = editor.screenToPage({ x: event.clientX, y: event.clientY });
            placeCanvasAsset(editor, payload, point);
          }}
        >
          <StudioWindowBar
            projectTitle={projectTitle}
            saveStatus={projectSaveStatus}
            theme={theme}
            onCycleTheme={handleCycleTheme}
            onTitleChange={handleTitleChange}
            onOpenFile={handleOpenFile}
            onDuplicate={handleDuplicateCurrent}
            onExport={handleExportProject}
            onDelete={handleDeleteCurrent}
            canDelete={canDeleteCurrent}
            onRetrySave={persistProjectNow}
            isHome={false}
            onShowHome={() => navigateRoute({ name: "home" })}
            isAgentSidebarOpen={isAgentSidebarOpen}
            onToggleAgentSidebar={handleToggleAgentSidebar}
            isInspectorOpen={isInspectorOpen}
            onToggleInspector={handleToggleInspector}
            canPresent={selectedShape?.type === "frame" && selectedShape.count === 1}
            onPresent={handlePresentFrame}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomCommand={handleZoomCommand}
            canZoomSelection={(selectedShape?.count ?? 0) > 0}
            canManageConnection={hostState.host === "vscode" && hostState.workspaceTrusted}
            connected={hostState.connection.status === "connected"}
            onConnectionAction={onConnectionAction}
            agentSessions={agentSessions}
            onStopAgent={() => {
              if (chatRun && (chatRun.status === "streaming" || chatRun.status === "stopping"))
                cancelChat(chatRun.requestId);
            }}
          />
          <StudioToolbar
            editor={editorReady ? editorRef.current : null}
            onImportAsset={() => assetInputRef.current?.click()}
            onTraceAsset={() => setVectorDialogOpen(true)}
          />
          {vectorDialogOpen && (
            <VectorAssetDialog
              onClose={() => setVectorDialogOpen(false)}
              onTrace={(file, preset, signal) => traceImageFileLocally(file, preset, signal)}
              onInsert={async (svg, name) => {
                const editor = editorRef.current;
                if (!editor) throw new Error("The editor is still starting. Try again.");
                await placeFileOnCanvas(editor, svgTextToFile(svg, name));
              }}
            />
          )}
          {canvasProposal && (
            <ProposalBar
              proposal={canvasProposal}
              onApply={() => {
                const editor = editorRef.current;
                if (!editor) return;
                applyProposal(editor as unknown as Parameters<typeof applyProposal>[0], canvasProposal);
                setCanvasProposal(null);
              }}
              onReject={() => setCanvasProposal(null)}
            />
          )}

          {/* Tldraw Canvas with default UI disabled */}
          <div className="studio-canvas-content">
            <StudioCanvasMenu
              editor={editorReady ? editorRef.current : null}
              onAskAboutSelection={(summary: string) => {
                setDraftPrefill({ id: crypto.randomUUID(), text: capCanvasSummary(summary) });
                setAgentSidebarOpen(true);
              }}
              onNotice={setImportNotice}
            >
              <div
                className="studio-canvas-editor"
                role="region"
                aria-label="Canvas"
                onPointerDownCapture={(event) => {
                  // Selecting or editing a shape does not change the user's viewport.
                  // Keep the artboard fitted when a dock opens after an ordinary click.
                  if (editorRef.current?.getCurrentToolId() === "hand" || event.button === 1)
                    shouldAutoFitRef.current = false;
                }}
                onWheelCapture={() => {
                  shouldAutoFitRef.current = false;
                }}
              >
                <Tldraw
                  key={editorGeneration}
                  assetUrls={tldrawAssetUrls}
                  hideUi={true}
                  colorScheme="light"
                  {...(tldrawLicenseKey ? { licenseKey: tldrawLicenseKey } : {})}
                  {...(isStandaloneHost ? { assets: createHostAssetStore() } : {})}
                  shapeUtils={customShapeUtils}
                  onMount={handleMount}
                />
              </div>
            </StudioCanvasMenu>
          </div>
        </div>

        {/* Right Inspector & Blender 3D Bridge */}
        {isInspectorOpen && (
          <PanelResizer
            panel="inspector"
            compact={isCompactViewport}
            size={isCompactViewport ? effectiveInspectorPanelHeight : inspectorPanelWidth}
            maximum={getPanelSizeRange("inspector", isCompactViewport ? "height" : "width", workspaceHeight).maximum}
            onPointerDown={(event) => beginPanelResize("inspector", event)}
            onKeyDown={(event) => handlePanelResizeKey("inspector", event)}
          />
        )}
        {isInspectorOpen && (
          <StudioInspector
            className="studio-inspector"
            isOpen={isInspectorOpen}
            onClose={() => setInspectorOpen(false)}
            selectedShape={selectedShape}
            page={pageProperties}
            onUpdate={handleInspectorUpdate}
            onPageChange={handlePageChange}
            onFramePreset={handleFramePreset}
            onTextStyle={handleTextStyle}
            onShapeStyle={handleShapeStyle}
            onExport={handleExportProject}
            panelWidth={inspectorPanelWidth}
            panelHeight={effectiveInspectorPanelHeight}
          />
        )}
      </div>

      {route.name !== "home" && route.name !== "project" && (route.name !== "gallery" || !DevGallery) && (
        <StudioRouteNotice route={route} onHome={() => navigateRoute({ name: "home" })} />
      )}

      {route.name === "gallery" && DevGallery && (
        <React.Suspense fallback={<div role="status">Loading component gallery…</div>}>
          <DevGallery />
        </React.Suspense>
      )}

      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="Import Studio project JSON"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void handleImportFile(file);
        }}
      />
      <input
        ref={traceInputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Choose an image to trace locally"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void openLocalAsset(file, "trace");
        }}
      />
      <input
        ref={screenshotInputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Choose a screenshot to place on the canvas"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void openLocalAsset(file, "screenshot");
        }}
      />
      <input
        ref={assetInputRef}
        className="sr-only"
        type="file"
        accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,.svg"
        aria-label="Import an SVG or image"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void openLocalAsset(file, "import");
        }}
      />
      <StudioCommandPalette
        open={paletteOpen && route.name === "project"}
        commands={paletteCommands}
        onClose={() => setPaletteOpen(false)}
        onRun={runPaletteCommand}
      />
      {route.name === "home" && (
        <RecentsDashboard
          isOpen={route.name === "home"}
          canvases={canvases}
          currentCanvasId={currentCanvasId}
          projects={projectLibraryState.projects}
          projectMode={hostState.host === "vscode" || isStandaloneHost}
          projectStatus={projectLibraryState.status}
          projectMessage={projectLibraryState.message}
          corruptCount={projectLibraryState.corruptCount}
          thumbnailUrls={thumbnailUrls}
          activeProjectId={activeProjectId}
          projectActionMessage={
            projectAction?.message ?? (isStandaloneHost ? projectLibraryState.message : importNotice)
          }
          onClose={showEditor}
          onOpenCanvas={handleOpenCanvas}
          onOpenProject={handleOpenProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={
            (hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost
              ? handleRenameProject
              : undefined
          }
          onRevealProject={
            hostState.host === "vscode" && hostState.workspaceTrusted
              ? (projectId) => {
                  revealProject(projectId);
                }
              : undefined
          }
          onRenameCanvas={handleRenameCanvas}
          onDuplicateCanvas={handleDuplicateCanvas}
          onDeleteCanvas={handleDeleteCanvas}
          onRefreshProjects={refreshProjectLibrary}
          onNewCanvas={() => handleNewCanvas()}
          onOpenFile={handleOpenFile}
          onStartDesign={handleStartDesign}
          onImageToSvg={() => setVectorDialogOpen(true)}
          onRecreateScreenshot={() => screenshotInputRef.current?.click()}
          onImportAsset={() => assetInputRef.current?.click()}
        />
      )}
    </div>
  );
}

function isProjectUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function StudioRouteNotice({ route, onHome }: { route: StudioRoute; onHome: () => void }) {
  const title =
    route.name === "connectors"
      ? "Connectors"
      : route.name === "settings"
        ? "Settings"
        : route.name === "gallery"
          ? "Gallery"
          : "Page not found";
  const message =
    route.name === "connectors"
      ? "IDE connectors are not available in this build yet. Studio is not listening for Codex, Claude Code, Cursor, WorkBuddy, or Qoder."
      : route.name === "settings"
        ? "Settings are not available in this build yet. API keys stay in the host and are not entered on this page."
        : route.name === "gallery"
          ? "The component gallery is available only in a development build."
          : "This address is not a Studio page.";
  return (
    <section className="studio-route-page" aria-labelledby="studio-route-title">
      <h1 id="studio-route-title">{title}</h1>
      <p>{message}</p>
      <button className="studio-route-page__home" type="button" onClick={onHome}>
        Go to Home
      </button>
    </section>
  );
}

function PanelResizer({
  panel,
  compact,
  size,
  maximum,
  onPointerDown,
  onKeyDown
}: {
  panel: ResizablePanel;
  compact: boolean;
  size: number;
  maximum: number;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
}) {
  const axis: PanelSizeAxis = compact ? "height" : "width";
  const range = getPanelSizeRange(panel, axis);
  const label = panel === "chat" ? "conversation" : "inspector";
  return (
    <div
      className={`studio-panel-resizer studio-panel-resizer--${panel}`}
      role="separator"
      aria-label={`Resize ${label} panel`}
      aria-controls={panel === "chat" ? "studio-agent-sidebar" : "studio-inspector"}
      aria-orientation={compact ? "horizontal" : "vertical"}
      aria-valuemin={range.minimum}
      aria-valuemax={maximum}
      aria-valuenow={size}
      aria-valuetext={`${size} pixels`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}

export default App;

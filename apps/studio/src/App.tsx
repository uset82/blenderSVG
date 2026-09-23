import React, { useEffect, useRef, useState } from "react";
import { type Editor, type TLPageId, Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import "./styles/studio.css";
import { useStudioHost } from "./bridge/studioHost.js";
import { AgentHarnessSidebar } from "./components/AgentHarnessSidebar.js";
import { summarizeShapeSelection } from "./components/inspectorSelection.js";
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
  removeProjectThumbnail
} from "./components/projectThumbnail.js";
import { readCanvasTimes, rememberCanvasTimes, stampCanvasTimes } from "./components/recentCanvas.js";
import { RecentsDashboard, SCRATCHPAD_PROJECT_ID, type SessionCanvas } from "./components/RecentsDashboard.js";
import { HOME_CATEGORY_PRESETS } from "./components/StudioComposer.js";
import { type GeometryProperty, type InspectedShape, StudioInspector } from "./components/StudioInspector.js";
import { StudioToolbar } from "./components/StudioToolbar.js";
import { StudioWindowBar } from "./components/StudioWindowBar.js";
import { parseImportedStudioProject } from "./projects/importProjectFile.js";
import {
  assertChatImageAttachment,
  imageFileToTracePng,
  placeFileOnCanvas,
  readSanitizedSvgFile,
  svgTextToFile,
  traceImageFileLocally
} from "./projects/localAssets.js";
import { type StudioRoute, useStudioRoute } from "./router/studioRoute.js";
import { AvatarShapeUtil } from "./shapes/AvatarCanvasShape.js";
import { BlenderConnectorShapeUtil } from "./shapes/BlenderConnectorCanvasShape.js";
import { VectorStudioShapeUtil } from "./shapes/VectorStudioCanvasShape.js";
import { tldrawAssetUrls } from "./tldrawAssets.js";

const customShapeUtils = [AvatarShapeUtil, VectorStudioShapeUtil, BlenderConnectorShapeUtil];
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
      props: shape.props as { w?: unknown; h?: unknown }
    }))
  );
}

export function App() {
  const {
    hostState,
    modelCatalog,
    chatRun,
    projects,
    projectAction,
    onConnectionAction,
    requestModelCatalog,
    sendChat,
    traceImage,
    cancelChat,
    clearChatRun,
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
  const editorRef = useRef<Editor | null>(null);
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
  const [theme, setTheme] = useState<StudioTheme>(readStudioTheme);
  const [editorReady, setEditorReady] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [activeTool, setActiveTool] = useState("select");
  const [route, navigateRoute] = useStudioRoute();
  const routedProjectRef = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const traceInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | undefined>(undefined);
  const [activeSidePanel, setActiveSidePanel] = useState<"chat" | "inspector" | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedShape, setSelectedShape] = useState<InspectedShape | null>(null);
  const [chatPanelWidth, setChatPanelWidth] = useState(() => readPanelSize("chat", "width"));
  const [chatPanelHeight, setChatPanelHeight] = useState(() => readPanelSize("chat", "height"));
  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(() => readPanelSize("inspector", "width"));
  const [inspectorPanelHeight, setInspectorPanelHeight] = useState(() => readPanelSize("inspector", "height"));
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 900);
  const [workspaceHeight, setWorkspaceHeight] = useState(() => Math.max(0, window.innerHeight - 44));
  const [canvases, setCanvases] = useState<SessionCanvas[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState(readProjectThumbnails);
  const [draftPrefill, setDraftPrefill] = useState<{ id: string; text: string } | null>(null);
  const [draftImagePrefill, setDraftImagePrefill] = useState<{ id: string; file: File } | null>(null);
  const isAgentSidebarOpen = activeSidePanel === "chat";
  const isInspectorOpen = activeSidePanel === "inspector";
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
    if (
      hostState.host !== "vscode" ||
      !hostState.workspaceTrusted ||
      !editor ||
      !projectId ||
      !projectWritableRef.current
    )
      return;
    try {
      const snapshot = JSON.stringify(editor.getSnapshot());
      if (!snapshot) throw new Error("Snapshot serialization failed.");
      setProjectSaveStatus("Saving…");
      saveProject(projectId, projectTitleRef.current, snapshot);
    } catch {
      setProjectSaveStatus("Save failed");
    }
  }, [hostState.host, hostState.workspaceTrusted, saveProject]);

  const scheduleProjectSaveRef = useRef<() => void>(() => undefined);
  const scheduleProjectSave = React.useCallback(() => {
    if (
      hostState.host !== "vscode" ||
      !hostState.workspaceTrusted ||
      !projectIdRef.current ||
      !projectWritableRef.current
    )
      return;
    window.clearTimeout(saveTimerRef.current);
    setProjectSaveStatus("Saving…");
    saveTimerRef.current = window.setTimeout(persistProjectNow, 650);
  }, [hostState.host, hostState.workspaceTrusted, persistProjectNow]);

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
    const updateViewportMode = () => setIsCompactViewport(window.innerWidth <= 900);
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
      title: page.name
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
    setCanvases(pages.map((page) => ({
      ...page,
      createdAt: kept[page.id]?.createdAt ?? fallback,
      updatedAt: kept[page.id]?.updatedAt ?? fallback
    })));
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
    stopStoreListenerRef.current = editor.store.listen(() => {
      scheduleProjectSaveRef.current();
      window.clearTimeout(stampCanvasTimerRef.current);
      stampCanvasTimerRef.current = window.setTimeout(() => {
        const current = editorRef.current;
        if (current) refreshCanvasesRef.current(current, true);
      }, 500);
    }, { scope: "document" });
    stopInspectorListenerRef.current?.();
    stopInspectorListenerRef.current = editor.store.listen(() => setSelectedShape(inspectSelection(editor)), {
      scope: "document"
    });
    requestAnimationFrame(() => requestAnimationFrame(() => setZoomLevel(fitCurrentFrame(editor))));
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

  const handleOpenCanvas = (canvasId: string) => {
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === canvasId);
    if (!editor || !page) return;
    shouldAutoFitRef.current = true;
    editor.setCurrentPage(page);
    setZoomLevel(fitCurrentFrame(editor));
    projectTitleRef.current = page.name;
    setProjectTitle(page.name);
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
    if (hostState.host === "vscode" && hostState.workspaceTrusted) {
      persistProjectNow();
      const title = "Untitled";
      const nextProjectId = crypto.randomUUID();
      projectIdRef.current = nextProjectId;
      projectWritableRef.current = true;
      projectTitleRef.current = title;
      setActiveProjectId(nextProjectId);
      setProjectTitle(title);
      const previousPages = [...editor.getPages()];
      editor.createPage({ name: title });
      const newPage = editor.getPages().find((page) => !previousPages.some((previous) => previous.id === page.id));
      if (!newPage) return;
      editor.setCurrentPage(newPage);
      for (const page of previousPages) {
        editor.setCurrentPage(page);
        const shapes = editor.getCurrentPageShapes();
        if (shapes.length) editor.deleteShapes(shapes.map((shape) => shape.id));
        editor.setCurrentPage(newPage);
        editor.deletePage(page.id);
      }
      editor.setCurrentPage(newPage);
      editor.clearHistory();
      const center = editor.getViewportPageBounds().center;
      editor.createShape({
        type: "frame",
        x: center.x - frameWidth / 2,
        y: center.y - frameHeight / 2,
        props: { w: frameWidth, h: frameHeight, name: "Frame" }
      });
      setZoomLevel(fitCurrentFrame(editor));
      refreshCanvases(editor, true);
      scheduleProjectSave();
      routedProjectRef.current = nextProjectId;
      navigateRoute({ name: "project", projectId: nextProjectId });
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
    setActiveSidePanel("chat");
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
        setProjectSaveStatus(hostState.host === "vscode" ? "Traced locally with VTracer. Nothing was uploaded." : "Traced locally in this browser preview. Nothing was uploaded.");
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
        setActiveSidePanel("chat");
        setProjectSaveStatus("Screenshot added locally. It will only be sent after you review and confirm the request.");
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

  const handleToggleAgentSidebar = () => setActiveSidePanel((current) => (current === "chat" ? null : "chat"));
  const handleToggleInspector = () => setActiveSidePanel((current) => (current === "inspector" ? null : "inspector"));
  const handleCycleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : current === "light" ? "contrast" : "dark"));

  const handleInspectorUpdate = (property: GeometryProperty, value: number) => {
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
      if (property === "x" || property === "y") return { ...identity, [property]: value };
      const dimension = property === "width" ? "w" : "h";
      if (typeof (shape.props as { w?: unknown; h?: unknown })[dimension] !== "number") return [];
      return { ...identity, props: { [dimension]: value } };
    });
    if (updates.length === 0) return;
    editor.updateShapes(updates as Parameters<Editor["updateShapes"]>[0]);
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
    const projectId = hostState.host === "vscode" ? projectIdRef.current : currentCanvasId;
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
    const projectId = hostState.host === "vscode" ? projectIdRef.current : null;
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
    setZoomLevel(fitCurrentFrame(editor));
    refreshCanvases(editor);
  }, [route, hostState.host, hostState.workspaceTrusted, editorReady, openProject, persistProjectNow]);

  const handleRenameCanvas = (canvasId: string, title: string) => {
    const editor = editorRef.current;
    const page = editor?.getPages().find((candidate) => String(candidate.id) === canvasId);
    const nextTitle = title.trim();
    if (!editor || !page || !nextTitle || nextTitle.length > 120) return;
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
    if (!page) return;
    const wasCurrent = String(editor.getCurrentPageId()) === canvasId;
    editor.deletePage(page.id);
    if (wasCurrent) {
      const next = editor.getCurrentPage();
      projectTitleRef.current = next.name;
      setProjectTitle(next.name);
    }
    refreshCanvases(editor, false);
  };

  const handleDuplicateProject = (projectId: string) => {
    duplicateProject(projectId);
  };

  const handleDeleteProject = (projectId: string) => {
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
    renameProject(projectId, title.trim());
  };

  const handleAddShape = (type: "frame" | "avatar" | "vector-studio" | "blender-connector" | "geo" | "text") => {
    const editor = editorRef.current;
    if (!editor) return;

    const center = editor.getViewportPageBounds().center;

    if (type === "frame") {
      editor.createShape({
        type: "frame",
        x: center.x - 450,
        y: center.y - 300,
        props: { w: 900, h: 600, name: "Frame" }
      });
    } else if (type === "geo") {
      editor.createShape({
        type: "geo",
        x: center.x - 100,
        y: center.y - 100,
        props: { w: 200, h: 200, geo: "rectangle", color: "blue", fill: "solid" }
      });
    } else if (type === "text") {
      editor.createShape({
        type: "text",
        x: center.x - 100,
        y: center.y - 20,
        props: { text: "New Canvas Text" } as any
      });
    }
  };

  const handleSelectTool = (tool: string) => {
    if (tool === "select" || tool === "hand" || tool === "draw") {
      editorRef.current?.setCurrentTool(tool);
      setActiveTool(tool);
    }
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

  const handleZoomReset = () => {
    shouldAutoFitRef.current = false;
    editorRef.current?.resetZoom();
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel());
  };

  return (
    <div className="studio-app" data-theme={theme}>
      {route.name === "project" && (
        <StudioWindowBar
          projectTitle={projectTitle}
          saveStatus={projectSaveStatus}
          theme={theme}
          onCycleTheme={handleCycleTheme}
          onTitleChange={handleTitleChange}
          isHome={false}
          onShowHome={() => navigateRoute({ name: "home" })}
          isAgentSidebarOpen={isAgentSidebarOpen}
          onToggleAgentSidebar={handleToggleAgentSidebar}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={handleToggleInspector}
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
      )}

      {/* Keep the canvas mounted across routes, but remove it from interaction outside a project. */}
      <div
        ref={workspaceRef}
        className="studio-workspace"
        hidden={route.name !== "project"}
        inert={route.name !== "project"}
        aria-hidden={route.name !== "project"}
      >
        {/* Agent conversation */}
        <AgentHarnessSidebar
          className="studio-agent-sidebar"
          isOpen={isAgentSidebarOpen}
          draftPrefill={draftPrefill}
          draftImagePrefill={draftImagePrefill}
          onClose={() => setActiveSidePanel(null)}
          connectionHost={hostState.host}
          connection={hostState.connection}
          workspaceTrusted={hostState.workspaceTrusted}
          modelCatalog={modelCatalog}
          chatRun={chatRun}
          panelWidth={chatPanelWidth}
          panelHeight={effectiveChatPanelHeight}
          onConnectionAction={onConnectionAction}
          onRefreshModels={requestModelCatalog}
          onSendChat={sendChat}
          onCancelChat={cancelChat}
          onClearChatRun={clearChatRun}
        />
        {isAgentSidebarOpen && (
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
        <div className="studio-canvas">
          {/* Floating Canvas Toolbar */}
          <StudioToolbar activeTool={activeTool} onSelectTool={handleSelectTool} onAddShape={handleAddShape} />

          {/* Tldraw Canvas with default UI disabled */}
          <div className="studio-canvas-content">
            <div
              className="studio-canvas-editor"
              onPointerDownCapture={(event) => {
                // Selecting or editing a shape does not change the user's viewport.
                // Keep the artboard fitted when a dock opens after an ordinary click.
                if (activeTool === "hand" || event.button === 1) shouldAutoFitRef.current = false;
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
                shapeUtils={customShapeUtils}
                onMount={handleMount}
              />
            </div>
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
            onClose={() => setActiveSidePanel(null)}
            selectedShape={selectedShape}
            onUpdate={handleInspectorUpdate}
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
      {route.name === "home" && (
        <RecentsDashboard
          isOpen={route.name === "home"}
          canvases={canvases}
          currentCanvasId={currentCanvasId}
          projects={projects.projects}
          projectMode={hostState.host === "vscode"}
          projectStatus={projects.status}
          projectMessage={projects.message}
          corruptCount={projects.corruptCount}
          thumbnailUrls={thumbnailUrls}
          activeProjectId={activeProjectId}
          projectActionMessage={projectAction?.message ?? importNotice}
          onClose={showEditor}
          onOpenCanvas={handleOpenCanvas}
          onOpenProject={handleOpenProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={hostState.host === "vscode" && hostState.workspaceTrusted ? handleRenameProject : undefined}
          onRevealProject={hostState.host === "vscode" && hostState.workspaceTrusted ? (projectId) => { revealProject(projectId); } : undefined}
          onRenameCanvas={handleRenameCanvas}
          onDuplicateCanvas={handleDuplicateCanvas}
          onDeleteCanvas={handleDeleteCanvas}
          onRefreshProjects={requestProjects}
          onNewCanvas={() => handleNewCanvas()}
          onOpenFile={handleOpenFile}
          onStartDesign={handleStartDesign}
          onImageToSvg={() => traceInputRef.current?.click()}
          onRecreateScreenshot={() => screenshotInputRef.current?.click()}
          onImportAsset={() => assetInputRef.current?.click()}
        />
      )}
    </div>
  );
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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor, TLDefaultColorStyle, TLPageId, TLShapeId } from "tldraw";
import "./styles/studio.css";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { type StudioProjectsState, useStudioHost } from "./bridge/studioHost.js";
import type { AgentConversation, StoredAgentConversation } from "./components/agentConversations.js";
import { stopRunningReply } from "./components/agentSessions.js";
import { CanvasLicenseNotice } from "./components/CanvasLicenseNotice.js";
import { decodeAssetDrag, placeCanvasAsset } from "./components/canvasAssets.js";
import { applyProposal, type CanvasProposal, proposalFromTool } from "./components/canvasProposal.js";
import type { PaletteCommand } from "./components/commandPalette.js";
import { capCanvasSummary } from "./components/contextBudget.js";
import { executeCanvasTool } from "./components/executeCanvasTool.js";
import { summarizeShapeSelection } from "./components/inspectorSelection.js";
import { ProposalBar } from "./components/ProposalBar.js";
import { ProposalGhost } from "./components/ProposalGhost.js";
import {
  clampPanelSize,
  getPanelSizeRange,
  type PanelSizeAxis,
  type ResizablePanel,
  readPanelSize,
  writePanelSize
} from "./components/panelSizing.js";
import {
  cancelFrameThumbnail,
  cancelScheduledFrameThumbnails,
  captureProjectThumbnail,
  readProjectThumbnails,
  removeProjectThumbnail,
  scheduleFrameThumbnail
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
import { StudioWindowBar } from "./components/StudioWindowBar.js";
import { ensureSessionScratchpad, isSessionScratchpad } from "./components/sessionScratchpad.js";
import {
  nextStudioTheme,
  readStoredStudioTheme,
  readVsCodeTheme,
  rememberStudioTheme,
  resolveStudioTheme,
  STUDIO_THEME_PAGE_BACKGROUNDS,
  type StudioTheme
} from "./components/studioTheme.js";
import { setRichTextWeight } from "./components/textWeight.js";
import {
  keepVariantFrame,
  placeVariantFrames,
  type VariantFrameEditor,
  type VariantSession
} from "./components/variantSessions.js";
import { type ZoomCommand, zoomScale } from "./components/zoomMenu.js";
import { isBlankCanvasSnapshot } from "./projects/blankSnapshot.js";
import {
  buildStudioProjectExport,
  safeExportFileName,
  stableExportSvgIds,
  studioExportFileName
} from "./projects/exportProjectFile.js";
import { createHostAssetStore, inlineStandaloneAssetSources } from "./projects/hostAssetStore.js";
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
import { projectOpenFailureMessage } from "./projects/openFailure.js";
import { browserProjectBackend, projectLibraryKind, standaloneProjectBackend } from "./projects/projectBackend.js";
import { listStandaloneProjects, openStandaloneProject } from "./projects/standaloneProjects.js";
import { useStudioRoute } from "./router/studioRoute.js";
import { canRenderTldrawCanvas, canvasLicenseRequired, readTldrawLicenseKey } from "./tldrawLicense.js";
import { rememberPersistentStorage } from "./web/BrowserStoragePanel.js";
import { createBrowserAssetStore } from "./web/browserAssets.js";
import { inlineAssetSources, storeInlinedAssets } from "./web/browserBackup.js";
import {
  deleteBrowserConversation,
  ensureBrowserScratchpad,
  listBrowserConversations,
  listBrowserProjects,
  putBrowserThumbnail,
  readBrowserConversation,
  renameBrowserConversation,
  writeBrowserConversation
} from "./web/browserProjects.js";
import { isWebEdition, WEB_LIBRARY_STATUS } from "./web/kurvaTarget.js";
import { beginWebOpenRouterConnect, disconnectWebOpenRouter } from "./web/openRouterConnect.js";
import { assertPortableAssetSources } from "./web/portableAssets.js";
import {
  acquireProjectLock,
  listenForLockRelease,
  publishLibraryChange,
  requestProjectLockRelease,
  subscribeLibraryChanges
} from "./web/projectLock.js";
import { shouldPollMcpApi, showDesktopOnlyNotice, studioCapabilities } from "./web/studioCapabilities.js";
import { shouldOfferAppUpdate, webChatAvailability } from "./web/webShell.js";

const StudioCanvas = React.lazy(() =>
  import("./editor/StudioCanvas.js").then((module) => ({ default: module.StudioCanvas }))
);
const StudioLeftPanel = React.lazy(() =>
  import("./components/StudioLeftPanel.js").then((module) => ({ default: module.StudioLeftPanel }))
);
const StudioToolbar = React.lazy(() =>
  import("./components/StudioToolbar.js").then((module) => ({ default: module.StudioToolbar }))
);
const VectorAssetDialog = React.lazy(() =>
  import("./components/VectorAssetDialog.js").then((module) => ({ default: module.VectorAssetDialog }))
);
const StudioRouteNotice = React.lazy(() =>
  import("./routes/StudioRoutePages.js").then((module) => ({ default: module.StudioRouteNotice }))
);
const DevGallery = import.meta.env.DEV ? React.lazy(() => import("./components/ComponentGallery.js")) : null;
interface ActivePanelResize {
  panel: ResizablePanel;
  axis: PanelSizeAxis;
  pointerId: number;
  startCoordinate: number;
  startSize: number;
  direction: 1 | -1;
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
  try {
    const viewport = editor.getViewportScreenBounds();
    if (!viewport || viewport.w < 2 || viewport.h < 2) return editor.getZoomLevel();
    const frame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
    const bounds = frame ? editor.getShapePageBounds(frame.id) : undefined;
    if (!bounds) {
      editor.zoomToFit();
      return editor.getZoomLevel();
    }
    editor.zoomToBounds(bounds, { inset: 40, animation: { duration: 0 } });
    const toolbar = document.querySelector(".studio-toolbar");
    const header = document.querySelector(".studio-windowbar__left");
    const headerGap = window.innerWidth <= 700 ? 24 : 8;
    const frameScreen = editor.pageToScreen({ x: bounds.x, y: bounds.y });
    let camera = editor.getCamera();
    if (toolbar && window.innerWidth > 700) {
      const overlap = toolbar.getBoundingClientRect().right + 48 - frameScreen.x;
      if (overlap > 0) camera = { ...camera, x: camera.x + overlap / camera.z };
    }
    if (header) {
      const overlap = header.getBoundingClientRect().bottom + headerGap - frameScreen.y;
      if (overlap > 0) camera = { ...camera, y: camera.y - overlap / camera.z };
    }
    editor.setCamera(camera);
    if (window.innerWidth > 700) {
      const inspector = document.querySelector(".studio-inspector");
      if (inspector) {
        const frameRight = editor.pageToScreen({ x: bounds.x + bounds.w, y: bounds.y }).x;
        const overlap = frameRight + 16 - inspector.getBoundingClientRect().left;
        if (overlap > 0) {
          const next = editor.getCamera();
          editor.setCamera({ ...next, x: next.x - overlap / next.z });
        }
        const toolbarRight = toolbar ? toolbar.getBoundingClientRect().right + 48 : 16;
        const available = inspector.getBoundingClientRect().left - 16 - toolbarRight;
        const fittedLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y }).x;
        const fittedRight = editor.pageToScreen({ x: bounds.x + bounds.w, y: bounds.y }).x;
        const fittedWidth = fittedRight - fittedLeft;
        if (available > 80 && fittedWidth > available) {
          const fitted = editor.getCamera();
          editor.setCamera({ ...fitted, z: fitted.z * (available / fittedWidth) });
          const nextLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y }).x;
          const placed = editor.getCamera();
          editor.setCamera({ ...placed, x: placed.x + (toolbarRight - nextLeft) / placed.z });
        }
      } else {
        const toolbarRight = toolbar ? toolbar.getBoundingClientRect().right + 48 : 16;
        const limitRight = window.innerWidth - 16;
        const available = limitRight - toolbarRight;
        const fittedLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y }).x;
        const fittedRight = editor.pageToScreen({ x: bounds.x + bounds.w, y: bounds.y }).x;
        const fittedWidth = fittedRight - fittedLeft;
        if (available > 80 && fittedWidth > available) {
          const fitted = editor.getCamera();
          editor.setCamera({ ...fitted, z: fitted.z * (available / fittedWidth) });
          const nextLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y }).x;
          const placed = editor.getCamera();
          editor.setCamera({ ...placed, x: placed.x + (toolbarRight - nextLeft) / placed.z });
        } else if (fittedRight > limitRight) {
          const placed = editor.getCamera();
          editor.setCamera({ ...placed, x: placed.x - (fittedRight - limitRight) / placed.z });
        }
      }
    }
    const zoomCluster = document.querySelector(".studio-zoom-cluster");
    const headerBottom = header ? header.getBoundingClientRect().bottom + headerGap : 16;
    const limitBottom = zoomCluster ? zoomCluster.getBoundingClientRect().top - 8 : window.innerHeight - 16;
    const available = limitBottom - headerBottom;
    if (available > 80) {
      const screenTop = () => editor.pageToScreen({ x: bounds.x, y: bounds.y }).y;
      const screenBottom = () => editor.pageToScreen({ x: bounds.x, y: bounds.y + bounds.h }).y;
      const top = screenTop();
      const bottom = screenBottom();
      const height = bottom - top;
      if (height > available) {
        const fitted = editor.getCamera();
        editor.setCamera({ ...fitted, z: fitted.z * (available / height) });
        const nextTop = screenTop();
        const placed = editor.getCamera();
        editor.setCamera({ ...placed, y: placed.y - (nextTop - headerBottom) / placed.z });
      } else if (top < headerBottom) {
        const placed = editor.getCamera();
        editor.setCamera({ ...placed, y: placed.y - (top - headerBottom) / placed.z });
      } else if (bottom > limitBottom) {
        const placed = editor.getCamera();
        editor.setCamera({ ...placed, y: placed.y - (bottom - limitBottom) / placed.z });
      }
    }
    return editor.getZoomLevel();
  } catch {
    return editor.getZoomLevel();
  }
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
    listConversations,
    readConversation,
    saveConversation,
    renameConversation,
    deleteConversation,
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
  const webEdition = isWebEdition();
  const [launchToken] = useState(() =>
    webEdition || typeof window === "undefined" ? null : studioHostToken(window.location.search)
  );
  const [isStandaloneHost] = useState(() => !webEdition && (Boolean(launchToken) || readStandaloneHostMode()));
  const [hostKeyConfigured, setHostKeyConfigured] = useState(false);
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
      : webEdition
        ? WEB_LIBRARY_STATUS
        : "Projects are available in a trusted local VS Code workspace.",
    projects: [],
    corruptCount: 0
  });
  const projectLibraryState = webEdition || isStandaloneHost ? standaloneProjects : projects;
  const refreshProjectLibrary = React.useCallback(() => {
    if (webEdition) {
      setStandaloneProjects((current) => ({
        ...current,
        status: "loading",
        message: "Loading projects in this browser…"
      }));
      void listBrowserProjects()
        .then((result) =>
          setStandaloneProjects({
            status: "ready",
            message: WEB_LIBRARY_STATUS,
            projects: result.projects,
            corruptCount: result.corruptCount
          })
        )
        .catch((error: unknown) =>
          setStandaloneProjects((current) => ({
            ...current,
            status: "error",
            message: error instanceof Error ? error.message : "Projects in this browser could not be loaded."
          }))
        );
      return;
    }
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
  }, [isStandaloneHost, requestProjects, webEdition]);
  useEffect(() => {
    if (webEdition || isStandaloneHost) refreshProjectLibrary();
  }, [isStandaloneHost, refreshProjectLibrary, webEdition]);
  useEffect(() => {
    if (!webEdition) return;
    void ensureBrowserScratchpad().then(() => {
      refreshProjectLibrary();
      void rememberPersistentStorage();
    });
    return subscribeLibraryChanges(() => refreshProjectLibrary());
  }, [refreshProjectLibrary, webEdition]);
  useEffect(() => {
    if (!webEdition || !("serviceWorker" in navigator)) return;
    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) setAppUpdateWaiting(true);
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", () => {
          if (registration.waiting) setAppUpdateWaiting(true);
        });
      });
    };
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) watch(registration);
    });
  }, [webEdition]);
  const editorRef = useRef<Editor | null>(null);
  const mountedEditorRef = useRef<Editor | null>(null);
  const mountingRef = useRef(false);
  const startedToolExecutionsRef = useRef(new Set<string>());
  const stagedExecutionRef = useRef<{ requestId: string; callId: string } | null>(null);
  const shouldAutoFitRef = useRef(true);
  const projectIdRef = useRef<string | null>(null);
  const projectTitleRef = useRef("Untitled");
  const projectWritableRef = useRef(false);
  const heldLockRef = useRef<{ release(): void } | null>(null);
  const lockListenerRef = useRef<(() => void) | null>(null);
  const pendingSnapshotRef = useRef<unknown>(null);
  const initialBlankSnapshotRef = useRef<string | null>(null);
  const scratchpadRequestedRef = useRef(false);
  const pendingNewCanvasRef = useRef<string | null>(null);
  const pendingFramePresetRef = useRef<(typeof HOME_CATEGORY_PRESETS)[number] | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const stampCanvasTimerRef = useRef<number | undefined>(undefined);
  const refreshCanvasesRef = useRef<(editor: Editor, touchCurrent?: boolean) => void>(() => undefined);
  const stopStoreListenerRef = useRef<(() => void) | null>(null);
  const stopInspectorListenerRef = useRef<(() => void) | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectReadOnly, setProjectReadOnly] = useState<string | null>(null);
  const [rememberOpenRouter, setRememberOpenRouter] = useState(true);
  const [openRouterRevoke, setOpenRouterRevoke] = useState<{ settingsUrl: string; activityUrl: string } | null>(null);
  const [appUpdateWaiting, setAppUpdateWaiting] = useState(false);
  const [projectSaveStatus, setProjectSaveStatus] = useState(webEdition ? WEB_LIBRARY_STATUS : "Browser session only");
  const [canvasProposal, setCanvasProposal] = useState<CanvasProposal | null>(null);
  const [agentSessions, setAgentSessions] = useState<
    Array<{ id: string; title: string; status: "running" | "finished" | "idle" }>
  >([]);
  const [vectorDialogOpen, setVectorDialogOpen] = useState(false);
  const [theme, setTheme] = useState<StudioTheme>(resolveStudioTheme);
  const [editorReady, setEditorReady] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [route, navigateRoute] = useStudioRoute();
  const [keepEditorMounted, setKeepEditorMounted] = useState(() => route.name === "project");
  useEffect(() => {
    if (route.name === "project") setKeepEditorMounted(true);
  }, [route.name]);
  const routedProjectRef = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const traceInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | undefined>(undefined);
  // Shown on Home when a saved project exists but its canvas data cannot be loaded.
  const [openFailureNotice, setOpenFailureNotice] = useState<string | undefined>(undefined);
  const [isAgentSidebarOpen, setAgentSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1100 || window.innerWidth <= 700;
  });
  const [isAgentPanelCollapsed, setAgentPanelCollapsed] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(readStoredSelectedModelId);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [isInspectorOpen, setInspectorOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedShape, setSelectedShape] = useState<InspectedShape | null>(null);
  const [pageProperties, setPageProperties] = useState<PageProperties>({
    background: STUDIO_THEME_PAGE_BACKGROUNDS[theme],
    opacity: 100,
    grid: true
  });
  const pagePropertiesRef = useRef(pageProperties);
  pagePropertiesRef.current = pageProperties;
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
      const call = toolCalls.find((item) => item.requestId === execution.requestId && item.callId === execution.callId);
      const preview =
        call?.requiresApproval === true
          ? proposalFromTool(execution.name, execution.arguments, editor.getViewportPageBounds().center)
          : null;
      if (preview) {
        stagedExecutionRef.current = execution;
        setCanvasProposal(preview);
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
  }, [completeToolExecution, editorReady, pendingToolExecutions, toolCalls]);

  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; arguments?: string }>).detail;
      const editor = editorRef.current;
      if (!editor || !detail?.name || !detail.arguments) return;
      const proposal = proposalFromTool(detail.name, detail.arguments, editor.getViewportPageBounds().center);
      if (proposal) setCanvasProposal(proposal);
    };
    window.addEventListener("kurva-preview-tool", onPreview);
    const sessions: { current: VariantSession[] } = { current: [] };
    const onVariants = (event: Event) => {
      const editor = editorRef.current;
      if (!editor) return;
      const count = Number((event as CustomEvent<{ count?: number }>).detail?.count ?? 3);
      sessions.current = placeVariantFrames(adaptEditorForVariants(editor), count);
    };
    const onKeep = (event: Event) => {
      const editor = editorRef.current;
      if (!editor) return;
      const index = Number((event as CustomEvent<{ index?: number }>).detail?.index ?? 0);
      keepVariantFrame(adaptEditorForVariants(editor), sessions.current, index);
      sessions.current = sessions.current.filter((session) => session.index === index);
    };
    window.addEventListener("kurva-start-variants", onVariants);
    window.addEventListener("kurva-keep-variant", onKeep);
    let lastCameraKey = "";
    const proposalTimer = shouldPollMcpApi(isStandaloneHost ? "standalone" : hostState.host)
      ? window.setInterval(() => {
          const editor = editorRef.current;
          if (!editor) return;
          const camera = editor.getCamera();
          const cameraKey = `${camera.x}:${camera.y}:${camera.z}`;
          if (cameraKey !== lastCameraKey) {
            lastCameraKey = cameraKey;
            return;
          }
          void fetch("/api/mcp-proposal", { credentials: "same-origin" })
            .then((response) => response.json())
            .then((body: { proposal?: { badge?: string; name?: string; arguments?: string } | null }) => {
              const staged = body.proposal;
              if (!staged?.name || !staged.arguments) return;
              const proposal = proposalFromTool(staged.name, staged.arguments, editor.getViewportPageBounds().center);
              if (!proposal) return;
              setCanvasProposal({ ...proposal, summary: `${staged.badge ?? "MCP"}: ${proposal.summary}` });
            })
            .catch(() => undefined);
          void fetch("/api/mcp-screenshot", { credentials: "same-origin" })
            .then((response) => response.json())
            .then(async (body: { request?: { id?: string; frameId?: string } | null }) => {
              const request = body.request;
              if (!request?.id || !request.frameId) return;
              const frame = editor.getShape(request.frameId as Parameters<typeof editor.getShape>[0]);
              if (frame?.type !== "frame") {
                await fetch("/api/mcp-screenshot", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ requestId: request.id, error: "Choose a frame on the current page." })
                });
                return;
              }
              const image = await editor.toImage([frame.id], {
                format: "png",
                pixelRatio: 1,
                background: true,
                padding: 0
              });
              const pngDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(image.blob);
              });
              await fetch("/api/mcp-screenshot", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ requestId: request.id, pngDataUrl })
              });
            })
            .catch(() => undefined);
          void fetch("/api/mcp-live-edit", { credentials: "same-origin" })
            .then((response) => response.json())
            .then(async (body: { edit?: { name?: string; arguments?: string } | null }) => {
              if (!body.edit?.name || !body.edit.arguments) return;
              await executeCanvasTool(editor, body.edit.name, body.edit.arguments);
            })
            .catch(() => undefined);
        }, 1000)
      : undefined;
    return () => {
      if (proposalTimer !== undefined) window.clearInterval(proposalTimer);
      window.removeEventListener("kurva-preview-tool", onPreview);
      window.removeEventListener("kurva-start-variants", onVariants);
      window.removeEventListener("kurva-keep-variant", onKeep);
    };
  }, [hostState.host, isStandaloneHost]);
  const tldrawLicenseKey = readTldrawLicenseKey(import.meta.env.VITE_TLDRAW_LICENSE_KEY);
  const hostAssets = React.useMemo(
    () => (webEdition ? createBrowserAssetStore() : isStandaloneHost ? createHostAssetStore() : undefined),
    [isStandaloneHost, webEdition]
  );
  const capabilities = studioCapabilities(hostState.host);
  const desktopOnly = showDesktopOnlyNotice(capabilities);
  const libraryKind = projectLibraryKind({
    webEdition,
    standaloneHost: isStandaloneHost,
    vscodeTrusted: hostState.host === "vscode" && hostState.workspaceTrusted
  });
  const projectBackend =
    libraryKind === "browser" ? browserProjectBackend : libraryKind === "standalone" ? standaloneProjectBackend : null;
  const hasDurableLibrary = libraryKind !== "session";
  const canRenderCanvas = canRenderTldrawCanvas(
    tldrawLicenseKey,
    canvasLicenseRequired({ webEdition, production: import.meta.env.PROD, standaloneHost: isStandaloneHost })
  );
  const [chatPanelWidth, setChatPanelWidth] = useState(() => readPanelSize("chat", "width"));
  const [chatPanelHeight, setChatPanelHeight] = useState(() => readPanelSize("chat", "height"));
  const [inspectorPanelWidth, setInspectorPanelWidth] = useState(() => readPanelSize("inspector", "width"));
  const [inspectorPanelHeight, setInspectorPanelHeight] = useState(() => readPanelSize("inspector", "height"));
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 700);
  const [workspaceHeight, setWorkspaceHeight] = useState(() => window.innerHeight);
  const [canvases, setCanvases] = useState<SessionCanvas[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState(readProjectThumbnails);
  const [hostThumbnailVersions, setHostThumbnailVersions] = useState<Record<string, number>>({});
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
  const compactPanelOpen = isCompactViewport && (isAgentSidebarOpen || isInspectorOpen);
  const compactPanelHeight = isInspectorOpen ? effectiveInspectorPanelHeight : effectiveChatPanelHeight;

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
      browserLibrary: webEdition,
      projectId
    });
    if (target === "offline") return;
    try {
      const snapshot = JSON.stringify(editor.getSnapshot());
      if (!snapshot) throw new Error("Snapshot serialization failed.");
      setProjectSaveStatus("Saving…");
      if (target === "browser") {
        void browserProjectBackend
          .save(projectId, projectTitleRef.current, snapshot)
          .then(async () => {
            setProjectSaveStatus(WEB_LIBRARY_STATUS);
            publishLibraryChange();
            refreshProjectLibrary();
            void rememberPersistentStorage();
            const frame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
            if (!frame) return;
            const image = await editor.toImage([frame.id], {
              format: "png",
              pixelRatio: 1,
              background: true,
              padding: 0
            });
            await putBrowserThumbnail(projectId, image.blob);
            const url = URL.createObjectURL(image.blob);
            setThumbnailUrls((current) => ({ ...current, [projectId]: url }));
          })
          .catch((error: unknown) =>
            setProjectSaveStatus(error instanceof Error ? error.message : "Save failed – Retry")
          );
        return;
      }
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
            scheduleFrameThumbnail(editor, projectId, 1_200, () => {
              setHostThumbnailVersions((current) => ({
                ...current,
                [projectId]: (current[projectId] ?? 0) + 1
              }));
            });
            refreshProjectLibrary();
          }
        })
        .catch(() => setProjectSaveStatus("Save failed"));
    } catch {
      setProjectSaveStatus("Save failed");
    }
  }, [hostState.host, hostState.workspaceTrusted, saveProject, refreshProjectLibrary, isStandaloneHost, webEdition]);

  const scheduleProjectSaveRef = useRef<() => void>(() => undefined);
  const scheduleProjectSave = React.useCallback(() => {
    const target = hostSaveTarget({
      vscode: hostState.host === "vscode" && hostState.workspaceTrusted,
      standaloneHost: isStandaloneHost,
      browserLibrary: webEdition,
      projectId: projectIdRef.current
    });
    if (target === "offline" || !projectWritableRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    setProjectSaveStatus("Saving…");
    saveTimerRef.current = window.setTimeout(persistProjectNow, 650);
  }, [hostState.host, hostState.workspaceTrusted, persistProjectNow, isStandaloneHost, webEdition]);

  React.useEffect(() => {
    scheduleProjectSaveRef.current = scheduleProjectSave;
  }, [scheduleProjectSave]);

  const claimProjectLock = React.useCallback(
    (projectId: string, saveAfter = false) => {
      lockListenerRef.current?.();
      lockListenerRef.current = null;
      heldLockRef.current?.release();
      heldLockRef.current = null;
      if (libraryKind !== "browser") {
        projectWritableRef.current = true;
        setProjectReadOnly(null);
        return;
      }
      projectWritableRef.current = false;
      void acquireProjectLock(projectId).then((lock) => {
        if (projectIdRef.current !== projectId) {
          lock.release();
          return;
        }
        heldLockRef.current = lock;
        projectWritableRef.current = !lock.readonly;
        setProjectReadOnly(lock.readonly ? projectId : null);
        if (!lock.readonly) {
          lockListenerRef.current = listenForLockRelease(projectId, () => {
            lock.release();
            if (heldLockRef.current === lock) heldLockRef.current = null;
          });
          if (saveAfter) scheduleProjectSaveRef.current();
        }
      });
    },
    [libraryKind]
  );

  React.useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
      window.clearTimeout(stampCanvasTimerRef.current);
      cancelScheduledFrameThumbnails();
      stopStoreListenerRef.current?.();
      stopInspectorListenerRef.current?.();
    },
    []
  );

  React.useEffect(() => {
    const query = window.matchMedia("(hover: none)");
    const apply = () => {
      document.documentElement.dataset.hover = query.matches ? "none" : "hover";
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

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
      mountingRef.current = false;
      mountedEditorRef.current = null;
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
      const deletedProjectId = projectAction.projectId;
      removeProjectThumbnail(deletedProjectId);
      setThumbnailUrls(readProjectThumbnails());
      setHostThumbnailVersions((current) => {
        const next = { ...current };
        delete next[deletedProjectId];
        return next;
      });
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

  // Inside the VS Code Webview, follow the editor theme until the user picks a Studio theme.
  useEffect(() => {
    if (typeof MutationObserver === "undefined" || !document.body) return undefined;
    const observer = new MutationObserver(() => {
      if (readStoredStudioTheme()) return;
      const followed = readVsCodeTheme();
      if (followed) setTheme((current) => (current === followed ? current : followed));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = document.querySelector(".studio-canvas-content");
    if (!canvas || typeof ResizeObserver === "undefined") return;
    let refitTimer: number | undefined;
    const observer = new ResizeObserver(() => {
      if (!editorRef.current || !shouldAutoFitRef.current) return;
      if (canvas.clientWidth < 2 || canvas.clientHeight < 2) return;
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
    if (mountedEditorRef.current === editor) return;
    if (mountingRef.current && mountedEditorRef.current && !mountedEditorRef.current.isDisposed) return;
    mountingRef.current = true;
    mountedEditorRef.current = editor;
    editorRef.current = editor;
    if (new URLSearchParams(window.location.search).get("perf") === "1") {
      (window as Window & { __studioEditor?: Editor }).__studioEditor = editor;
    }
    const pendingSnapshot = pendingSnapshotRef.current;
    if (pendingSnapshot && !isBlankCanvasSnapshot(pendingSnapshot)) {
      try {
        editor.loadSnapshot(pendingSnapshot as Parameters<Editor["loadSnapshot"]>[0]);
        if (!webEdition) projectWritableRef.current = true;
      } catch {
        projectIdRef.current = null;
        setActiveProjectId(null);
        setProjectSaveStatus("Could not open project");
        setOpenFailureNotice(projectOpenFailureMessage(projectTitleRef.current));
        navigateRoute({ name: "home" });
      }
      pendingSnapshotRef.current = null;
    } else {
      // A saved project with an empty canvas (the web Scratchpad placeholder) opens as a
      // fresh canvas; the first save replaces the placeholder with a real snapshot.
      if (pendingSnapshot) {
        pendingSnapshotRef.current = null;
        if (!webEdition) projectWritableRef.current = true;
      }
      editor.renamePage(editor.getCurrentPageId(), projectTitleRef.current);
      const pendingCategory = pendingNewCanvasRef.current;
      const preset = HOME_CATEGORY_PRESETS.find((candidate) => candidate.id === pendingCategory);
      const existingFrames = editor.getCurrentPageShapes().filter((shape) => shape.type === "frame");
      if (existingFrames.length === 0) {
        editor.createShape({
          type: "frame",
          x: 0,
          y: 0,
          props: {
            w: preset?.width ?? 1080,
            h: preset?.height ?? 720,
            name: preset?.label ?? "Frame"
          }
        });
      }
      const pendingPreset = pendingFramePresetRef.current;
      if (pendingPreset) {
        const frame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
        if (frame) {
          editor.updateShape({
            id: frame.id,
            type: "frame",
            props: { w: pendingPreset.width, h: pendingPreset.height, name: pendingPreset.label }
          });
        }
      }
      editor.selectNone();
      setSelectedShape(null);
      setZoomLevel(fitCurrentFrame(editor));
      setInspectorOpen(window.innerWidth >= 1100);
      if (!initialBlankSnapshotRef.current) {
        try {
          initialBlankSnapshotRef.current = JSON.stringify(editor.getSnapshot());
        } catch {
          // Scratchpad creation can retry after a valid canvas snapshot is available.
        }
      }
    }

    // Keep inspector values tied to the real current selection.
    let selectionKey = "";
    editor.sideEffects.registerAfterChangeHandler("instance_page_state", () => {
      const zoom = editor.getZoomLevel();
      setZoomLevel((current) => (current === zoom ? current : zoom));
      const key = editor.getSelectedShapeIds().join("\n");
      if (key === selectionKey) return;
      selectionKey = key;
      setSelectedShape(inspectSelection(editor));
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
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (shouldAutoFitRef.current) setZoomLevel(fitCurrentFrame(editor));
      })
    );
    if (hostState.host !== "vscode" || isStandaloneHost) {
      if (!isStandaloneHost && !webEdition) ensureSessionScratchpad(editor);
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
      if (projectIdRef.current && isProjectUuid(projectIdRef.current)) {
        scheduleProjectSaveRef.current();
      } else {
        window.setTimeout(() => handleNewCanvas(categoryId || undefined), 0);
      }
    }
  };

  useEffect(() => {
    if (route.name !== "project") return;
    const applyPresetFrame = () => {
      const preset = pendingFramePresetRef.current;
      const editor = editorRef.current;
      if (!preset || !editor) return;
      const frames = editor.getCurrentPageShapes().filter((shape) => shape.type === "frame");
      const props = frames[0]?.props as { w?: number; h?: number; name?: string } | undefined;
      if (
        props?.w === preset.width &&
        props.h === preset.height &&
        props.name === preset.label &&
        frames.length === 1
      ) {
        return;
      }
      if (frames.length) editor.deleteShapes(frames.map((shape) => shape.id));
      editor.createShape({
        type: "frame",
        x: 0,
        y: 0,
        props: { w: preset.width, h: preset.height, name: preset.label }
      });
      editor.selectNone();
    };
    applyPresetFrame();
    const editor = editorRef.current;
    const stop = editor?.store.listen(applyPresetFrame);
    const timer = window.setTimeout(() => {
      stop?.();
      pendingFramePresetRef.current = null;
    }, 1200);
    return () => {
      stop?.();
      window.clearTimeout(timer);
    };
  }, [route, editorReady, editorGeneration]);

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
    const rawSnapshot = JSON.stringify(editor.getSnapshot());
    const portableSnapshot = webEdition
      ? inlineAssetSources(rawSnapshot)
      : isStandaloneHost
        ? inlineStandaloneAssetSources(rawSnapshot)
        : Promise.resolve(rawSnapshot);
    void portableSnapshot
      .then((snapshot) => {
        const json = buildStudioProjectExport({ id, title, snapshot });
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = studioExportFileName(title);
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      })
      .catch(() => setProjectSaveStatus("The page could not be exported."));
  };

  const handleExportPage = (format: "png" | "svg" | "json", scale: 1 | 2) => {
    if (format === "json") {
      handleExportProject();
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    const frame = shapes.find((shape) => shape.type === "frame");
    const ids = (frame ? [frame.id] : shapes.map((shape) => shape.id)) as TLShapeId[];
    if (ids.length === 0) {
      setProjectSaveStatus("There is nothing on this page to export.");
      return;
    }
    const title = projectTitleRef.current.trim() || "page";
    if (format === "svg") {
      void editor
        .getSvgString(ids)
        .then((exported) => {
          if (!exported?.svg) {
            setProjectSaveStatus("The page could not be exported.");
            return;
          }
          const url = URL.createObjectURL(
            new Blob([sanitizeSvg(stableExportSvgIds(exported.svg))], { type: "image/svg+xml" })
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = safeExportFileName(title, "svg");
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 0);
        })
        .catch(() => setProjectSaveStatus("The page could not be exported."));
      return;
    }
    void editor
      .toImage(ids, { format: "png", pixelRatio: scale, background: true, padding: 0 })
      .then((image) => {
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = safeExportFileName(title, "png");
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      })
      .catch(() => setProjectSaveStatus("The page could not be exported."));
  };

  const handleExportFrame = () => {
    const editor = editorRef.current;
    const frameId = selectedShape?.type === "frame" ? selectedShape.id : undefined;
    if (!editor || !frameId) return;
    void editor
      .toImage([frameId as TLShapeId], {
        format: "png",
        pixelRatio: 2,
        background: true,
        padding: 0
      })
      .then((image) => {
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = safeExportFileName(projectTitleRef.current.trim() || "frame", "png");
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      })
      .catch(() => setProjectSaveStatus("The frame could not be exported."));
  };

  const handleDuplicateCurrent = () => {
    if (hasDurableLibrary && activeProjectId) {
      handleDuplicateProject(activeProjectId);
      return;
    }
    if (currentCanvasId) handleDuplicateCanvas(currentCanvasId);
  };

  const handleDeleteCurrent = () => {
    if (hasDurableLibrary && activeProjectId) {
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
    if (hasDurableLibrary) return Boolean(activeProjectId && activeProjectId !== SCRATCHPAD_PROJECT_ID);
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
    if (hostState.host === "web") setProjectSaveStatus(WEB_LIBRARY_STATUS);
    else if (hostState.host !== "vscode") setProjectSaveStatus("Browser session only");
    refreshCanvases(editor);
    scheduleProjectSave();
    routedProjectRef.current = canvasId;
    navigateRoute({ name: "project", projectId: canvasId });
  };

  const handleNewCanvas = (categoryId?: string) => {
    pendingFramePresetRef.current = HOME_CATEGORY_PRESETS.find((candidate) => candidate.id === categoryId) ?? null;
    const editor = editorRef.current;
    if (!editor) {
      pendingNewCanvasRef.current = categoryId ?? "";
      if (hasDurableLibrary) {
        const nextProjectId = crypto.randomUUID();
        projectIdRef.current = nextProjectId;
        projectTitleRef.current = "Untitled";
        setActiveProjectId(nextProjectId);
        setProjectTitle("Untitled");
        routedProjectRef.current = nextProjectId;
        claimProjectLock(nextProjectId, true);
        navigateRoute({ name: "project", projectId: nextProjectId });
      }
      return;
    }
    const preset = HOME_CATEGORY_PRESETS.find((candidate) => candidate.id === categoryId);
    const frameWidth = preset?.width ?? 1080;
    const frameHeight = preset?.height ?? 720;
    const currentFrame = editor.getCurrentPageShapes().find((shape) => shape.type === "frame");
    if (currentFrame && preset) {
      editor.updateShape({
        id: currentFrame.id,
        type: "frame",
        props: { w: frameWidth, h: frameHeight, name: preset.label }
      });
    }
    shouldAutoFitRef.current = false;
    if (hasDurableLibrary) {
      persistProjectNow();
      const title = "Untitled";
      const nextProjectId = crypto.randomUUID();
      projectIdRef.current = nextProjectId;
      projectTitleRef.current = title;
      setActiveProjectId(nextProjectId);
      setProjectTitle(title);
      routedProjectRef.current = nextProjectId;
      claimProjectLock(nextProjectId, true);
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
          const currentPage = current.getCurrentPage();
          current.renamePage(currentPage.id, title);
          const currentShapes = current.getCurrentPageShapes().map((shape) => shape.id);
          if (currentShapes.length) current.deleteShapes(currentShapes);
          for (const page of current.getPages()) {
            if (page.id === currentPage.id) continue;
            current.deletePage(page.id);
          }
          current.clearHistory();
          current.createShape({
            type: "frame",
            x: 0,
            y: 0,
            props: { w: frameWidth, h: frameHeight, name: preset?.label ?? "Frame" }
          });
          current.selectNone();
          setSelectedShape(null);
          setInspectorOpen(window.innerWidth >= 1100);
          shouldAutoFitRef.current = true;
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
      props: { w: frameWidth, h: frameHeight, name: preset?.label ?? "Frame" }
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

  // Home and the editor's agent panel share one choice, kept in the same storage key.
  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    try {
      if (modelId) window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
      else window.localStorage.removeItem(SELECTED_MODEL_STORAGE_KEY);
    } catch {
      // The selection still applies for this session when storage is unavailable.
    }
  }, []);

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
  const canUseProjectConversationStore = hasDurableLibrary;
  const conversationHostTarget = useCallback(
    (conversationId: string) => {
      const projectId = projectIdRef.current;
      const url = projectId ? projectConversationUrl(projectId, conversationId) : null;
      if (!isStandaloneHost || !projectId || !url) return null;
      return { projectId, url };
    },
    [isStandaloneHost]
  );
  const loadProjectConversations = useCallback(
    async (projectId: string): Promise<AgentConversation[]> => {
      if (libraryKind === "browser") {
        const records = await listBrowserConversations(projectId);
        return records.map((record) => ({
          id: record.id,
          title: record.title,
          modelId: record.modelId,
          updatedAt: record.updatedAt
        }));
      }
      if (isStandaloneHost) {
        const url = projectConversationUrl(projectId);
        if (!url) return [];
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Saved conversations could not be loaded.");
        const records: unknown = await response.json();
        if (!Array.isArray(records)) throw new Error("The conversation list was invalid.");
        return records as AgentConversation[];
      }
      if (hostState.host === "vscode" && hostState.workspaceTrusted) return listConversations(projectId);
      return [];
    },
    [hostState.host, hostState.workspaceTrusted, isStandaloneHost, libraryKind, listConversations]
  );
  const loadProjectConversation = useCallback(
    async (projectId: string, conversationId: string): Promise<StoredAgentConversation | null> => {
      if (libraryKind === "browser") return readBrowserConversation(projectId, conversationId);
      if (isStandaloneHost) {
        const url = projectConversationUrl(projectId, conversationId);
        if (!url) return null;
        const response = await fetch(url, { credentials: "same-origin" });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("The saved conversation could not be opened.");
        return (await response.json()) as StoredAgentConversation;
      }
      if (hostState.host === "vscode" && hostState.workspaceTrusted) return readConversation(projectId, conversationId);
      return null;
    },
    [hostState.host, hostState.workspaceTrusted, isStandaloneHost, libraryKind, readConversation]
  );
  const persistProjectConversation = useCallback(
    async (conversation: {
      id: string;
      title: string;
      modelId: string;
      updatedAt: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }) => {
      const projectId = projectIdRef.current;
      const url = projectId ? projectConversationUrl(projectId) : null;
      if (!projectId || !projectConversationUrl(projectId, conversation.id)) return;
      if (libraryKind === "browser") {
        await writeBrowserConversation({ ...conversation, projectId });
        return;
      }
      if (isStandaloneHost && url) {
        const response = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...conversation, projectId })
        });
        if (!response.ok) throw new Error("The conversation could not be saved.");
        return;
      }
      if (hostState.host === "vscode" && hostState.workspaceTrusted) {
        await saveConversation(projectId, conversation);
      }
    },
    [hostState.host, hostState.workspaceTrusted, isStandaloneHost, libraryKind, saveConversation]
  );
  const renameProjectConversation = useCallback(
    async (id: string, title: string) => {
      if (libraryKind === "browser" && projectIdRef.current) {
        await renameBrowserConversation(projectIdRef.current, id, title);
        return;
      }
      const target = conversationHostTarget(id);
      if (target) {
        const response = await fetch(`${target.url}/rename`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error("The conversation title could not be saved.");
      } else if (hostState.host === "vscode" && hostState.workspaceTrusted) {
        const projectId = projectIdRef.current;
        if (projectId) await renameConversation(projectId, id, title);
      }
    },
    [conversationHostTarget, hostState.host, hostState.workspaceTrusted, libraryKind, renameConversation]
  );
  const deleteProjectConversation = useCallback(
    async (id: string) => {
      if (libraryKind === "browser" && projectIdRef.current) {
        await deleteBrowserConversation(projectIdRef.current, id);
        return;
      }
      const target = conversationHostTarget(id);
      if (target) {
        const response = await fetch(`${target.url}/delete`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: true })
        });
        if (!response.ok) throw new Error("The conversation could not be deleted.");
      } else if (hostState.host === "vscode" && hostState.workspaceTrusted) {
        const projectId = projectIdRef.current;
        if (projectId) await deleteConversation(projectId, id);
      }
    },
    [conversationHostTarget, deleteConversation, hostState.host, hostState.workspaceTrusted, libraryKind]
  );
  const handleToggleInspector = () => setInspectorOpen((current) => !current);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || window.innerWidth <= 700) return;
    setZoomLevel(fitCurrentFrame(editor));
  }, [isInspectorOpen]);

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      if (width <= 700) setAgentSidebarOpen(true);
      else if (width < 1100) setAgentSidebarOpen(false);
      if (width < 1100) setInspectorOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
  const chooseTheme = React.useCallback((next: StudioTheme) => {
    rememberStudioTheme(next);
    setTheme(next);
  }, []);

  useEffect(() => {
    const host = window as Window & { __studioSetTheme?: (next: StudioTheme) => void };
    const previous = host.__studioSetTheme;
    host.__studioSetTheme = chooseTheme;
    return () => {
      if (host.__studioSetTheme !== chooseTheme) return;
      if (previous) host.__studioSetTheme = previous;
      else delete host.__studioSetTheme;
    };
  }, [chooseTheme]);

  const handleCycleTheme = () => chooseTheme(nextStudioTheme(theme));

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

  // An untouched inspector page background follows the theme's canvas color;
  // a background the user picked stays as it is.
  useEffect(() => {
    const current = pagePropertiesRef.current;
    if (!Object.values<string>(STUDIO_THEME_PAGE_BACKGROUNDS).includes(current.background.toLowerCase())) return;
    const background = STUDIO_THEME_PAGE_BACKGROUNDS[theme];
    if (current.background.toLowerCase() === background) return;
    handlePageChange({ ...current, background });
  }, [theme, handlePageChange]);

  const handleFramePreset = (width: number, height: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectedShapes().filter((shape) => shape.type === "frame");
    const frames = selected.length
      ? selected
      : editor
          .getCurrentPageShapes()
          .filter((shape) => shape.type === "frame")
          .slice(0, 1);
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
      const snapshot = webEdition ? await storeInlinedAssets(imported.snapshot) : imported.snapshot;
      if (webEdition) assertPortableAssetSources(snapshot);
      editor.loadSnapshot(JSON.parse(snapshot) as Parameters<Editor["loadSnapshot"]>[0]);
      if (webEdition) {
        const saved = await browserProjectBackend.save(crypto.randomUUID(), imported.title, snapshot);
        projectIdRef.current = saved.id;
        setActiveProjectId(saved.id);
        projectTitleRef.current = saved.title;
        setProjectTitle(saved.title);
        setProjectSaveStatus(WEB_LIBRARY_STATUS);
        claimProjectLock(saved.id);
        publishLibraryChange();
        refreshProjectLibrary();
        routedProjectRef.current = saved.id;
        navigateRoute({ name: "project", projectId: saved.id });
        setImportNotice(undefined);
        return;
      }
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
    setOpenFailureNotice(undefined);
    if (projectId !== projectIdRef.current) persistProjectNow();
    routedProjectRef.current = null;
    navigateRoute({ name: "project", projectId });
  };

  const showEditor = () => {
    const projectId = hasDurableLibrary ? projectIdRef.current : currentCanvasId;
    if (!projectId) return;
    routedProjectRef.current = projectId;
    navigateRoute({ name: "project", projectId });
  };

  useEffect(() => {
    if (route.name !== "project") {
      mountingRef.current = false;
      mountedEditorRef.current = null;
      editorRef.current = null;
      routedProjectRef.current = null;
    }
  }, [route.name]);

  useEffect(() => {
    if (route.name !== "home") return;
    const editor = editorRef.current;
    if (!editor) return;
    let cancelled = false;
    const projectId = hasDurableLibrary ? projectIdRef.current : null;
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
    if ((libraryKind === "browser" || isStandaloneHost) && isProjectUuid(route.projectId)) {
      if (!editorReady) return;
      routedProjectRef.current = route.projectId;
      if (projectIdRef.current && projectIdRef.current !== route.projectId) persistProjectNow();
      setProjectSaveStatus("Opening…");
      const openProjectFile = libraryKind === "browser" ? browserProjectBackend.open : openStandaloneProject;
      void openProjectFile(route.projectId)
        .then((project) => {
          if (routedProjectRef.current !== project.id || projectIdRef.current === project.id) return;
          projectIdRef.current = project.id;
          claimProjectLock(project.id);
          setActiveProjectId(project.id);
          projectTitleRef.current = project.title;
          pendingSnapshotRef.current = JSON.parse(project.snapshot) as unknown;
          setProjectTitle(project.title);
          setProjectSaveStatus(libraryKind === "browser" ? WEB_LIBRARY_STATUS : "Saved");
          mountingRef.current = false;
          mountedEditorRef.current = null;
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
    setProjectSaveStatus(hostState.host === "web" ? WEB_LIBRARY_STATUS : "Browser session only");
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
    refreshProjectLibrary,
    claimProjectLock,
    libraryKind
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
    if (projectBackend) {
      void projectBackend
        .duplicate(projectId)
        .then((project) => {
          publishLibraryChange();
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

  /** `confirmed` is true when Home's in-app dialog already asked; other callers still confirm here. */
  const handleDeleteProject = (projectId: string, confirmed = false) => {
    if (projectBackend) {
      const project = projectLibraryState.projects.find((candidate) => candidate.id === projectId);
      const title = project?.title ?? "this project";
      if (!confirmed && !window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
      if (projectId === projectIdRef.current) persistProjectNow();
      void projectBackend
        .delete(projectId)
        .then(() => {
          cancelFrameThumbnail(projectId);
          publishLibraryChange();
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
    if (projectBackend) {
      void projectBackend
        .rename(projectId, title.trim())
        .then(() => {
          publishLibraryChange();
          refreshProjectLibrary();
        })
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
        void import("./editor/setGeoTool.js").then(({ setGeoTool }) => setGeoTool(editor, tool));
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
    <div className="studio-app" data-kurva-target={webEdition ? "web" : "desktop"} data-theme={theme}>
      {shouldOfferAppUpdate({
        waiting: appUpdateWaiting,
        editing: route.name === "project",
        streaming: chatRun?.status === "streaming"
      }) ? (
        <p role="status">
          A new version of Kurva is ready —{" "}
          <button
            type="button"
            onClick={() => {
              navigator.serviceWorker.controller?.postMessage("kurva-reload");
              window.location.reload();
            }}
          >
            Reload
          </button>
        </p>
      ) : null}
      {webEdition && webChatAvailability(typeof navigator === "undefined" ? true : navigator.onLine) ? (
        <p role="status">{webChatAvailability(navigator.onLine)}</p>
      ) : null}
      {/* Keep the canvas mounted after the first project visit, and hide it on other routes. */}
      {keepEditorMounted && (
        <React.Suspense fallback={<div role="status">Opening the canvas…</div>}>
          <div
            ref={workspaceRef}
            className={`studio-workspace${isAgentSidebarOpen && !isCompactViewport ? " studio-workspace--docked" : ""}${compactPanelOpen ? " studio-workspace--compact-panel-open" : ""}`}
            style={
              {
                "--studio-panel-width": `${isAgentPanelCollapsed ? 56 : chatPanelWidth}px`,
                "--studio-mobile-panel-height": `${compactPanelOpen ? compactPanelHeight : 0}px`
              } as React.CSSProperties
            }
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
                editor={editorReady ? editorRef.current : null}
                onRefreshModels={requestModelCatalog}
                onSendChat={sendChat}
                onCancelChat={cancelChat}
                onClearChatRun={clearChatRun}
                onApproveToolCall={approveToolCall}
                onRejectToolCall={rejectToolCall}
                onUndoToolCall={() => editorRef.current?.undo()}
                {...(canUseProjectConversationStore
                  ? {
                      onPersistConversation: persistProjectConversation,
                      onLoadConversations: loadProjectConversations,
                      onLoadConversation: loadProjectConversation,
                      onRenameConversation: renameProjectConversation,
                      onDeleteConversation: deleteProjectConversation
                    }
                  : {})}
                projectId={activeProjectId}
                onSessionsChange={setAgentSessions}
                onOpenVectorDialog={() => setVectorDialogOpen(true)}
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
                void placeFileOnCanvas(editorRef.current, file).catch((error: unknown) => {
                  setImportNotice(error instanceof Error ? error.message : "The file could not be placed.");
                });
              }}
              onDrop={(event) => {
                const file = [...event.dataTransfer.files].find(
                  (item) =>
                    /^(image\/(?:png|jpeg)|image\/svg\+xml)$/.test(item.type) || /\.(png|jpe?g|svg)$/i.test(item.name)
                );
                if (file && editorRef.current) {
                  event.preventDefault();
                  void placeFileOnCanvas(editorRef.current, file).catch((error: unknown) => {
                    setImportNotice(error instanceof Error ? error.message : "The file could not be placed.");
                  });
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
              {projectReadOnly ? (
                <p className="studio-desktop-only" role="status">
                  This project is open in another tab.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      const projectId = projectReadOnly;
                      requestProjectLockRelease(projectId);
                      window.setTimeout(() => claimProjectLock(projectId), 150);
                    }}
                  >
                    Open here instead
                  </button>
                </p>
              ) : null}
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
                canManageConnection={
                  webEdition || (hostState.host === "vscode" && hostState.workspaceTrusted) || isStandaloneHost
                }
                browserConnection={webEdition}
                rememberOpenRouter={rememberOpenRouter}
                onRememberOpenRouter={setRememberOpenRouter}
                openRouterRevoke={openRouterRevoke}
                connected={hostState.connection.status === "connected" || hostKeyConfigured}
                onConnectionAction={(action) => {
                  if (webEdition && (action === "connect" || action === "replace")) {
                    persistProjectNow();
                    void beginWebOpenRouterConnect({
                      remember: rememberOpenRouter,
                      returnHash: window.location.hash || "#/",
                      origin: window.location.origin
                    });
                    return;
                  }
                  if (webEdition && action === "disconnect") {
                    void disconnectWebOpenRouter().then((links) => {
                      setOpenRouterRevoke(links);
                      onConnectionAction("disconnect");
                    });
                    return;
                  }
                  if (!isStandaloneHost) {
                    onConnectionAction(action);
                    return;
                  }
                  if (action === "connect" || action === "replace") {
                    document.querySelector<HTMLInputElement>('input[name="openrouter-key"]')?.focus();
                    return;
                  }
                  onConnectionAction(action);
                }}
                {...(isStandaloneHost
                  ? {
                      onSaveHostKey: (key: string) => {
                        void fetch("/api/openrouter-key", {
                          method: "POST",
                          credentials: "same-origin",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ key })
                        })
                          .then(async (response) => {
                            const status = (await response.json()) as { configured?: boolean };
                            if (!response.ok || !status.configured)
                              throw new Error("Could not save the OpenRouter key.");
                            setHostKeyConfigured(true);
                            onConnectionAction("test");
                          })
                          .catch(() => setHostKeyConfigured(false));
                      }
                    }
                  : {})}
                showBlenderActions={capabilities.blender}
                canSendToBlender={
                  capabilities.blender && selectedShape?.type === "vector-studio" && selectedShape.count === 1
                }
                onSendToBlender={() => {
                  const shape = editorRef.current?.getSelectedShapes().find((item) => item.type === "vector-studio");
                  const svg = (shape?.props as { lastSvg?: unknown } | undefined)?.lastSvg;
                  return typeof svg === "string" ? svg : "";
                }}
                onBlenderAssets={(result) => {
                  const editor = editorRef.current;
                  if (!editor) return;
                  const shape = editor.getSelectedShapes().find((item) => item.type === "vector-studio");
                  editor.markHistoryStoppingPoint("send to blender");
                  editor.createShape({
                    type: "blender-connector",
                    x: (shape?.x ?? 0) + 480,
                    y: shape?.y ?? 0,
                    props: {
                      w: 360,
                      h: 280,
                      blenderVersion: "",
                      isConnected: true,
                      activeScene: result.sceneFile,
                      lastExport: `${result.pngSrc}\n${result.glbSrc}`
                    }
                  });
                }}
                agentSessions={agentSessions}
                onStopAgent={() => {
                  if (!chatRun) return;
                  stopRunningReply(chatRun.status, cancelChat, chatRun.requestId);
                }}
              />
              <StudioToolbar
                editor={editorReady ? editorRef.current : null}
                onImportAsset={() => assetInputRef.current?.click()}
                onTraceAsset={() => setVectorDialogOpen(true)}
              />
              {vectorDialogOpen &&
                createPortal(
                  <React.Suspense fallback={null}>
                    <VectorAssetDialog
                      allowQuiver={capabilities.quiver}
                      onClose={() => setVectorDialogOpen(false)}
                      onTrace={(file, preset, signal, tuning) => traceImageFileLocally(file, preset, signal, tuning)}
                      onInsert={async (svg, name) => {
                        const editor = editorRef.current;
                        if (!editor) throw new Error("The editor is still starting. Try again.");
                        await placeFileOnCanvas(editor, svgTextToFile(svg, name));
                      }}
                    />
                  </React.Suspense>,
                  document.querySelector(".studio-app") ?? document.body
                )}
              {canvasProposal && editorRef.current && (
                <ProposalGhost editor={editorRef.current} proposal={canvasProposal} />
              )}
              {canvasProposal && (
                <ProposalBar
                  proposal={canvasProposal}
                  onApply={() => {
                    const editor = editorRef.current;
                    if (!editor) return;
                    applyProposal(editor as unknown as Parameters<typeof applyProposal>[0], canvasProposal);
                    const staged = stagedExecutionRef.current;
                    if (staged) {
                      completeToolExecution(staged.requestId, staged.callId, {
                        ok: true,
                        content: `Applied ${canvasProposal.shapes.length} previewed shapes.`
                      });
                      stagedExecutionRef.current = null;
                    }
                    setCanvasProposal(null);
                  }}
                  onReject={() => {
                    const staged = stagedExecutionRef.current;
                    if (staged) {
                      completeToolExecution(staged.requestId, staged.callId, {
                        ok: false,
                        content: "Rejected. No canvas changes were made."
                      });
                      stagedExecutionRef.current = null;
                    }
                    setCanvasProposal(null);
                  }}
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
                    {route.name === "project" &&
                      (canRenderCanvas ? (
                        <StudioCanvas
                          editorGeneration={editorGeneration}
                          {...(tldrawLicenseKey ? { licenseKey: tldrawLicenseKey } : {})}
                          {...(hostAssets ? { assets: hostAssets } : {})}
                          onMount={handleMount}
                        />
                      ) : (
                        <CanvasLicenseNotice />
                      ))}
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
                maximum={
                  getPanelSizeRange("inspector", isCompactViewport ? "height" : "width", workspaceHeight).maximum
                }
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
                onExportPage={handleExportPage}
                onExportFrame={handleExportFrame}
                panelWidth={inspectorPanelWidth}
                panelHeight={effectiveInspectorPanelHeight}
              />
            )}
          </div>
        </React.Suspense>
      )}

      {route.name !== "home" &&
        route.name !== "project" &&
        route.name !== "connectors" &&
        (route.name !== "gallery" || !DevGallery) && (
          <React.Suspense fallback={<div role="status">Loading page…</div>}>
            <StudioRouteNotice
              route={route}
              theme={theme}
              onHome={() => navigateRoute({ name: "home" })}
              onConnectors={() => navigateRoute({ name: "connectors" })}
              onSettings={() => navigateRoute({ name: "settings" })}
              onTheme={chooseTheme}
              onRefreshCatalog={requestModelCatalog}
              catalogStatus={modelCatalog.message}
              launchToken={launchToken}
              host={hostState.host}
            />
          </React.Suspense>
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
      {(route.name === "home" || route.name === "connectors") && (
        <RecentsDashboard
          isOpen
          currentNav={route.name === "connectors" ? "connectors" : "home"}
          companion={
            route.name === "connectors" ? (
              <React.Suspense fallback={<div role="status">Loading connectors…</div>}>
                <StudioRouteNotice
                  route={route}
                  theme={theme}
                  onHome={() => navigateRoute({ name: "home" })}
                  onConnectors={() => navigateRoute({ name: "connectors" })}
                  onSettings={() => navigateRoute({ name: "settings" })}
                  onTheme={chooseTheme}
                  onRefreshCatalog={requestModelCatalog}
                  catalogStatus={modelCatalog.message}
                  launchToken={launchToken}
                  host={hostState.host}
                />
              </React.Suspense>
            ) : undefined
          }
          canvases={canvases}
          currentCanvasId={currentCanvasId}
          projects={projectLibraryState.projects}
          projectMode={hasDurableLibrary}
          {...(desktopOnly
            ? {
                libraryNote: WEB_LIBRARY_STATUS,
                workspaceTitle: "This browser",
                workspaceDetail: "Projects stay in this browser."
              }
            : {})}
          projectStatus={projectLibraryState.status}
          projectMessage={projectLibraryState.message}
          corruptCount={projectLibraryState.corruptCount}
          thumbnailUrls={thumbnailUrls}
          hostProjectThumbnails={isStandaloneHost}
          hostThumbnailVersions={hostThumbnailVersions}
          activeProjectId={activeProjectId}
          projectActionMessage={
            openFailureNotice ??
            projectAction?.message ??
            (isStandaloneHost ? projectLibraryState.message : importNotice)
          }
          onClose={showEditor}
          onOpenCanvas={handleOpenCanvas}
          onOpenProject={handleOpenProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={(projectId) => handleDeleteProject(projectId, true)}
          onRenameProject={hasDurableLibrary ? handleRenameProject : undefined}
          onRevealProject={
            capabilities.vscodeActions && hostState.workspaceTrusted
              ? (projectId) => {
                  revealProject(projectId);
                }
              : undefined
          }
          onRenameCanvas={handleRenameCanvas}
          onDuplicateCanvas={handleDuplicateCanvas}
          onDeleteCanvas={handleDeleteCanvas}
          onRefreshProjects={refreshProjectLibrary}
          onNavigate={(next) => {
            if (next === "home") navigateRoute({ name: "home" });
            if (next === "settings") navigateRoute({ name: "settings" });
            if (next === "connectors") navigateRoute({ name: "connectors" });
          }}
          onNewCanvas={(categoryId) => handleNewCanvas(categoryId)}
          onOpenFile={handleOpenFile}
          onStartDesign={handleStartDesign}
          onImageToSvg={() => {
            handleNewCanvas();
            setVectorDialogOpen(true);
          }}
          onRecreateScreenshot={() => screenshotInputRef.current?.click()}
          onImportAsset={() => assetInputRef.current?.click()}
          modelCatalog={modelCatalog}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
        />
      )}
    </div>
  );
}

function isProjectUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

const SELECTED_MODEL_STORAGE_KEY = "codex-avatar-studio-selected-model";

function readStoredSelectedModelId(): string {
  try {
    return window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function projectConversationUrl(projectId: string, conversationId?: string): string | null {
  if (!isProjectUuid(projectId) || (conversationId && !isProjectUuid(conversationId))) return null;
  return `/api/projects/${projectId}/conversations${conversationId ? `/${conversationId}` : ""}`;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
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

function adaptEditorForVariants(editor: Editor): VariantFrameEditor {
  return {
    markHistoryStoppingPoint: (name) => editor.markHistoryStoppingPoint(name),
    createShape: (shape) => {
      if (shape.type !== "frame") return;
      editor.createShape({
        type: "frame",
        x: shape.x,
        y: shape.y,
        props: {
          w: typeof shape.props.w === "number" ? shape.props.w : 800,
          h: typeof shape.props.h === "number" ? shape.props.h : 600,
          name: typeof shape.props.name === "string" ? shape.props.name : "Variant"
        }
      });
    },
    getCurrentPageShapes: () =>
      editor.getCurrentPageShapes().map((shape) => ({
        id: shape.id,
        type: shape.type,
        props: {
          ...(typeof (shape.props as { name?: unknown }).name === "string"
            ? { name: (shape.props as { name: string }).name }
            : {})
        }
      })),
    deleteShapes: (ids) =>
      editor.deleteShapes(
        editor
          .getCurrentPageShapes()
          .filter((shape) => ids.includes(shape.id))
          .map((shape) => shape.id)
      )
  };
}

export default App;

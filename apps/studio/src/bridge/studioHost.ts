import {
  createStudioToHostMessage,
  type HostToStudioMessage,
  parseHostToStudioMessage,
  STUDIO_PROTOCOL_VERSION,
  type StudioChatUsage,
  type StudioModel,
  type StudioProjectDocument,
  type StudioProjectMeta,
  type StudioToHostMessage,
  type StudioToHostMessageInput
} from "@codex-avatar-studio/avatar-core";
import { useCallback, useEffect, useRef, useState } from "react";

export type { StudioProjectMeta };
export type StudioImageAttachment = Extract<StudioToHostMessageInput, { type: "studio:chatRequest" }>["attachment"];

type HostStateMessage = Extract<HostToStudioMessage, { type: "studio:hostState" }>;
type CatalogMessage = Extract<HostToStudioMessage, { type: "studio:modelCatalog" }>;
export type StudioConnectionAction = "connect" | "replace" | "test" | "disconnect";

export interface StudioChatRun {
  requestId: string;
  modelId: string;
  status: "streaming" | "stopping" | "complete" | "error";
  text: string;
  message?: string;
  errorCode?: string;
  usage?: StudioChatUsage;
}

export interface StudioModelCatalog {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
  models: StudioModel[];
  refreshedAt?: string;
}

export interface StudioProjectsState {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
  projects: StudioProjectMeta[];
  corruptCount: number;
}

export interface StudioProjectAction {
  requestId: string;
  status:
    | "opening"
    | "importing"
    | "ensuring"
    | "renaming"
    | "revealing"
    | "saving"
    | "opened"
    | "imported"
    | "ensured"
    | "renamed"
    | "revealed"
    | "saved"
    | "deleted"
    | "error"
    | "cancelled";
  projectId?: string;
  message?: string;
  project?: StudioProjectDocument;
}

interface VsCodeApi {
  postMessage(message: StudioToHostMessage): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

let vscodeApi: VsCodeApi | null | undefined;

function getVsCodeApi(): VsCodeApi | null {
  if (vscodeApi !== undefined) return vscodeApi;
  if (typeof window === "undefined" || typeof window.acquireVsCodeApi !== "function") {
    vscodeApi = null;
    return vscodeApi;
  }
  try {
    vscodeApi = window.acquireVsCodeApi();
  } catch {
    vscodeApi = null;
  }
  return vscodeApi;
}

function initialHostState(): HostStateMessage {
  return {
    protocolVersion: STUDIO_PROTOCOL_VERSION,
    type: "studio:hostState",
    host: getVsCodeApi() ? "vscode" : "browser",
    workspaceTrusted: false,
    connection: {
      status: "disconnected",
      message: getVsCodeApi()
        ? "Checking the Studio connection…"
        : "Open Studio from VS Code to connect OpenRouter. This browser preview never accepts API keys."
    }
  };
}

function sendToHost(message: StudioToHostMessageInput): void {
  getVsCodeApi()?.postMessage(createStudioToHostMessage(message));
}

export function useStudioHost() {
  const [hostState, setHostState] = useState<HostStateMessage>(initialHostState);
  const [modelCatalog, setModelCatalog] = useState<StudioModelCatalog>({
    status: "idle",
    message: "Connect OpenRouter to load models.",
    models: []
  });
  const [chatRun, setChatRun] = useState<StudioChatRun | null>(null);
  const [projects, setProjects] = useState<StudioProjectsState>({
    status: "idle",
    message: "Projects are available in a trusted local VS Code workspace.",
    projects: [],
    corruptCount: 0
  });
  const [projectAction, setProjectAction] = useState<StudioProjectAction | null>(null);
  const requestedCatalog = useRef(false);
  const requestedProjectList = useRef(false);
  const pendingTraces = useRef(new Map<string, { resolve: (svg: string) => void; reject: (error: Error) => void }>());

  const requestModelCatalog = useCallback(() => {
    if (!getVsCodeApi()) return;
    setModelCatalog({ status: "loading", message: "Loading the OpenRouter model catalog.", models: [] });
    sendToHost({ type: "studio:modelCatalogRequest" });
  }, []);

  useEffect(() => {
    if (!getVsCodeApi()) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      const parsed = parseHostToStudioMessage(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "studio:imageTraced" || message.type === "studio:traceError") {
        const pending = pendingTraces.current.get(message.requestId);
        if (pending) {
          pendingTraces.current.delete(message.requestId);
          if (message.type === "studio:imageTraced") pending.resolve(message.svg);
          else pending.reject(new Error(message.message));
        }
      }
      if (message.type === "studio:hostState") setHostState(message);
      if (message.type === "studio:modelCatalog") {
        const result: CatalogMessage = message;
        setModelCatalog({
          status: result.status,
          message: result.message,
          models: result.models,
          ...(result.refreshedAt ? { refreshedAt: result.refreshedAt } : {})
        });
      }
      if (message.type === "studio:projectList") {
        setProjects({
          status: message.status,
          message: message.message,
          projects: message.projects,
          corruptCount: message.corruptCount
        });
      }
      if (message.type === "studio:projectOpened") {
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? {
                requestId: message.requestId,
                status: "opened",
                projectId: message.project.id,
                project: message.project
              }
            : current
        );
      }
      if (message.type === "studio:projectImported") {
        const { id, title, createdAt, updatedAt } = message.project;
        setProjects((current) => ({
          ...current,
          status: "ready",
          projects: [
            { id, title, createdAt, updatedAt },
            ...current.projects.filter((project) => project.id !== id)
          ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        }));
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? {
                requestId: message.requestId,
                status: "imported",
                projectId: id,
                project: message.project
              }
            : current
        );
      }
      if (message.type === "studio:scratchpadEnsured") {
        const { id, title, createdAt, updatedAt } = message.project;
        setProjects((current) => ({
          ...current,
          status: "ready",
          projects: [{ id, title, createdAt, updatedAt }, ...current.projects.filter((project) => project.id !== id)]
        }));
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? {
                requestId: message.requestId,
                status: "ensured",
                projectId: id,
                project: message.project
              }
            : current
        );
      }
      if (message.type === "studio:projectSaved") {
        setProjects((current) => ({
          ...current,
          projects: [message.project, ...current.projects.filter((project) => project.id !== message.project.id)].sort(
            (left, right) => right.updatedAt.localeCompare(left.updatedAt)
          )
        }));
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? { requestId: message.requestId, status: "saved", projectId: message.project.id }
            : current
        );
      }
      if (message.type === "studio:projectRenamed") {
        setProjects((current) => ({
          ...current,
          projects: [message.project, ...current.projects.filter((project) => project.id !== message.project.id)].sort(
            (left, right) => right.updatedAt.localeCompare(left.updatedAt)
          )
        }));
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? { requestId: message.requestId, status: "renamed", projectId: message.project.id }
            : current
        );
      }
      if (message.type === "studio:projectRevealed") {
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? { requestId: message.requestId, status: "revealed", projectId: message.projectId }
            : current
        );
      }
      if (message.type === "studio:projectDeleted") {
        setProjects((current) => ({
          ...current,
          projects: current.projects.filter((project) => project.id !== message.projectId)
        }));
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? { requestId: message.requestId, status: "deleted", projectId: message.projectId }
            : current
        );
      }
      if (message.type === "studio:projectError") {
        setProjectAction((current) =>
          current?.requestId === message.requestId
            ? {
                requestId: message.requestId,
                status: message.code === "cancelled" ? "cancelled" : "error",
                message: message.message
              }
            : current
        );
      }
      if (message.type === "studio:chatDelta") {
        setChatRun((current) =>
          current?.requestId === message.requestId && current.status === "streaming"
            ? { ...current, text: (current.text + message.delta).slice(0, 256_000) }
            : current
        );
      }
      if (message.type === "studio:chatComplete") {
        setChatRun((current) =>
          current?.requestId === message.requestId
            ? { ...current, status: "complete", ...(message.usage ? { usage: message.usage } : {}) }
            : current
        );
      }
      if (message.type === "studio:chatError") {
        setChatRun((current) =>
          current?.requestId === message.requestId
            ? { ...current, status: "error", errorCode: message.code, message: message.message }
            : current
        );
      }
    };
    window.addEventListener("message", onMessage);
    sendToHost({ type: "studio:ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      for (const pending of pendingTraces.current.values()) pending.reject(new Error("The Studio panel closed."));
      pendingTraces.current.clear();
    };
  }, []);

  useEffect(() => {
    if (hostState.host !== "vscode") return;
    if (!hostState.workspaceTrusted) {
      requestedProjectList.current = false;
      setProjects((current) =>
        current.status === "ready"
          ? current
          : {
              ...current,
              status: "error",
              message: "Trust a local workspace to open or save Studio projects."
            }
      );
      return;
    }
    if (!requestedProjectList.current) {
      requestedProjectList.current = true;
      setProjects((current) => ({ ...current, status: "loading", message: "Loading workspace projects." }));
      sendToHost({ type: "studio:projectListRequest" });
    }
  }, [hostState.host, hostState.workspaceTrusted]);

  useEffect(() => {
    const connectedAndTrusted =
      hostState.host === "vscode" && hostState.workspaceTrusted && hostState.connection.status === "connected";
    if (!connectedAndTrusted) {
      requestedCatalog.current = false;
      if (modelCatalog.status !== "idle")
        setModelCatalog({ status: "idle", message: "Connect OpenRouter to load models.", models: [] });
      return;
    }
    if (!requestedCatalog.current) {
      requestedCatalog.current = true;
      requestModelCatalog();
    }
  }, [
    hostState.host,
    hostState.workspaceTrusted,
    hostState.connection.status,
    modelCatalog.status,
    requestModelCatalog
  ]);

  const onConnectionAction = useCallback((action: StudioConnectionAction) => {
    if (!getVsCodeApi()) return;
    sendToHost({ type: "studio:openRouterConnection", action });
  }, []);

  const sendChat = useCallback(
    (
      modelId: string,
      history: Array<{ role: "user" | "assistant"; content: string }>,
      userMessage: string,
      attachment?: StudioImageAttachment
    ) => {
      if (!getVsCodeApi()) return null;
      const requestId = `chat-${crypto.randomUUID()}`;
      setChatRun({ requestId, modelId, status: "streaming", text: "" });
      sendToHost({ type: "studio:chatRequest", requestId, modelId, history, userMessage, ...(attachment ? { attachment } : {}) });
      return requestId;
    },
    []
  );

  const traceImage = useCallback((dataBase64: string) => {
    if (!getVsCodeApi()) return Promise.reject(new Error("Open Studio from VS Code to use the local VTracer engine."));
    const requestId = `trace-${crypto.randomUUID()}`;
    return new Promise<string>((resolve, reject) => {
      pendingTraces.current.set(requestId, { resolve, reject });
      sendToHost({ type: "studio:traceImage", requestId, mediaType: "image/png", dataBase64 });
    });
  }, []);

  const cancelChat = useCallback((requestId: string) => {
    if (!getVsCodeApi()) return;
    setChatRun((current) => (current?.requestId === requestId ? { ...current, status: "stopping" } : current));
    sendToHost({ type: "studio:chatCancel", requestId });
  }, []);

  const clearChatRun = useCallback(() => setChatRun(null), []);

  const requestProjects = useCallback(() => {
    if (!getVsCodeApi()) return;
    requestedProjectList.current = true;
    setProjects((current) => ({ ...current, status: "loading", message: "Loading workspace projects." }));
    sendToHost({ type: "studio:projectListRequest" });
  }, []);

  const openProject = useCallback((projectId: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "opening" });
    sendToHost({ type: "studio:projectOpen", requestId, projectId });
    return requestId;
  }, []);

  const importProject = useCallback(() => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "importing" });
    sendToHost({ type: "studio:projectImportRequest", requestId });
    return requestId;
  }, []);

  const ensureScratchpad = useCallback((snapshot: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "ensuring" });
    sendToHost({ type: "studio:ensureScratchpad", requestId, snapshot });
    return requestId;
  }, []);

  const saveProject = useCallback((projectId: string, title: string, snapshot: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "saving" });
    sendToHost({ type: "studio:projectSave", requestId, projectId, title, snapshot });
    return requestId;
  }, []);

  const duplicateProject = useCallback((projectId: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "saving" });
    sendToHost({ type: "studio:projectDuplicate", requestId, projectId });
    return requestId;
  }, []);

  const renameProject = useCallback((projectId: string, title: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "renaming", projectId });
    sendToHost({ type: "studio:projectRename", requestId, projectId, title });
    return requestId;
  }, []);

  const revealProject = useCallback((projectId: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "revealing", projectId });
    sendToHost({ type: "studio:projectReveal", requestId, projectId });
    return requestId;
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    if (!getVsCodeApi()) return null;
    const requestId = `project-${crypto.randomUUID()}`;
    setProjectAction({ requestId, status: "saving" });
    sendToHost({ type: "studio:projectDelete", requestId, projectId });
    return requestId;
  }, []);

  const clearProjectAction = useCallback(() => setProjectAction(null), []);

  return {
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
    openProject,
    importProject,
    ensureScratchpad,
    saveProject,
    duplicateProject,
    renameProject,
    revealProject,
    deleteProject,
    clearProjectAction
  };
}

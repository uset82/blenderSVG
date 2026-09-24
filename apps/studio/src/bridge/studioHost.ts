import {
  type HostToStudioMessage,
  STUDIO_PROTOCOL_VERSION,
  type StudioChatUsage,
  type StudioModel,
  type StudioProjectDocument,
  type StudioProjectMeta,
  type StudioToHostMessage,
  type StudioToHostMessageInput
} from "@codex-avatar-studio/avatar-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolCallRecord } from "../components/toolCallCard.js";
import { OFFLINE_HOST_MESSAGE, type StudioTransport, selectStudioTransport } from "./studioTransports.js";

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
  reasoning?: string;
  message?: string;
  errorCode?: string;
  usage?: StudioChatUsage;
}

export interface StudioToolCall extends ToolCallRecord {
  requestId: string;
  callId: string;
  summary: string;
  readOnly: boolean;
  requiresApproval: boolean;
  imageDataUrl?: string;
}

export interface StudioToolExecution {
  requestId: string;
  callId: string;
  name: string;
  arguments: string;
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
      message: getVsCodeApi() ? "Checking the Studio connection…" : OFFLINE_HOST_MESSAGE
    }
  };
}

let activeTransport: StudioTransport | null = null;

function currentTransport(): StudioTransport {
  if (!activeTransport) activeTransport = selectStudioTransport({ vscodeApi: getVsCodeApi() });
  return activeTransport;
}

function sendToHost(message: StudioToHostMessageInput): void {
  if (currentTransport().kind === "fixture" && !getVsCodeApi()) return;
  currentTransport().send(message);
}

export function useStudioHost() {
  const [hostState, setHostState] = useState<HostStateMessage>(initialHostState);
  const [modelCatalog, setModelCatalog] = useState<StudioModelCatalog>({
    status: "idle",
    message: "Connect OpenRouter to load models.",
    models: []
  });
  const [chatRun, setChatRun] = useState<StudioChatRun | null>(null);
  const [toolCalls, setToolCalls] = useState<StudioToolCall[]>([]);
  const [pendingToolExecutions, setPendingToolExecutions] = useState<StudioToolExecution[]>([]);
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
    const transport = currentTransport();
    if (transport.kind === "fixture") return;
    const stop = transport.subscribe((message) => {
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
      if (message.type === "studio:toolProposed") {
        const id = `${message.requestId}::${message.callId}`;
        setToolCalls((current) =>
          [
            ...current.filter((call) => call.id !== id),
            {
              id,
              requestId: message.requestId,
              callId: message.callId,
              name: message.name,
              summary: message.summary,
              requiresApproval: message.requiresApproval,
              arguments: message.arguments,
              status: "proposed" as const,
              durationMs: null,
              result: null,
              readOnly: isReadOnlyTool(message.name)
            }
          ].slice(-24)
        );
      }
      if (message.type === "studio:toolExecute") {
        const execution = {
          requestId: message.requestId,
          callId: message.callId,
          name: message.name,
          arguments: message.arguments
        };
        setPendingToolExecutions((current) =>
          current.some((item) => item.requestId === execution.requestId && item.callId === execution.callId)
            ? current
            : [...current, execution]
        );
        setToolCalls((current) =>
          current.map((call) =>
            call.requestId === message.requestId && call.callId === message.callId
              ? { ...call, status: "running" }
              : call
          )
        );
      }
      if (message.type === "studio:toolResult") {
        setToolCalls((current) =>
          current.map((call) => {
            if (call.requestId !== message.requestId || call.callId !== message.callId || call.status === "rejected")
              return call;
            return { ...call, status: message.ok ? "applied" : "error", result: message.summary };
          })
        );
      }
      if (message.type === "studio:chatReasoning") {
        setChatRun((current) =>
          current?.requestId === message.requestId && current.status === "streaming"
            ? { ...current, reasoning: `${current.reasoning ?? ""}${message.delta}`.slice(0, 256_000) }
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
        setPendingToolExecutions((current) => current.filter((call) => call.requestId !== message.requestId));
        setToolCalls((current) =>
          current.map((call) =>
            call.requestId === message.requestId && (call.status === "proposed" || call.status === "running")
              ? { ...call, status: "error", result: message.message }
              : call
          )
        );
        setChatRun((current) =>
          current?.requestId === message.requestId
            ? { ...current, status: "error", errorCode: message.code, message: message.message }
            : current
        );
      }
    });
    sendToHost({ type: "studio:ready" });
    return () => {
      stop();
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
      attachment?: StudioImageAttachment,
      mode?: "ask" | "plan" | "build" | "auto"
    ) => {
      if (!getVsCodeApi()) return null;
      const requestId = `chat-${crypto.randomUUID()}`;
      setChatRun({ requestId, modelId, status: "streaming", text: "" });
      sendToHost({
        type: "studio:chatRequest",
        requestId,
        modelId,
        history,
        userMessage,
        ...(attachment ? { attachment } : {}),
        ...(mode ? { mode } : {})
      });
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

  const approveToolCall = useCallback(
    (id: string) => {
      const call = toolCalls.find((item) => item.id === id);
      if (
        !call?.requiresApproval ||
        call.status !== "proposed" ||
        hostState.host !== "vscode" ||
        !hostState.workspaceTrusted
      )
        return;
      setToolCalls((current) => current.map((item) => (item.id === id ? { ...item, status: "running" } : item)));
      sendToHost({ type: "studio:toolPermission", requestId: call.requestId, callId: call.callId, granted: true });
    },
    [hostState.host, hostState.workspaceTrusted, toolCalls]
  );

  const rejectToolCall = useCallback(
    (id: string) => {
      const call = toolCalls.find((item) => item.id === id);
      if (
        !call?.requiresApproval ||
        call.status !== "proposed" ||
        hostState.host !== "vscode" ||
        !hostState.workspaceTrusted
      )
        return;
      setToolCalls((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "rejected", result: "Declined. No canvas changes were made." } : item
        )
      );
      sendToHost({ type: "studio:toolPermission", requestId: call.requestId, callId: call.callId, granted: false });
    },
    [hostState.host, hostState.workspaceTrusted, toolCalls]
  );

  const completeToolExecution = useCallback(
    (requestId: string, callId: string, result: { ok: boolean; content: string; imageDataUrl?: string }) => {
      const boundedContent = result.content.slice(0, 16_384);
      setPendingToolExecutions((current) =>
        current.filter((call) => call.requestId !== requestId || call.callId !== callId)
      );
      setToolCalls((current) =>
        current.map((call) =>
          call.requestId === requestId && call.callId === callId
            ? {
                ...call,
                status: result.ok ? "applied" : "error",
                result: boundedContent,
                ...(result.imageDataUrl ? { imageDataUrl: result.imageDataUrl } : {})
              }
            : call
        )
      );
      sendToHost({
        type: "studio:toolExecutionResult",
        requestId,
        callId,
        ok: result.ok,
        content: boundedContent,
        ...(result.imageDataUrl ? { imageDataUrl: result.imageDataUrl } : {})
      });
    },
    []
  );

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

function isReadOnlyTool(name: string): boolean {
  return ["get_canvas_summary", "get_selection", "get_frame_tree", "screenshot_frame", "get_styles"].includes(name);
}

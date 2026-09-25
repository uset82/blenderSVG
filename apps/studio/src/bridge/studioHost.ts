import type {
  HostToStudioMessage,
  StudioChatUsage,
  StudioConversationMeta,
  StudioConversationRecord,
  StudioModel,
  StudioProjectDocument,
  StudioProjectMeta,
  StudioToHostMessage,
  StudioToHostMessageInput
} from "@codex-avatar-studio/avatar-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ToolCallRecord, withToolTiming } from "../components/toolCallCard.js";
import { createInitialHostState } from "../web/initialHostState.js";
import { isWebEdition } from "../web/kurvaTarget.js";
import {
  createReconnectingWebSocketTransport,
  type StudioTransport,
  selectStudioTransport
} from "./studioTransports.js";

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

type StudioConversationResponse = Extract<
  HostToStudioMessage,
  {
    type:
      | "studio:conversationList"
      | "studio:conversationRead"
      | "studio:conversationSaved"
      | "studio:conversationRenamed"
      | "studio:conversationDeleted"
      | "studio:conversationError";
  }
>;
type StudioConversationRequest =
  Extract<
    StudioToHostMessageInput,
    {
      type:
        | "studio:conversationListRequest"
        | "studio:conversationReadRequest"
        | "studio:conversationSaveRequest"
        | "studio:conversationRenameRequest"
        | "studio:conversationDeleteRequest";
    }
  > extends infer Request
    ? Request extends { requestId: string }
      ? Omit<Request, "requestId">
      : never
    : never;

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
  if (isWebEdition()) {
    vscodeApi = null;
    return null;
  }
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

function hasStandaloneSession(): boolean {
  if (isWebEdition()) return false;
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("studioToken")?.trim()) return true;
  try {
    return window.sessionStorage.getItem("kurva-studio-standalone") === "1";
  } catch {
    return false;
  }
}

function standaloneLaunchToken(): string | null {
  if (isWebEdition()) return null;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("studioToken")?.trim() || null;
}

function initialHostState(): HostStateMessage {
  if (isWebEdition()) return createInitialHostState({ webEdition: true, vscode: false, standalone: false });
  const vscode = Boolean(getVsCodeApi());
  return createInitialHostState({ webEdition: false, vscode, standalone: !vscode && hasStandaloneSession() });
}

let activeTransport: StudioTransport | null = null;

function currentTransport(): StudioTransport {
  if (!activeTransport) {
    if (isWebEdition()) {
      activeTransport = createDeferredWebTransport();
      return activeTransport;
    }
    const vscodeApi = getVsCodeApi();
    if (vscodeApi) activeTransport = selectStudioTransport({ vscodeApi });
    else if (hasStandaloneSession()) {
      const socketUrl = new URL("/api/studio", window.location.href);
      socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
      socketUrl.search = "";
      const launchToken = standaloneLaunchToken();
      if (launchToken) socketUrl.searchParams.set("studioToken", launchToken);
      socketUrl.hash = "";
      activeTransport = createReconnectingWebSocketTransport(() => new WebSocket(socketUrl));
    } else activeTransport = selectStudioTransport();
  }
  return activeTransport;
}

function createDeferredWebTransport(): StudioTransport {
  let inner: StudioTransport | null = null;
  const queued: StudioToHostMessageInput[] = [];
  const listeners = new Set<(message: HostToStudioMessage) => void>();
  void import("../web/webHostTransport.js").then((module) => {
    inner = module.createWebHostTransport();
    inner.subscribe((message) => {
      for (const listener of listeners) listener(message);
    });
    for (const message of queued.splice(0)) inner.send(message);
  });
  return {
    kind: "web",
    send(message) {
      if (inner) inner.send(message);
      else queued.push(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

function sendToHost(message: StudioToHostMessageInput): void {
  if (currentTransport().kind === "fixture" && !getVsCodeApi()) return;
  currentTransport().send(message);
}

/** Web chat is connected without a desktop workspace. Other hosts still need a trusted workspace. */
export function shouldLoadModelCatalog(input: {
  host: string;
  workspaceTrusted: boolean;
  connectionStatus: string;
}): boolean {
  if (input.connectionStatus !== "connected") return false;
  if (input.host === "web") return true;
  return (input.host === "vscode" || input.host === "standalone") && input.workspaceTrusted;
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
  const pendingConversations = useRef(
    new Map<
      string,
      {
        resolve: (message: StudioConversationResponse) => void;
        reject: (error: Error) => void;
        timeout: number;
      }
    >()
  );

  const requestModelCatalog = useCallback(() => {
    if (currentTransport().kind === "fixture") return;
    setModelCatalog({ status: "loading", message: "Loading the OpenRouter model catalog.", models: [] });
    sendToHost({ type: "studio:modelCatalogRequest" });
  }, []);

  useEffect(() => {
    if (!isWebEdition()) return;
    const onAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "disconnect" || action === "test") {
        sendToHost({ type: "studio:openRouterConnection", action });
      }
    };
    window.addEventListener("kurva-web-openrouter", onAction);
    return () => window.removeEventListener("kurva-web-openrouter", onAction);
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
      if (
        message.type === "studio:conversationList" ||
        message.type === "studio:conversationRead" ||
        message.type === "studio:conversationSaved" ||
        message.type === "studio:conversationRenamed" ||
        message.type === "studio:conversationDeleted" ||
        message.type === "studio:conversationError"
      ) {
        const pending = pendingConversations.current.get(message.requestId);
        if (pending) {
          pendingConversations.current.delete(message.requestId);
          window.clearTimeout(pending.timeout);
          if (message.type === "studio:conversationError") pending.reject(new Error(message.message));
          else pending.resolve(message);
        }
      }
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
              ? withToolTiming(call, "running")
              : call
          )
        );
      }
      if (message.type === "studio:toolResult") {
        setToolCalls((current) =>
          current.map((call) => {
            if (call.requestId !== message.requestId || call.callId !== message.callId || call.status === "rejected")
              return call;
            return withToolTiming({ ...call, result: message.summary }, message.ok ? "applied" : "error");
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
    if (currentTransport().kind !== "websocket") sendToHost({ type: "studio:ready" });
    return () => {
      stop();
      for (const pending of pendingTraces.current.values()) pending.reject(new Error("The Studio panel closed."));
      pendingTraces.current.clear();
      for (const pending of pendingConversations.current.values()) {
        window.clearTimeout(pending.timeout);
        pending.reject(new Error("The Studio panel closed."));
      }
      pendingConversations.current.clear();
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
    const connectedAndTrusted = shouldLoadModelCatalog({
      host: hostState.host,
      workspaceTrusted: hostState.workspaceTrusted,
      connectionStatus: hostState.connection.status
    });
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
    if (currentTransport().kind === "fixture") return;
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
      if (currentTransport().kind === "fixture") return null;
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
    if (currentTransport().kind === "fixture") return;
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
        (hostState.host !== "vscode" && hostState.host !== "standalone") ||
        !hostState.workspaceTrusted
      )
        return;
      setToolCalls((current) => current.map((item) => (item.id === id ? withToolTiming(item, "running") : item)));
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
        (hostState.host !== "vscode" && hostState.host !== "standalone") ||
        !hostState.workspaceTrusted
      )
        return;
      setToolCalls((current) =>
        current.map((item) =>
          item.id === id
            ? withToolTiming({ ...item, result: "Declined. No canvas changes were made." }, "rejected")
            : item
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
            ? withToolTiming(
                {
                  ...call,
                  result: boundedContent,
                  ...(result.imageDataUrl ? { imageDataUrl: result.imageDataUrl } : {})
                },
                result.ok ? "applied" : "error"
              )
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

  const requestConversation = useCallback((request: StudioConversationRequest): Promise<StudioConversationResponse> => {
    if (!getVsCodeApi()) return Promise.reject(new Error("Saved conversations require a trusted VS Code workspace."));
    const requestId = `conversation-${crypto.randomUUID()}`;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingConversations.current.delete(requestId);
        reject(new Error("The conversation request timed out. Try again."));
      }, 15_000);
      pendingConversations.current.set(requestId, { resolve, reject, timeout });
      try {
        sendToHost({ ...request, requestId } as StudioToHostMessageInput);
      } catch {
        window.clearTimeout(timeout);
        pendingConversations.current.delete(requestId);
        reject(new Error("The conversation request could not be sent."));
      }
    });
  }, []);

  const listConversations = useCallback(
    async (projectId: string): Promise<StudioConversationMeta[]> => {
      const response = await requestConversation({ type: "studio:conversationListRequest", projectId });
      if (response.type !== "studio:conversationList") throw new Error("Saved conversations could not be loaded.");
      return response.conversations;
    },
    [requestConversation]
  );

  const readConversation = useCallback(
    async (projectId: string, conversationId: string): Promise<StudioConversationRecord | null> => {
      const response = await requestConversation({ type: "studio:conversationReadRequest", projectId, conversationId });
      if (response.type !== "studio:conversationRead") throw new Error("The saved conversation could not be opened.");
      return response.conversation;
    },
    [requestConversation]
  );

  const saveConversation = useCallback(
    async (
      projectId: string,
      conversation: Pick<StudioConversationRecord, "id" | "title" | "modelId" | "messages">
    ): Promise<void> => {
      const response = await requestConversation({ type: "studio:conversationSaveRequest", projectId, conversation });
      if (response.type !== "studio:conversationSaved") throw new Error("The conversation could not be saved.");
    },
    [requestConversation]
  );

  const renameConversation = useCallback(
    async (projectId: string, conversationId: string, title: string): Promise<void> => {
      const response = await requestConversation({
        type: "studio:conversationRenameRequest",
        projectId,
        conversationId,
        title
      });
      if (response.type !== "studio:conversationRenamed") throw new Error("The conversation title could not be saved.");
    },
    [requestConversation]
  );

  const deleteConversation = useCallback(
    async (projectId: string, conversationId: string): Promise<void> => {
      const response = await requestConversation({
        type: "studio:conversationDeleteRequest",
        projectId,
        conversationId
      });
      if (response.type !== "studio:conversationDeleted") throw new Error("The conversation could not be deleted.");
    },
    [requestConversation]
  );

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
    clearProjectAction,
    listConversations,
    readConversation,
    saveConversation,
    renameConversation,
    deleteConversation
  };
}

function isReadOnlyTool(name: string): boolean {
  return ["get_canvas_summary", "get_selection", "get_frame_tree", "screenshot_frame", "get_styles"].includes(name);
}

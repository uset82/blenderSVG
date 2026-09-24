import {
  STUDIO_CHAT_SYSTEM_PROMPT,
  type StudioChatHistoryMessage,
  type StudioModel
} from "@codex-avatar-studio/avatar-core";
import { ArrowUp, Check, ChevronDown, Plus, RefreshCw, Search, Star, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "tldraw";
import type { StudioChatRun, StudioImageAttachment, StudioModelCatalog, StudioToolCall } from "../bridge/studioHost.js";
import { assertChatImageAttachment } from "../projects/localAssets.js";
import {
  type AgentConversation,
  conversationTitleFromMessage,
  createAgentConversation,
  formatConversationStamp
} from "./agentConversations.js";
import { AGENT_EMPTY_HEADLINE, AGENT_EMPTY_TIPS, AGENT_SUGGESTIONS } from "./agentEmptyState.js";
import { sessionPillStatus } from "./agentSessions.js";
import { ChatMessageBody } from "./ChatMessageBody.js";
import { describeSelection } from "./canvasContextMenu.js";
import { canStartSend, lastExchange } from "./chatActions.js";
import { type ComposerMenuAction, composerMenuItems } from "./composerMenu.js";
import { type ComposerMode, modeDescription, nextComposerMode } from "./composerModes.js";
import { capCanvasSummary, compactHistory } from "./contextBudget.js";
import { filterStudioModels, type ModalityFilter, type PriceFilter, readCatalogPrice } from "./modelFilters.js";
import { filterModelsByBadges, groupCatalogModels, modelBadges, type QuickModelFilter } from "./modelPicker.js";
import { paidModelCue, sendContextLines } from "./privacyContext.js";
import { readProjectStyle } from "./projectStyle.js";
import { chatRunStatusLabel } from "./shellStatus.js";
import { ToolCallCard } from "./ToolCallView.js";
import { effectiveComposerMode } from "./toolModeFallback.js";

export type OpenRouterConnectionAction = "connect" | "replace" | "test" | "disconnect";

export interface AgentHarnessSidebarProps {
  className?: string;
  isOpen: boolean;
  draftPrefill?: { id: string; text: string } | null;
  draftImagePrefill?: { id: string; file: File } | null;
  onClose: () => void;
  connectionHost: "vscode" | "browser";
  workspaceTrusted: boolean;
  connection: {
    status: "disconnected" | "connected" | "checking" | "error";
    message: string;
  };
  modelCatalog: StudioModelCatalog;
  chatRun: StudioChatRun | null;
  toolCalls: StudioToolCall[];
  panelWidth: number;
  panelHeight: number;
  editor?: Editor | null;
  onConnectionAction: (action: OpenRouterConnectionAction) => void;
  onRefreshModels: () => void;
  onSendChat: (
    modelId: string,
    history: StudioChatHistoryMessage[],
    userMessage: string,
    attachment?: StudioImageAttachment,
    mode?: "ask" | "plan" | "build" | "auto"
  ) => string | null;
  onCancelChat: (requestId: string) => void;
  onClearChatRun: () => void;
  onApproveToolCall: (id: string) => void;
  onRejectToolCall: (id: string) => void;
  onPersistConversation?: (conversation: {
    id: string;
    title: string;
    modelId: string;
    updatedAt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversation?: (id: string) => void;
  projectId?: string | null;
  onSessionsChange?: (sessions: Array<{ id: string; title: string; status: "running" | "finished" | "idle" }>) => void;
  onOpenVectorDialog?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  status: "complete" | "streaming" | "error";
  errorMessage?: string;
  attachment?: { file: File; dataUrl: string };
}

interface OutboundPreview {
  model: StudioModel;
  mode: "ask" | "plan" | "build" | "auto";
  history: StudioChatHistoryMessage[];
  message: string;
  omittedMessages: number;
  attachment?: { file: File; dataUrl: string };
}

export function AgentHarnessSidebar({
  className,
  isOpen,
  draftPrefill,
  draftImagePrefill,
  onClose,
  connectionHost,
  workspaceTrusted,
  connection,
  modelCatalog,
  chatRun,
  toolCalls,
  panelWidth,
  panelHeight,
  editor = null,
  onConnectionAction,
  onRefreshModels,
  onSendChat,
  onCancelChat,
  onClearChatRun,
  onApproveToolCall,
  onRejectToolCall,
  onPersistConversation,
  onRenameConversation,
  onDeleteConversation,
  projectId = null,
  onSessionsChange,
  onOpenVectorDialog
}: AgentHarnessSidebarProps) {
  const [selectedModelId, setSelectedModelId] = useState(readSelectedModelId);
  const [modelQuery, setModelQuery] = useState("");
  const [quickModelFilters, setQuickModelFilters] = useState<QuickModelFilter[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [authorFilter, setAuthorFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>("all");
  const [minimumContext, setMinimumContext] = useState("all");
  const [maximumInputPrice, setMaximumInputPrice] = useState("");
  const [maximumOutputPrice, setMaximumOutputPrice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationList, setConversationList] = useState<AgentConversation[]>(() => [
    createAgentConversation(readSelectedModelId())
  ]);
  const [activeConversationId, setActiveConversationId] = useState(() => conversationList[0]?.id ?? "");
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
  const [variantScale, setVariantScale] = useState(1);
  const consentKey = `studio-chat-consent-v2:${projectId || "browser-session"}`;
  const [consented, setConsented] = useState(() => {
    try {
      return window.sessionStorage.getItem(consentKey) === "yes";
    } catch {
      return false;
    }
  });
  const [consentOpen, setConsentOpen] = useState(false);
  const [alwaysPreview, setAlwaysPreview] = useState(() => {
    try {
      return window.localStorage.getItem("studio-always-preview") !== "no";
    } catch {
      return true;
    }
  });
  const transcriptsRef = useRef(new Map<string, ChatMessage[]>());
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [favoriteTick, setFavoriteTick] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerAnchorRef = useRef<HTMLDivElement>(null);
  const modelPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const modelPickerSearchRef = useRef<HTMLInputElement>(null);
  const modelPickerListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [outboundPreview, setOutboundPreview] = useState<OutboundPreview | null>(null);
  const previewSendRef = useRef<HTMLButtonElement>(null);
  const lastDraftPrefillIdRef = useRef<string | null>(null);
  const lastImagePrefillIdRef = useRef<string | null>(null);

  useEffect(() => {
    onSessionsChange?.(
      conversationList.map((item) => ({
        id: item.id,
        title: item.title,
        status: sessionPillStatus(item.id === activeConversationId, chatRun?.status ?? null)
      }))
    );
  }, [activeConversationId, chatRun, conversationList, onSessionsChange]);

  useEffect(() => {
    if (!draftPrefill || draftPrefill.id === lastDraftPrefillIdRef.current) return;
    lastDraftPrefillIdRef.current = draftPrefill.id;
    setDraft(draftPrefill.text);
  }, [draftPrefill]);

  useEffect(() => {
    if (!draftImagePrefill || draftImagePrefill.id === lastImagePrefillIdRef.current) return;
    lastImagePrefillIdRef.current = draftImagePrefill.id;
    setAttachedImage(draftImagePrefill.file);
    setAttachmentError(null);
  }, [draftImagePrefill]);

  useEffect(() => {
    if (!attachedImage) {
      setAttachmentUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachedImage);
    setAttachmentUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachedImage]);

  const canManageConnection = connectionHost === "vscode" && workspaceTrusted && connection.status !== "checking";
  const connected = connection.status === "connected";
  const connectionLabel =
    connection.status === "checking"
      ? "Checking connection"
      : connected
        ? "Connected"
        : connection.status === "error"
          ? "Connection error"
          : "Not connected";
  const connectionMessage =
    connectionHost === "browser"
      ? connection.message
      : !workspaceTrusted
        ? "Trust this workspace before connecting an OpenRouter account."
        : connection.message || "Connect your own OpenRouter account through the VS Code host.";

  const authors = useMemo(
    () => [...new Set(modelCatalog.models.map((model) => model.author).filter(Boolean))].sort(),
    [modelCatalog.models]
  );
  const matchingModels = useMemo(
    () =>
      filterStudioModels(modelCatalog.models, {
        query: modelQuery,
        author: authorFilter,
        price: priceFilter,
        modality: modalityFilter,
        minimumContext: minimumContext === "all" ? null : Number(minimumContext),
        maximumInputPricePerMillion: readOptionalNumber(maximumInputPrice),
        maximumOutputPricePerMillion: readOptionalNumber(maximumOutputPrice)
      }),
    [
      authorFilter,
      maximumInputPrice,
      maximumOutputPrice,
      minimumContext,
      modelCatalog.models,
      modelQuery,
      modalityFilter,
      priceFilter
    ]
  );
  const quickMatchingModels = useMemo(
    () => filterModelsByBadges(matchingModels, quickModelFilters),
    [matchingModels, quickModelFilters]
  );
  const selectedModel = modelCatalog.models.find((model) => model.id === selectedModelId);
  const chooseModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const recent = [modelId, ...readStoredIds(RECENT_MODELS_KEY).filter((id) => id !== modelId)].slice(0, 5);
    writeStoredIds(RECENT_MODELS_KEY, recent);
    setModelPickerOpen(false);
    window.requestAnimationFrame(() => modelPickerTriggerRef.current?.focus());
  };
  const openModelPicker = () => setModelPickerOpen(true);
  const closeModelPicker = (restoreFocus = false) => {
    setModelPickerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => modelPickerTriggerRef.current?.focus());
  };
  const canChat = connectionHost === "vscode" && workspaceTrusted && connected;
  const canSend =
    canChat &&
    modelCatalog.status === "ready" &&
    !!selectedModel?.textChatEligible &&
    (!attachedImage || selectedModel.inputModalities.includes("image")) &&
    !!draft.trim() &&
    !isChatBusy(chatRun);

  useEffect(() => {
    try {
      if (selectedModelId) window.localStorage.setItem("codex-avatar-studio-selected-model", selectedModelId);
      else window.localStorage.removeItem("codex-avatar-studio-selected-model");
    } catch {
      // Keep model selection for this session when browser storage is unavailable.
    }
  }, [selectedModelId]);

  useEffect(() => {
    if (!chatRun) return;
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === chatRun.requestId);
      if (index < 0) return current;
      const updated = current.slice();
      updated[index] = {
        ...updated[index]!,
        content: chatRun.text,
        ...(chatRun.reasoning ? { reasoning: chatRun.reasoning } : {}),
        status: chatRun.status === "complete" ? "complete" : chatRun.status === "error" ? "error" : "streaming",
        ...(chatRun.status === "error" && chatRun.message ? { errorMessage: chatRun.message } : {})
      };
      return updated;
    });
  }, [chatRun]);

  useEffect(() => {
    if (outboundPreview) previewSendRef.current?.focus();
  }, [outboundPreview]);

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(160, Math.max(44, node.scrollHeight))}px`;
  }, [draft, isOpen]);

  useEffect(() => {
    if (modelPickerOpen) modelPickerSearchRef.current?.focus();
  }, [modelPickerOpen]);

  useEffect(() => {
    if (!isOpen) setModelPickerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!modelPickerAnchorRef.current?.contains(event.target as Node)) setModelPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [modelPickerOpen]);

  useEffect(() => {
    if (!outboundPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOutboundPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [outboundPreview]);

  if (!isOpen) return null;

  const plusItems = composerMenuItems({
    hasEditor: Boolean(editor),
    selectedCount: editor?.getSelectedShapeIds().length ?? 0
  });

  const appendDraft = (text: string) => {
    setDraft((current) => (current.trim() ? `${current.trim()}\n${text}` : text).slice(0, 12_000));
  };

  const addFile = (file: File | undefined) => {
    if (!file) return;
    try {
      assertChatImageAttachment(file);
      setAttachedImage(file);
      setAttachmentError(null);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Choose a PNG, JPEG, WebP, or GIF.");
    }
  };

  const runPlus = async (action: ComposerMenuAction) => {
    setPlusOpen(false);
    if (action === "add-file") {
      fileInputRef.current?.click();
      return;
    }
    if (action === "trace-image") {
      onOpenVectorDialog?.();
      return;
    }
    if (!editor) return;
    if (action === "choose-style") {
      const style = readProjectStyle(editor.getDocumentSettings()?.meta);
      appendDraft(`Use the ${style.name} style.`);
      return;
    }
    if (action !== "add-canvas") return;
    const ids = [...editor.getSelectedShapeIds()];
    const summary = describeSelection(
      ids.flatMap((id) => {
        const shape = editor.getShape(id);
        if (!shape) return [];
        const props = shape.props as { name?: unknown; text?: unknown; w?: unknown; h?: unknown };
        const label =
          typeof props.name === "string" && props.name.trim()
            ? props.name
            : typeof props.text === "string" && props.text.trim()
              ? props.text.slice(0, 40)
              : shape.type;
        return [
          {
            type: shape.type,
            label,
            ...(typeof props.w === "number" ? { w: props.w } : {}),
            ...(typeof props.h === "number" ? { h: props.h } : {})
          }
        ];
      })
    );
    if (summary) appendDraft(summary);
    try {
      const image = await editor.toImage(ids, { format: "png", pixelRatio: 1, background: true, padding: 0 });
      setAttachedImage(new File([image.blob], "selection.png", { type: "image/png" }));
      setAttachmentError(null);
    } catch {
      setAttachmentError("The selection summary was added. Studio could not render a PNG of it.");
    }
  };

  const requestPreview = async (skipConsent = false) => {
    if (
      !canSend ||
      !selectedModel ||
      !canStartSend({ busy: isChatBusy(chatRun), previewOpen: Boolean(outboundPreview) })
    )
      return;
    if (!skipConsent && !consented) {
      setConsentOpen(true);
      return;
    }
    setAttachmentError(null);
    const transcript = messages
      .filter((message) => message.role === "user" || message.status === "complete")
      .map(({ role, content }) => ({ role, content }) as StudioChatHistoryMessage);
    const bounded = boundOutboundHistory(transcript, selectedModel.contextLength);
    let attachment: OutboundPreview["attachment"];
    try {
      if (attachedImage) attachment = { file: attachedImage, dataUrl: await readImageAsDataUrl(attachedImage) };
    } catch {
      setAttachmentError("Studio could not prepare this image locally. Remove it and attach it again.");
      return;
    }
    setOutboundPreview({
      model: selectedModel,
      mode: effectiveComposerMode(composerMode, selectedModel.supportedParameters.includes("tools")).mode,
      history: bounded.history,
      message: draft.trim(),
      omittedMessages: bounded.omittedMessages,
      ...(attachment ? { attachment } : {})
    });
  };

  const sendAfterPreview = () => {
    if (!outboundPreview || isChatBusy(chatRun)) return;
    const requestId = onSendChat(
      outboundPreview.model.id,
      outboundPreview.history,
      outboundPreview.message,
      outboundPreview.attachment ? { dataUrl: outboundPreview.attachment.dataUrl } : undefined,
      outboundPreview.mode
    );
    if (!requestId) return;
    setMessages((current) => [
      ...current,
      {
        id: `user-${requestId}`,
        role: "user",
        content: outboundPreview.message,
        status: "complete",
        ...(outboundPreview.attachment ? { attachment: outboundPreview.attachment } : {})
      },
      { id: requestId, role: "assistant", content: "", status: "streaming" }
    ]);
    setDraft("");
    setAttachedImage(null);
    setOutboundPreview(null);
    const updatedAt = new Date().toISOString();
    const title =
      conversationList.find((item) => item.id === activeConversationId)?.title === "New agent"
        ? conversationTitleFromMessage(outboundPreview.message)
        : (conversationList.find((item) => item.id === activeConversationId)?.title ?? "New agent");
    setConversationList((current) =>
      current.map((item) =>
        item.id === activeConversationId ? { ...item, modelId: outboundPreview.model.id, updatedAt, title } : item
      )
    );
    onPersistConversation?.({
      id: activeConversationId,
      title,
      modelId: outboundPreview.model.id,
      updatedAt,
      messages: [
        ...messages
          .filter((message) => message.status === "complete")
          .map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: outboundPreview.message }
      ]
    });
  };

  const rememberActiveTranscript = () => {
    if (activeConversationId) transcriptsRef.current.set(activeConversationId, messages);
  };

  const openConversation = (id: string) => {
    if (id === activeConversationId) {
      setConversationMenuOpen(false);
      return;
    }
    rememberActiveTranscript();
    const next = conversationList.find((item) => item.id === id);
    setActiveConversationId(id);
    setMessages(transcriptsRef.current.get(id) ?? []);
    if (next?.modelId) setSelectedModelId(next.modelId);
    setDraft("");
    setAttachedImage(null);
    setConversationMenuOpen(false);
  };

  const startNewConversation = () => {
    if (chatRun && isChatBusy(chatRun)) onCancelChat(chatRun.requestId);
    rememberActiveTranscript();
    const next = createAgentConversation(selectedModelId || readSelectedModelId());
    setConversationList((current) => [...current, next]);
    setActiveConversationId(next.id);
    setMessages([]);
    setDraft("");
    setAttachedImage(null);
    setConversationMenuOpen(false);
    onClearChatRun();
  };

  const renameActiveConversation = () => {
    const title = renameTitle.trim();
    if (!title || !activeConversationId) return;
    setConversationList((current) =>
      current.map((item) => (item.id === activeConversationId ? { ...item, title } : item))
    );
    onRenameConversation?.(activeConversationId, title);
    setRenameTitle("");
    setConversationMenuOpen(false);
  };

  const deleteActiveConversation = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = activeConversationId;
    onDeleteConversation?.(id);
    setConversationList((current) => {
      const remaining = current.filter((item) => item.id !== id);
      const next = remaining[0] ?? createAgentConversation(selectedModelId || readSelectedModelId());
      if (remaining.length === 0) remaining.push(next);
      setActiveConversationId(next.id);
      setMessages(transcriptsRef.current.get(next.id) ?? []);
      return remaining;
    });
    setConfirmDelete(false);
    setConversationMenuOpen(false);
  };

  const exportActiveConversation = () => {
    const current = conversationList.find((item) => item.id === activeConversationId);
    const body = {
      id: activeConversationId,
      title: current?.title ?? "New agent",
      modelId: current?.modelId ?? "",
      updatedAt: current?.updatedAt ?? new Date().toISOString(),
      messages: messages
        .filter((message) => message.status === "complete")
        .map((message) => ({ role: message.role, content: message.content }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "conversation.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const stopGeneration = () => {
    if (chatRun && isChatBusy(chatRun)) onCancelChat(chatRun.requestId);
  };

  const retryLastUserMessage = () => {
    const last = lastExchange(messages);
    if (!last || !canStartSend({ busy: isChatBusy(chatRun), previewOpen: Boolean(outboundPreview) })) return;
    setMessages(messages.slice(0, last.userIndex));
    setDraft(last.user.content);
    setAttachedImage(last.user.attachment?.file ?? null);
  };

  const regenerateLastReply = () => {
    const last = lastExchange(messages);
    if (!last || !selectedModel || !canStartSend({ busy: isChatBusy(chatRun), previewOpen: Boolean(outboundPreview) }))
      return;
    const history = messages
      .slice(0, last.userIndex)
      .filter((message) => message.role === "user" || message.status === "complete")
      .map(({ role, content }) => ({ role, content }) as StudioChatHistoryMessage);
    setOutboundPreview({
      model: selectedModel,
      mode: effectiveComposerMode(composerMode, selectedModel.supportedParameters.includes("tools")).mode,
      history: boundOutboundHistory(history, selectedModel.contextLength).history,
      message: last.user.content,
      omittedMessages: 0,
      ...(last.user.attachment ? { attachment: last.user.attachment } : {})
    });
  };

  const copyLastReply = () => {
    const reply = [...messages].reverse().find((message) => message.role === "assistant" && message.content.trim());
    if (!reply) return;
    void navigator.clipboard.writeText(reply.content);
  };

  return (
    <aside
      className={className}
      id="studio-agent-conversation"
      aria-label="Agent conversation"
      style={
        {
          "--studio-panel-width": `${panelWidth}px`,
          "--studio-mobile-panel-size": `${panelHeight}px`
        } as React.CSSProperties
      }
    >
      <header className="studio-agent__header">
        <div className="studio-agent__conversation-picker">
          <button
            className="studio-agent__button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={conversationMenuOpen}
            aria-controls="studio-agent-conversations"
            onClick={() => setConversationMenuOpen((open) => !open)}
          >
            {conversationList.find((item) => item.id === activeConversationId)?.title ?? "New agent"} ▾
          </button>
          {conversationMenuOpen && (
            <div id="studio-agent-conversations" className="studio-agent__conversations" role="menu">
              {conversationList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  aria-current={item.id === activeConversationId ? "true" : undefined}
                  onClick={() => openConversation(item.id)}
                >
                  <span>{item.title}</span>
                  <span>
                    {item.modelId || "No model"} · {formatConversationStamp(item.updatedAt)}
                  </span>
                </button>
              ))}
              <label>
                Rename
                <input
                  aria-label="Conversation title"
                  value={renameTitle}
                  onChange={(event) => setRenameTitle(event.target.value.slice(0, 120))}
                />
              </label>
              <button type="button" role="menuitem" disabled={!renameTitle.trim()} onClick={renameActiveConversation}>
                Save title
              </button>
              <button type="button" role="menuitem" onClick={exportActiveConversation}>
                Export conversation
              </button>
              <button type="button" role="menuitem" onClick={deleteActiveConversation}>
                {confirmDelete ? "Delete this conversation" : "Delete…"}
              </button>
            </div>
          )}
          <div className="studio-agent__subtitle">
            OpenRouter · {connectionLabel} · <span aria-label="Tool execution off">Tools off</span>
          </div>
        </div>
        <div className="studio-agent__header-actions">
          <button className="studio-agent__button" type="button" onClick={startNewConversation}>
            + New
          </button>
          <button
            className="studio-agent__button studio-agent__button--icon studio-panel-close"
            type="button"
            aria-label="Close conversation"
            onClick={onClose}
          >
            <X size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="studio-agent__scroll">
        <section className="studio-agent__section" aria-label="OpenRouter connection">
          <div className="studio-agent__section-heading">
            <span className="studio-agent__provider-name">OpenRouter</span>
            <span
              role="status"
              className={`studio-agent__connection-status${connected ? " studio-agent__connection-status--connected" : ""}`}
            >
              {connectionLabel}
            </span>
          </div>
          <p className="studio-agent__connection-message">{connectionMessage}</p>
          <p className="studio-agent__connection-message">Connect, test, replace, and disconnect are in Settings.</p>
        </section>
        <section className="studio-agent__section studio-agent-sidebar__privacy" aria-label="Privacy and context">
          <div className="studio-agent__privacy-title">Review before sending</div>
          <p className="studio-agent__privacy-copy">
            Studio sends the conversation only after review. A screenshot is included only when you attach it; the
            review shows the image before sending. Other canvas content, SVG, Blender scenes, and local paths stay
            local. Attach the screenshot again if a later message needs it.
          </p>
        </section>
        <div
          className="studio-agent__messages"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 ? (
            <div className="studio-agent__empty">
              <h2 className="studio-agent__empty-title">{AGENT_EMPTY_HEADLINE}</h2>
              <div className="studio-agent__suggestions">
                {AGENT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="studio-agent__chip"
                    onClick={() => setDraft(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <ul className="studio-agent__tips">
                {AGENT_EMPTY_TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`studio-agent__message${message.role === "user" ? " studio-agent__message--user" : ""}`}
                key={message.id}
                aria-label={`${message.role === "user" ? "You" : "Assistant"}${message.status === "streaming" ? ", generating" : ""}`}
              >
                <div className="studio-agent__message-heading">
                  <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                  {message.status === "streaming" ? <span role="status">Generating…</span> : null}
                </div>
                {message.role === "assistant" ? (
                  <ChatMessageBody
                    content={message.content}
                    streaming={message.status === "streaming"}
                    {...(message.reasoning ? { reasoning: message.reasoning } : {})}
                  />
                ) : (
                  <div className="studio-agent__message-content">{message.content}</div>
                )}
                {message.status === "error" && (
                  <div className="studio-agent__error-card" role="alert">
                    <p>{message.errorMessage || "The reply failed."}</p>
                    <button type="button" onClick={retryLastUserMessage}>
                      Retry
                    </button>
                    <button type="button" onClick={openModelPicker}>
                      Switch model
                    </button>
                    <button
                      type="button"
                      onClick={() => document.querySelector<HTMLElement>('[aria-label="Settings"]')?.click()}
                    >
                      Open settings
                    </button>
                    {message.errorMessage?.toLowerCase().includes("credit") && (
                      <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">
                        Add credits
                      </a>
                    )}
                  </div>
                )}
                {message.attachment && (
                  <img
                    className="studio-agent__message-image"
                    src={message.attachment.dataUrl}
                    alt="Screenshot sent with this message"
                  />
                )}
                {message.errorMessage && (
                  <p role="alert" className="studio-agent__message-error">
                    {message.errorMessage}
                  </p>
                )}
              </article>
            ))
          )}
          {chatRunStatusLabel(chatRun?.status) && (
            <p className="studio-agent__usage" role="status">
              {chatRunStatusLabel(chatRun?.status)}
              {chatRun?.status === "error" && chatRun.message ? ` ${chatRun.message}` : ""}
            </p>
          )}
          {chatRun?.status === "complete" && chatRun.usage && (
            <div className="studio-agent__usage" role="status">
              Usage returned by OpenRouter: {chatRun.usage.promptTokens ?? "—"} input ·{" "}
              {chatRun.usage.completionTokens ?? "—"} output tokens
              {typeof chatRun.usage.cost === "number"
                ? ` · $${chatRun.usage.cost.toFixed(6)}`
                : " · cost was not returned"}
              .
            </div>
          )}
        </div>
        {toolCalls.map((call) => (
          <ToolCallCard
            key={call.id}
            call={call}
            modelName={selectedModel?.name}
            onApprove={onApproveToolCall}
            onReject={onRejectToolCall}
          />
        ))}
      </div>

      <footer className="studio-agent-composer">
        <div className="studio-agent__context" aria-label="Context">
          <span>Context</span>
          <ul>
            {sendContextLines({
              modelName: selectedModel?.name ?? null,
              draftCharacters: draft.trim().length,
              historyCount: messages.filter((message) => message.status === "complete").length,
              attachmentName: attachedImage?.name ?? null
            }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {selectedModel ? (
            <p>
              {paidModelCue(
                readCatalogPrice(selectedModel.promptPrice),
                readCatalogPrice(selectedModel.completionPrice)
              )}
            </p>
          ) : null}
          <label>
            <input
              type="checkbox"
              checked={alwaysPreview}
              onChange={(event) => {
                setAlwaysPreview(event.target.checked);
                try {
                  window.localStorage.setItem("studio-always-preview", event.target.checked ? "yes" : "no");
                } catch {
                  // The choice still applies for this page when storage is unavailable.
                }
              }}
            />
            Always show the full request preview
          </label>
        </div>
        <label className="studio-agent__composer-label" htmlFor="studio-chat-composer">
          Message
        </label>
        <textarea
          id="studio-chat-composer"
          ref={composerRef}
          className="studio-agent__field studio-agent-composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 12_000))}
          onKeyDown={(event) => {
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              setComposerMode((mode) => nextComposerMode(mode));
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              requestPreview();
            }
          }}
          disabled={
            !canChat || modelCatalog.status !== "ready" || !selectedModel?.textChatEligible || isChatBusy(chatRun)
          }
          placeholder={getComposerPlaceholder(connectionHost, canChat, modelCatalog, selectedModel)}
          rows={1}
        />
        <div className="studio-agent__composer-tools">
          <button
            className="studio-agent__button studio-agent__button--icon"
            type="button"
            aria-label="Add to the message"
            aria-expanded={plusOpen}
            aria-controls="studio-composer-plus"
            onClick={() => setPlusOpen((open) => !open)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          {plusOpen && (
            <div id="studio-composer-plus" className="studio-agent__plus" role="menu">
              {plusItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={!item.enabled}
                  title={item.reason ?? ""}
                  onClick={() => void runPlus(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            aria-label="Add an image"
            onChange={(event) => {
              addFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            className="studio-agent__chip"
            type="button"
            title={modeDescription(composerMode)}
            onClick={() => setComposerMode((mode) => nextComposerMode(mode))}
          >
            {composerMode}
          </button>
          {effectiveComposerMode(composerMode, selectedModel?.supportedParameters.includes("tools") ?? false).reason ? (
            <p role="status">
              {
                effectiveComposerMode(composerMode, selectedModel?.supportedParameters.includes("tools") ?? false)
                  .reason
              }
            </p>
          ) : null}
          <button
            className="studio-agent__chip"
            type="button"
            title="Choose 1 to 4 frames. A variant run has not started."
            onClick={() => setVariantScale((count) => (count >= 4 ? 1 : count + 1))}
          >
            {variantScale}×
          </button>
          <div
            className="studio-model-picker-anchor"
            ref={modelPickerAnchorRef}
            style={
              {
                "--studio-model-picker-width": `${Math.max(280, Math.min(380, panelWidth - 24))}px`
              } as React.CSSProperties
            }
          >
            <button
              ref={modelPickerTriggerRef}
              className="studio-agent__chip studio-agent__model-trigger"
              type="button"
              title={selectedModel ? `${selectedModel.name} · change model` : "Choose an OpenRouter model"}
              aria-haspopup="dialog"
              aria-expanded={modelPickerOpen}
              aria-controls="studio-model-picker-popover"
              onClick={() => setModelPickerOpen((open) => !open)}
            >
              <span>{selectedModel?.name ?? "Choose model"}</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {modelPickerOpen && (
              <section
                id="studio-model-picker-popover"
                className="studio-model-picker-popover"
                role="dialog"
                aria-label="Choose an OpenRouter model"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeModelPicker(true);
                  }
                }}
              >
                <header className="studio-model-picker-popover__header">
                  <div>
                    <strong>Choose a model</strong>
                    <span>{modelCatalog.models.length.toLocaleString()} available in this catalog</span>
                  </div>
                  <button
                    className="studio-model-picker-popover__icon-button"
                    type="button"
                    aria-label="Close model picker"
                    onClick={() => closeModelPicker(true)}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </header>

                <label className="studio-model-picker-popover__search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={modelPickerSearchRef}
                    type="search"
                    value={modelQuery}
                    onChange={(event) => setModelQuery(event.target.value)}
                    placeholder="Search models or publishers"
                    aria-label="Search models"
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        modelPickerListRef.current
                          ?.querySelector<HTMLButtonElement>('button[role="option"]:not(:disabled)')
                          ?.focus();
                      }
                    }}
                  />
                </label>

                <fieldset className="studio-model-picker-popover__quick-filters">
                  <legend className="sr-only">Quick filters</legend>
                  {(
                    [
                      ["free", "Free"],
                      ["vision", "Vision"],
                      ["tools", "Tools"],
                      ["reasoning", "Reasoning"]
                    ] as const
                  ).map(([filter, label]) => {
                    const active = quickModelFilters.includes(filter);
                    return (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={active}
                        className={active ? "is-active" : ""}
                        onClick={() =>
                          setQuickModelFilters((current) =>
                            current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={minimumContext === "128000"}
                    className={minimumContext === "128000" ? "is-active" : ""}
                    onClick={() => setMinimumContext((current) => (current === "128000" ? "all" : "128000"))}
                  >
                    128K+
                  </button>
                </fieldset>

                <details className="studio-model-picker-popover__filters">
                  <summary>More filters</summary>
                  <div className="studio-agent__filter-grid">
                    <label className="studio-agent__filter-label">
                      Publisher
                      <select
                        aria-label="Filter by publisher"
                        value={authorFilter}
                        onChange={(event) => setAuthorFilter(event.target.value)}
                        className="studio-agent__field"
                      >
                        <option value="all">All publishers</option>
                        {authors.map((author) => (
                          <option key={author} value={author}>
                            {author}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="studio-agent__filter-label">
                      Price
                      <select
                        aria-label="Filter by price"
                        value={priceFilter}
                        onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}
                        className="studio-agent__field"
                      >
                        <option value="all">Any price</option>
                        <option value="free">Listed as free</option>
                        <option value="paid">Paid</option>
                        <option value="unknown">Price unavailable</option>
                      </select>
                    </label>
                    <label className="studio-agent__filter-label">
                      Capability
                      <select
                        aria-label="Filter by capability"
                        value={modalityFilter}
                        onChange={(event) => setModalityFilter(event.target.value as ModalityFilter)}
                        className="studio-agent__field"
                      >
                        <option value="all">All capabilities</option>
                        <option value="text">Text chat</option>
                        <option value="vision">Text + image input</option>
                        <option value="image-output">Image output</option>
                      </select>
                    </label>
                    <label className="studio-agent__filter-label">
                      Minimum context
                      <select
                        aria-label="Filter by minimum context"
                        value={minimumContext}
                        onChange={(event) => setMinimumContext(event.target.value)}
                        className="studio-agent__field"
                      >
                        <option value="all">Any context</option>
                        <option value="32000">32K or more</option>
                        <option value="128000">128K or more</option>
                        <option value="256000">256K or more</option>
                      </select>
                    </label>
                    <label className="studio-agent__filter-label">
                      Max input · $/1M tokens
                      <input
                        aria-label="Maximum input price per million tokens"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        value={maximumInputPrice}
                        onChange={(event) => setMaximumInputPrice(event.target.value)}
                        placeholder="Any"
                        className="studio-agent__field"
                      />
                    </label>
                    <label className="studio-agent__filter-label">
                      Max output · $/1M tokens
                      <input
                        aria-label="Maximum output price per million tokens"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        value={maximumOutputPrice}
                        onChange={(event) => setMaximumOutputPrice(event.target.value)}
                        placeholder="Any"
                        className="studio-agent__field"
                      />
                    </label>
                  </div>
                </details>

                {modelCatalog.status === "loading" && (
                  <p className="studio-model-picker-popover__catalog-note" role="status">
                    Refreshing the OpenRouter catalog…
                  </p>
                )}
                {modelCatalog.status === "error" && (
                  <p
                    className="studio-model-picker-popover__catalog-note studio-model-picker-popover__catalog-note--error"
                    role="status"
                  >
                    {modelCatalog.message || "The OpenRouter catalog could not be loaded. Try refreshing."}
                  </p>
                )}

                {selectedModelId && !selectedModel && modelCatalog.status === "ready" && (
                  <div role="status" className="studio-agent__notice">
                    Saved model “{selectedModelId}” is no longer listed. Studio has not switched it automatically.
                  </div>
                )}
                {selectedModel && !selectedModel.textChatEligible && (
                  <div role="status" className="studio-agent__notice">
                    This model does not advertise both text input and text output, so chat is disabled.
                  </div>
                )}

                <div
                  id="studio-model-select"
                  ref={modelPickerListRef}
                  className="studio-model-picker-popover__list"
                  role="listbox"
                  aria-label="Available models"
                  onKeyDown={(event) => {
                    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                    const options = [
                      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)')
                    ];
                    if (options.length === 0) return;
                    event.preventDefault();
                    const current = options.indexOf(document.activeElement as HTMLButtonElement);
                    const nextIndex =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? options.length - 1
                          : Math.max(
                              0,
                              Math.min(
                                options.length - 1,
                                (current < 0 ? 0 : current) + (event.key === "ArrowDown" ? 1 : -1)
                              )
                            );
                    options[nextIndex]?.focus();
                  }}
                >
                  {groupCatalogModels(
                    quickMatchingModels,
                    readStoredIds(FAVORITE_MODELS_KEY),
                    readStoredIds(RECENT_MODELS_KEY)
                  ).map((group) => (
                    <div
                      key={`${group.id}:${favoriteTick}`}
                      className="studio-model-picker-popover__group"
                      role="group"
                      aria-label={group.label}
                    >
                      <h3>{group.label}</h3>
                      {group.models.map((model) => {
                        const favorite = readStoredIds(FAVORITE_MODELS_KEY).includes(model.id);
                        return (
                          <div
                            key={`${group.id}:${model.id}`}
                            className="studio-model-picker-popover__row"
                            role="presentation"
                          >
                            <button
                              id={`studio-model-option-${safeDomId(model.id)}`}
                              type="button"
                              role="option"
                              data-model-id={model.id}
                              aria-selected={model.id === selectedModelId}
                              disabled={!model.textChatEligible}
                              title={
                                !model.textChatEligible
                                  ? "This model does not advertise text input and text output."
                                  : `Select ${model.name}`
                              }
                              onClick={() => chooseModel(model.id)}
                            >
                              <span className="studio-model-picker-popover__model-copy">
                                <span className="studio-model-picker-popover__model-name">{model.name}</span>
                                <span className="studio-model-picker-popover__model-meta">
                                  <span>
                                    {model.author || "Other"} · {formatContextLength(model.contextLength)}
                                  </span>
                                  {modelBadges(model)
                                    .filter((badge) => badge !== "Free")
                                    .map((badge) => (
                                      <span className="studio-model-picker-popover__badge" key={badge}>
                                        {badge}
                                      </span>
                                    ))}
                                  {!model.textChatEligible && (
                                    <span className="studio-model-picker-popover__badge">No text chat</span>
                                  )}
                                </span>
                              </span>
                              <span className="studio-model-picker-popover__price">
                                {formatShortCatalogPrice(model)}
                              </span>
                              {model.id === selectedModelId && (
                                <Check className="studio-model-picker-popover__selected" size={15} aria-hidden="true" />
                              )}
                            </button>
                            <button
                              className={`studio-model-picker-popover__favorite${favorite ? " is-active" : ""}`}
                              type="button"
                              aria-label={`${favorite ? "Remove" : "Add"} ${model.name} ${favorite ? "from" : "to"} favorites`}
                              aria-pressed={favorite}
                              onClick={() => {
                                const current = readStoredIds(FAVORITE_MODELS_KEY);
                                writeStoredIds(
                                  FAVORITE_MODELS_KEY,
                                  favorite ? current.filter((id) => id !== model.id) : [...current, model.id]
                                );
                                setFavoriteTick((tick) => tick + 1);
                              }}
                            >
                              <Star size={14} aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {quickMatchingModels.length === 0 && (
                    <p className="studio-model-picker-popover__empty">
                      {modelCatalog.status === "loading" ? "Loading models…" : "No models match these filters."}
                    </p>
                  )}
                </div>

                <footer className="studio-model-picker-popover__footer">
                  <span aria-live="polite">
                    {quickMatchingModels.length.toLocaleString()} of {modelCatalog.models.length.toLocaleString()}{" "}
                    models · $/1M input / output
                    {modelCatalog.refreshedAt
                      ? ` · refreshed ${formatCatalogRefresh(modelCatalog.refreshedAt)}`
                      : ` · ${modelCatalog.message}`}
                  </span>
                  <button
                    type="button"
                    disabled={!canChat || modelCatalog.status === "loading"}
                    onClick={onRefreshModels}
                  >
                    <RefreshCw size={13} aria-hidden="true" /> Refresh
                  </button>
                </footer>
              </section>
            )}
          </div>
        </div>
        {attachedImage && (
          <div className="studio-agent__attachment" aria-label="Local screenshot attachment">
            {attachmentUrl && <img src={attachmentUrl} alt="Screenshot attached for review" />}
            <span title={attachedImage.name}>{attachedImage.name}</span>
            <button type="button" aria-label="Remove screenshot attachment" onClick={() => setAttachedImage(null)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        {attachedImage && connectionHost === "browser" && (
          <p className="studio-agent__attachment-notice" role="status">
            This image is still local. Open Studio in VS Code to connect a vision model.
          </p>
        )}
        {attachedImage && connectionHost === "vscode" && !selectedModel?.inputModalities.includes("image") && (
          <p className="studio-agent__attachment-notice" role="status">
            Choose a model with image input before reviewing this request.
          </p>
        )}
        {attachmentError && (
          <p className="studio-agent__attachment-notice" role="alert">
            {attachmentError}
          </p>
        )}
        <div className="studio-agent__composer-actions">
          <button
            className="studio-agent__button"
            type="button"
            disabled={!lastExchange(messages) || isChatBusy(chatRun)}
            title={
              lastExchange(messages) ? "Put the last message back in the composer" : "Send a message before editing it."
            }
            onClick={retryLastUserMessage}
          >
            Edit last message
          </button>
          <button
            className="studio-agent__button"
            type="button"
            disabled={!lastExchange(messages) || !selectedModel || isChatBusy(chatRun) || Boolean(outboundPreview)}
            title="Review the last message again before sending another reply."
            onClick={regenerateLastReply}
          >
            Regenerate
          </button>
          <button
            className="studio-agent__button"
            type="button"
            disabled={!messages.some((message) => message.role === "assistant" && message.content.trim())}
            title="Copy the latest assistant reply."
            onClick={copyLastReply}
          >
            Copy reply
          </button>
          <span className="studio-agent__composer-count">
            {draft.length.toLocaleString()} / 12,000 · Enter to review
          </span>
          {isChatBusy(chatRun) && chatRun ? (
            <button
              className="studio-agent__button studio-agent__button--danger"
              type="button"
              onClick={stopGeneration}
            >
              Stop
            </button>
          ) : chatRun?.status === "error" ? (
            <button className="studio-agent__button" type="button" onClick={retryLastUserMessage}>
              Retry
            </button>
          ) : (
            <button
              className="studio-agent__button studio-agent__button--primary studio-agent__button--icon"
              type="button"
              aria-label="Review & send"
              disabled={!canSend}
              onClick={() => void requestPreview()}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {!canChat && (
          <div className="studio-agent__composer-help">
            {connectionHost === "browser"
              ? "Use the VS Code editor tab to connect and chat."
              : !workspaceTrusted
                ? "Workspace trust is required for OpenRouter requests."
                : "Connect OpenRouter to enable chat."}
          </div>
        )}
      </footer>

      {consentOpen && (
        <div className="studio-outbound-overlay">
          <section
            className="studio-outbound-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-consent-title"
          >
            <h2 id="studio-consent-title">Send this request to OpenRouter?</h2>
            <p>
              This sends your draft, earlier messages in this chat, and an image only if one is attached. Plan mode can
              offer read-only canvas details. Build asks before each proposed canvas change. Auto applies canvas-only
              changes as one Undo step; read actions still ask before local canvas data is sent. Approved results,
              including a frame screenshot when requested, return to the selected model. The OpenRouter key stays on the
              host.
            </p>
            <button
              type="button"
              onClick={() => {
                setConsented(true);
                setConsentOpen(false);
                try {
                  window.sessionStorage.setItem(consentKey, "yes");
                } catch {
                  // Consent still applies until this page reloads.
                }
                void requestPreview(true);
              }}
            >
              Continue to review
            </button>
            <button type="button" onClick={() => setConsentOpen(false)}>
              Cancel
            </button>
          </section>
        </div>
      )}
      {outboundPreview && (
        <OutboundRequestDialog
          preview={outboundPreview}
          showFull={alwaysPreview}
          sendRef={previewSendRef}
          onCancel={() => setOutboundPreview(null)}
          onSend={sendAfterPreview}
        />
      )}
    </aside>
  );
}

function OutboundRequestDialog({
  preview,
  showFull,
  sendRef,
  onCancel,
  onSend
}: {
  preview: OutboundPreview;
  showFull: boolean;
  sendRef: React.RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onSend: () => void;
}) {
  const outboundMessages: StudioChatHistoryMessage[] = [
    { role: "assistant", content: STUDIO_CHAT_SYSTEM_PROMPT },
    ...preview.history,
    { role: "user", content: preview.message }
  ];

  return (
    <div
      className="studio-outbound-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="studio-outbound-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-outbound-title"
      >
        <header className="studio-outbound-dialog__header">
          <h2 id="studio-outbound-title">Review what leaves Studio</h2>
          <p className="studio-outbound-dialog__description">
            {preview.attachment
              ? `This request sends the exact messages below and the attached screenshot to OpenRouter for ${preview.model.name}. ${toolDisclosure(preview.mode)} Other canvas files, SVG, Blender scenes, and local paths are not attached.`
              : `This request sends the exact messages below to OpenRouter for ${preview.model.name}. ${toolDisclosure(preview.mode)} Canvas data leaves Studio only after you approve a tool call.`}
          </p>
          {preview.omittedMessages > 0 && (
            <p className="studio-outbound-dialog__warning" role="status">
              {preview.omittedMessages} earlier conversation message{preview.omittedMessages === 1 ? " was" : "s were"}{" "}
              omitted to keep this request within the context limit.
            </p>
          )}
          <div className="studio-outbound-dialog__model">
            {formatCatalogPrice(preview.model)} · {preview.model.contextLength.toLocaleString()} token context ·
            selected model only
          </div>
          <p className="studio-outbound-dialog__tools">
            Mode: {preview.mode}. {toolDisclosure(preview.mode)}
          </p>
          <p>
            {paidModelCue(
              readCatalogPrice(preview.model.promptPrice),
              readCatalogPrice(preview.model.completionPrice)
            ) ?? "This model is listed as free."}
          </p>
        </header>
        {showFull && (
          <div className="studio-outbound-dialog__messages">
            {outboundMessages.map((message, index) => (
              <article className="studio-outbound-dialog__message" key={`${message.role}-${index}`}>
                <strong className="studio-outbound-dialog__message-role">
                  {index === 0
                    ? "Studio instructions"
                    : message.role === "user"
                      ? "User message"
                      : "Conversation history · assistant"}
                </strong>
                <pre className="studio-outbound-dialog__message-content">{message.content}</pre>
              </article>
            ))}
            {preview.attachment && (
              <figure className="studio-outbound-dialog__attachment">
                <figcaption>Screenshot included in this request</figcaption>
                <img src={preview.attachment.dataUrl} alt="Screenshot that will be sent to OpenRouter" />
              </figure>
            )}
          </div>
        )}
        <footer className="studio-outbound-dialog__footer">
          <button className="studio-agent__button" type="button" onClick={onCancel}>
            Back to chat
          </button>
          <button
            className="studio-agent__button studio-agent__button--primary"
            ref={sendRef}
            type="button"
            onClick={onSend}
          >
            Send to OpenRouter
          </button>
        </footer>
      </section>
    </div>
  );
}

function toolDisclosure(mode: OutboundPreview["mode"]): string {
  if (mode === "ask") return "No canvas tools are enabled for this request.";
  if (mode === "plan")
    return "Read-only canvas tools may be proposed; each needs approval before its bounded result is sent to the model.";
  if (mode === "auto")
    return "Canvas changes apply automatically as one Undo step; every read still needs approval before its bounded result or screenshot is sent to the model.";
  return "Canvas edit tools may be proposed; each needs approval before any local change, and the bounded result is then sent to the model.";
}

function isChatBusy(run: StudioChatRun | null): boolean {
  return run?.status === "streaming" || run?.status === "stopping";
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        if (typeof reader.result === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(reader.result)) {
          resolve(reader.result);
        } else reject(new Error("Unsupported image."));
      },
      { once: true }
    );
    reader.addEventListener("error", () => reject(new Error("Image read failed.")), { once: true });
    reader.readAsDataURL(file);
  });
}

function boundOutboundHistory(
  messages: StudioChatHistoryMessage[],
  contextLength: number
): {
  history: StudioChatHistoryMessage[];
  omittedMessages: number;
} {
  const perMessageLimit = 12_000;
  const bounded = messages.map((message) => {
    if (message.content.length <= perMessageLimit) return message;
    const marker = "[Earlier content omitted from this long reply]\n";
    return { ...message, content: marker + message.content.slice(-(perMessageLimit - marker.length)) };
  });
  return compactHistory(bounded.slice(-40), contextLength);
}

function getComposerPlaceholder(
  host: "vscode" | "browser",
  canChat: boolean,
  catalog: StudioModelCatalog,
  model?: StudioModel
): string {
  if (host === "browser") return "Open the VS Code editor tab to chat";
  if (!canChat) return "Connect OpenRouter to begin";
  if (catalog.status !== "ready") return "Loading available models…";
  if (!model) return "Choose a text-chat model";
  return "Design anything…";
}

function formatCatalogPrice(model: StudioModel): string {
  const input = readCatalogPrice(model.promptPrice);
  const output = readCatalogPrice(model.completionPrice);
  if (input === null || output === null) return "Catalog price unavailable";
  if (input === 0 && output === 0) return "Listed as free";
  const format = (value: number) => {
    const perMillion = value * 1_000_000;
    return perMillion < 0.01
      ? perMillion.toPrecision(2)
      : perMillion.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  return `Catalog rate $${format(input)} input / $${format(output)} output per 1M tokens`;
}

function formatShortCatalogPrice(model: StudioModel): string {
  const input = readCatalogPrice(model.promptPrice);
  const output = readCatalogPrice(model.completionPrice);
  if (input === null || output === null) return "Price n/a";
  if (input === 0 && output === 0) return "Free";
  const format = (value: number) => (value * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `$${format(input)} / $${format(output)}`;
}

function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000)
    return `${(contextLength / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M context`;
  if (contextLength >= 1_000) return `${Math.round(contextLength / 1_000)}K context`;
  return `${contextLength.toLocaleString()} context`;
}

function formatCatalogRefresh(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function safeDomId(value: string): string {
  return Array.from(value, (character) => character.codePointAt(0)?.toString(16) ?? "0").join("-");
}

function readOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const FAVORITE_MODELS_KEY = "codex-avatar-studio-favorite-models";
const RECENT_MODELS_KEY = "codex-avatar-studio-recent-models";

function readStoredIds(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 20)));
  } catch {
    // The picker still works when this browser refuses local storage.
  }
}

function readSelectedModelId(): string {
  try {
    return window.localStorage.getItem("codex-avatar-studio-selected-model") ?? "";
  } catch {
    return "";
  }
}

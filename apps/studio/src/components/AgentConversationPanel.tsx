import {
  STUDIO_CHAT_SYSTEM_PROMPT,
  type StudioChatHistoryMessage,
  type StudioModel
} from "@codex-avatar-studio/avatar-core";
import { ArrowUp, ArrowUpDown, Check, ChevronDown, Plus, RefreshCw, Search, Star, X } from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "tldraw";
import type { StudioChatRun, StudioImageAttachment, StudioModelCatalog, StudioToolCall } from "../bridge/studioHost.js";
import { assertChatImageAttachment } from "../projects/localAssets.js";
import {
  type AgentConversation,
  conversationTitleFromMessage,
  createAgentConversation,
  formatConversationStamp,
  restoreConversationMessages,
  type StoredAgentConversation
} from "./agentConversations.js";
import { AGENT_EMPTY_HEADLINE, AGENT_EMPTY_TIPS, AGENT_SUGGESTIONS } from "./agentEmptyState.js";
import { sessionPillStatus } from "./agentSessions.js";
import { ChatMessageBody } from "./ChatMessageBody.js";
import { describeSelection } from "./canvasContextMenu.js";
import { canStartSend, lastExchange } from "./chatActions.js";
import { type ComposerMenuAction, composerMenuItems } from "./composerMenu.js";
import { COMPOSER_MODES, type ComposerMode, modeDescription, nextComposerMode } from "./composerModes.js";
import { compactHistory } from "./contextBudget.js";
import { DESIGN_SKILLS } from "./designSkills.js";
import {
  filterStudioModels,
  isDuplicateRoute,
  MODEL_SORT_OPTIONS,
  type ModelSortOrder,
  readCatalogPrice,
  sortStudioModels
} from "./modelFilters.js";
import {
  filterModelsByBadges,
  groupCatalogModels,
  modelBadges,
  quickFilterConflict,
  quickFilterCounts,
  type QuickModelFilter
} from "./modelPicker.js";
import { nextModelOptionIndex } from "./modelPickerNavigation.js";
import { paidModelCue, sendContextLines } from "./privacyContext.js";
import { hasProjectChatConsent, recordProjectChatConsent } from "./projectChatConsent.js";
import { readProjectStyle, STYLE_PRESETS, withProjectStyle } from "./projectStyle.js";
import { chatRunStatusLabel } from "./shellStatus.js";
import { ToolCallCard } from "./ToolCallView.js";
import { effectiveComposerMode } from "./toolModeFallback.js";
import {
  keepVariantFrame,
  placeVariantFrames,
  type VariantFrameEditor,
  type VariantSession,
  variantPrompt
} from "./variantSessions.js";

export type OpenRouterConnectionAction = "connect" | "replace" | "test" | "disconnect";

export interface AgentConversationPanelProps {
  className?: string;
  isOpen: boolean;
  draftPrefill?: { id: string; text: string } | null;
  draftImagePrefill?: { id: string; file: File } | null;
  onClose: () => void;
  connectionHost: "vscode" | "standalone" | "browser" | "web";
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
  onUndoToolCall?: () => void;
  onPersistConversation?: (conversation: {
    id: string;
    title: string;
    modelId: string;
    updatedAt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }) => void | Promise<void>;
  onLoadConversations?: (projectId: string) => Promise<AgentConversation[]>;
  onLoadConversation?: (projectId: string, conversationId: string) => Promise<StoredAgentConversation | null>;
  onRenameConversation?: (id: string, title: string) => void | Promise<void>;
  onDeleteConversation?: (id: string) => void | Promise<void>;
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

const ConversationMessage = memo(
  function ConversationMessage({
    message,
    onRetry,
    onOpenModels
  }: {
    message: ChatMessage;
    onRetry: () => void;
    onOpenModels: () => void;
  }) {
    return (
      <article
        className={`studio-agent__message${message.role === "user" ? " studio-agent__message--user" : ""}`}
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
            <button type="button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" onClick={onOpenModels}>
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
    );
  },
  (previous, next) => previous.message === next.message
);

interface OutboundPreview {
  model: StudioModel;
  mode: "ask" | "plan" | "build" | "auto";
  history: StudioChatHistoryMessage[];
  message: string;
  omittedMessages: number;
  attachment?: { file: File; dataUrl: string };
}

export function AgentConversationPanel({
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
  onRefreshModels,
  onSendChat,
  onCancelChat,
  onClearChatRun,
  onApproveToolCall,
  onRejectToolCall,
  onUndoToolCall,
  onPersistConversation,
  onLoadConversations,
  onLoadConversation,
  onRenameConversation,
  onDeleteConversation,
  projectId = null,
  onSessionsChange,
  onOpenVectorDialog
}: AgentConversationPanelProps) {
  const [selectedModelId, setSelectedModelId] = useState(readSelectedModelId);
  const [modelQuery, setModelQuery] = useState("");
  const [quickModelFilters, setQuickModelFilters] = useState<QuickModelFilter[]>([]);
  const [modelSortOrder, setModelSortOrder] = useState<ModelSortOrder>("most-popular");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [minimumContext, setMinimumContext] = useState("all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;
    const onSeed = (event: Event) => {
      const count = Number((event as CustomEvent<{ count?: number }>).detail?.count ?? 500);
      setMessages(
        Array.from({ length: count }, (_, index) => ({
          id: `perf-${index}`,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `Message ${index} stays on this computer.`,
          status: "complete" as const
        }))
      );
    };
    const onStream = () => {
      const started = performance.now();
      let frames = 0;
      let slowFrames = 0;
      let last = started;
      const step = (now: number) => {
        const gap = now - last;
        if (gap > 32) slowFrames += 1;
        last = now;
        frames += 1;
        setMessages((current) => {
          const next = current.slice();
          const lastMessage = next.at(-1);
          if (!lastMessage) return current;
          next[next.length - 1] = { ...lastMessage, status: "streaming", content: `${lastMessage.content} word` };
          return next;
        });
        if (now - started < 1000) requestAnimationFrame(step);
        else {
          (
            window as Window & { __studioStream?: { frames: number; slowFrames: number; elapsedMs: number } }
          ).__studioStream = { frames, slowFrames, elapsedMs: Math.round(now - started) };
        }
      };
      requestAnimationFrame(step);
    };
    window.addEventListener("kurva-seed-messages", onSeed);
    window.addEventListener("kurva-stream-messages", onStream);
    return () => {
      window.removeEventListener("kurva-seed-messages", onSeed);
      window.removeEventListener("kurva-stream-messages", onStream);
    };
  }, []);
  const [conversationList, setConversationList] = useState<AgentConversation[]>(() => [
    createAgentConversation(readSelectedModelId())
  ]);
  const [activeConversationId, setActiveConversationId] = useState(() => conversationList[0]?.id ?? "");
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationLoadMessage, setConversationLoadMessage] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
  const [variantScale, setVariantScale] = useState(1);
  const [variantSessions, setVariantSessions] = useState<VariantSession[]>([]);
  useEffect(() => {
    const onVariants = (event: Event) => {
      if (!editor) return;
      const count = Number((event as CustomEvent<{ count?: number }>).detail?.count ?? 3);
      setVariantSessions(placeVariantFrames(adaptEditorForVariants(editor), count));
    };
    window.addEventListener("kurva-start-variants", onVariants);
    return () => window.removeEventListener("kurva-start-variants", onVariants);
  }, [editor]);
  const [consented, setConsented] = useState(() => hasProjectChatConsent(projectId, window.sessionStorage));
  const [consentOpen, setConsentOpen] = useState(false);
  useEffect(() => {
    setConsented(hasProjectChatConsent(projectId, window.sessionStorage));
    setConsentOpen(false);
  }, [projectId]);
  const [alwaysPreview, setAlwaysPreview] = useState(() => {
    try {
      return window.localStorage.getItem("studio-always-preview") !== "no";
    } catch {
      return true;
    }
  });
  const [warnPaidModels, setWarnPaidModels] = useState(() => {
    try {
      return window.localStorage.getItem("studio-warn-paid") !== "no";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const syncPreview = () => {
      try {
        setAlwaysPreview(window.localStorage.getItem("studio-always-preview") !== "no");
      } catch {
        setAlwaysPreview(true);
      }
    };
    const syncWarnPaid = () => {
      try {
        setWarnPaidModels(window.localStorage.getItem("studio-warn-paid") !== "no");
      } catch {
        setWarnPaidModels(true);
      }
    };
    window.addEventListener("studio-always-preview", syncPreview);
    window.addEventListener("studio-warn-paid", syncWarnPaid);
    return () => {
      window.removeEventListener("studio-always-preview", syncPreview);
      window.removeEventListener("studio-warn-paid", syncWarnPaid);
    };
  }, []);
  const transcriptsRef = useRef(new Map<string, ChatMessage[]>());
  const persistedTranscriptRef = useRef(new Map<string, string>());
  const conversationLoadGenerationRef = useRef(0);
  const conversationProjectRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [variantMenuOpen, setVariantMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [, setFavoriteTick] = useState(0);
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

  const persistTranscript = useCallback(
    (conversation: AgentConversation, transcript: Array<{ role: "user" | "assistant"; content: string }>) => {
      if (!onPersistConversation) return;
      const signature = JSON.stringify({
        title: conversation.title,
        modelId: conversation.modelId,
        messages: transcript
      });
      if (persistedTranscriptRef.current.get(conversation.id) === signature) return;
      persistedTranscriptRef.current.set(conversation.id, signature);
      setConversationLoadMessage("Saving conversation…");
      void Promise.resolve(onPersistConversation({ ...conversation, messages: transcript }))
        .then(() => setConversationLoadMessage((message) => (message === "Saving conversation…" ? null : message)))
        .catch(() => {
          persistedTranscriptRef.current.delete(conversation.id);
          setConversationLoadMessage("Conversation could not be saved. Try again after making another change.");
        });
    },
    [onPersistConversation]
  );

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
    if (!projectId || !onLoadConversations || !onLoadConversation) return;
    let cancelled = false;
    const generation = ++conversationLoadGenerationRef.current;
    conversationProjectRef.current = null;
    setConversationLoadMessage("Loading saved conversations…");
    const blank = createAgentConversation(readSelectedModelId());
    setConversationList([blank]);
    setActiveConversationId(blank.id);
    setMessages([]);
    transcriptsRef.current.clear();
    persistedTranscriptRef.current.clear();
    void (async () => {
      try {
        const saved = await onLoadConversations(projectId);
        if (cancelled || generation !== conversationLoadGenerationRef.current) return;
        if (saved.length === 0) {
          conversationProjectRef.current = projectId;
          setConversationLoadMessage(null);
          return;
        }
        setConversationList(saved);
        const latest = saved[0];
        if (!latest) return;
        setActiveConversationId(latest.id);
        if (latest.modelId) setSelectedModelId(latest.modelId);
        conversationProjectRef.current = projectId;
        setConversationLoadMessage(null);
        const transcript = await onLoadConversation(projectId, latest.id);
        if (cancelled || generation !== conversationLoadGenerationRef.current) return;
        if (transcript) {
          const restored = restoreConversationMessages(transcript) as ChatMessage[];
          transcriptsRef.current.set(latest.id, restored);
          persistedTranscriptRef.current.set(
            latest.id,
            JSON.stringify({ title: transcript.title, modelId: transcript.modelId, messages: transcript.messages })
          );
          setMessages(restored);
        } else {
          setConversationLoadMessage("This saved conversation could not be opened.");
        }
        conversationProjectRef.current = projectId;
        if (transcript) setConversationLoadMessage(null);
      } catch {
        if (cancelled || generation !== conversationLoadGenerationRef.current) return;
        conversationProjectRef.current = projectId;
        setConversationLoadMessage("Saved conversations could not be loaded. This session can still continue.");
      }
    })();
    return () => {
      cancelled = true;
      conversationLoadGenerationRef.current += 1;
    };
  }, [onLoadConversation, onLoadConversations, projectId]);

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
    connectionHost === "browser" || connectionHost === "web"
      ? connection.message
      : !workspaceTrusted
        ? "Trust this workspace before connecting an OpenRouter account."
        : connection.message || "Connect your own OpenRouter account through the VS Code host.";

  const matchingModels = useMemo(
    () =>
      filterStudioModels(modelCatalog.models, {
        query: modelQuery,
        author: "all",
        price: "all",
        modality: "all",
        minimumContext: minimumContext === "all" ? null : Number(minimumContext),
        maximumInputPricePerMillion: null,
        maximumOutputPricePerMillion: null
      }),
    [minimumContext, modelCatalog.models, modelQuery]
  );
  const quickMatchingModels = useMemo(
    () => filterModelsByBadges(matchingModels, quickModelFilters),
    [matchingModels, quickModelFilters]
  );
  // Per-chip counts make the AND across chips visible: without them a pair that
  // intersects to nothing looks like the picker resetting itself.
  const filterCounts = useMemo(
    () => quickFilterCounts(matchingModels, quickModelFilters),
    [matchingModels, quickModelFilters]
  );
  const filtersConflict = quickFilterConflict(filterCounts, quickModelFilters);
  const sortedModels = useMemo(
    () => sortStudioModels(quickMatchingModels, modelSortOrder),
    [quickMatchingModels, modelSortOrder]
  );
  // `sortedModels` still contains OpenRouter's duplicate routes; the picker only
  // renders the deduped set, so the counts must come from here.
  const visibleModels = useMemo(() => sortedModels.filter((model) => !isDuplicateRoute(model)), [sortedModels]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [sortMenuOpen]);

  const selectedModel = modelCatalog.models.find((model) => model.id === selectedModelId);
  const chooseModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const updatedAt = new Date().toISOString();
    setConversationList((current) =>
      current.map((item) => (item.id === activeConversationId ? { ...item, modelId, updatedAt } : item))
    );
    const recent = [modelId, ...readStoredIds(RECENT_MODELS_KEY).filter((id) => id !== modelId)].slice(0, 5);
    writeStoredIds(RECENT_MODELS_KEY, recent);
    setModelPickerOpen(false);
    window.requestAnimationFrame(() => modelPickerTriggerRef.current?.focus());
  };
  const openModelPicker = () => setModelPickerOpen(true);
  const closeModelPicker = (restoreFocus = false) => {
    setModelPickerOpen(false);
    setSortMenuOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => modelPickerTriggerRef.current?.focus());
  };
  const canChat =
    connected &&
    (connectionHost === "web" ||
      ((connectionHost === "vscode" || connectionHost === "standalone") && workspaceTrusted));
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
      const currentMessage = updated[index];
      if (!currentMessage) return current;
      updated[index] = {
        ...currentMessage,
        content: chatRun.text,
        ...(chatRun.reasoning ? { reasoning: chatRun.reasoning } : {}),
        status: chatRun.status === "complete" ? "complete" : chatRun.status === "error" ? "error" : "streaming",
        ...(chatRun.status === "error" && chatRun.message ? { errorMessage: chatRun.message } : {})
      };
      return updated;
    });
  }, [chatRun]);

  useEffect(() => {
    if (!projectId || !onPersistConversation || conversationProjectRef.current !== projectId) return;
    if (messages.length === 0 || !messages.some((message) => message.role === "user")) return;
    const assistantReply = [...messages].reverse().find((message) => message.role === "assistant");
    if (assistantReply && assistantReply.status === "streaming") return;
    const conversation = conversationList.find((item) => item.id === activeConversationId);
    if (!conversation) return;
    const transcript = messages
      .filter((message) => message.role === "user" || message.status === "complete")
      .map(({ role, content }) => ({ role, content }));
    if (transcript.length === 0) return;
    persistTranscript(conversation, transcript);
  }, [activeConversationId, conversationList, messages, onPersistConversation, persistTranscript, projectId]);

  useEffect(() => {
    if (outboundPreview) previewSendRef.current?.focus();
  }, [outboundPreview]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Measure the ref-backed textarea after each draft render so its scroll height tracks the DOM value.
  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(160, Math.max(44, node.scrollHeight))}px`;
  }, [draft]);

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
      setStyleMenuOpen(true);
      return;
    }
    if (action === "pick-skill") {
      setSkillMenuOpen(true);
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
    const count = Math.min(4, Math.max(1, variantScale));
    if (count > 1 && editor) {
      const sessions = placeVariantFrames(adaptEditorForVariants(editor), count);
      setVariantSessions(sessions);
      sessions.forEach((session, index) => {
        if (index === 0) return;
        onSendChat(
          outboundPreview.model.id,
          outboundPreview.history,
          variantPrompt(outboundPreview.message, session.index, count),
          outboundPreview.attachment ? { dataUrl: outboundPreview.attachment.dataUrl } : undefined,
          outboundPreview.mode
        );
      });
    }
    const requestId = onSendChat(
      outboundPreview.model.id,
      outboundPreview.history,
      count > 1 ? variantPrompt(outboundPreview.message, 0, count) : outboundPreview.message,
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
    persistTranscript(
      {
        id: activeConversationId,
        title,
        modelId: outboundPreview.model.id,
        updatedAt
      },
      [
        ...messages
          .filter((message) => message.status === "complete")
          .map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: outboundPreview.message }
      ]
    );
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
    setConversationLoadMessage(null);
    const transcript = transcriptsRef.current.get(id);
    setMessages(transcript ?? []);
    if (!transcript && projectId && onLoadConversation) {
      const generation = ++conversationLoadGenerationRef.current;
      setConversationLoadMessage("Loading conversation…");
      void onLoadConversation(projectId, id)
        .then((stored) => {
          if (generation !== conversationLoadGenerationRef.current) return;
          if (!stored) {
            setConversationLoadMessage("This saved conversation could not be found.");
            return;
          }
          const restored = restoreConversationMessages(stored) as ChatMessage[];
          transcriptsRef.current.set(id, restored);
          persistedTranscriptRef.current.set(
            id,
            JSON.stringify({ title: stored.title, modelId: stored.modelId, messages: stored.messages })
          );
          setMessages(restored);
          setConversationLoadMessage(null);
        })
        .catch(() => {
          if (generation === conversationLoadGenerationRef.current) {
            setConversationLoadMessage("This saved conversation could not be opened.");
          }
        });
    }
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

  const renameActiveConversation = async () => {
    const title = renameTitle.trim();
    if (!title || !activeConversationId) return;
    const current = conversationList.find((item) => item.id === activeConversationId);
    if (!current) return;
    setConversationLoadMessage("Saving title…");
    try {
      if (persistedTranscriptRef.current.has(activeConversationId)) {
        await onRenameConversation?.(activeConversationId, title);
      }
    } catch {
      setConversationLoadMessage("The conversation title could not be saved.");
      return;
    }
    setConversationList((current) =>
      current.map((item) => (item.id === activeConversationId ? { ...item, title } : item))
    );
    const transcript = transcriptsRef.current.get(activeConversationId) ?? messages;
    if (transcript.length > 0 && current)
      persistTranscript(
        { ...current, title },
        transcript
          .filter((message) => message.role === "user" || message.status === "complete")
          .map(({ role, content }) => ({ role, content }))
      );
    setRenameTitle("");
    setConversationLoadMessage(null);
    setConversationMenuOpen(false);
  };

  const deleteActiveConversation = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = activeConversationId;
    setConversationLoadMessage("Deleting conversation…");
    try {
      if (persistedTranscriptRef.current.has(id)) await onDeleteConversation?.(id);
    } catch {
      setConversationLoadMessage("The conversation could not be deleted.");
      return;
    }
    persistedTranscriptRef.current.delete(id);
    transcriptsRef.current.delete(id);
    setConversationList((current) => {
      const remaining = current.filter((item) => item.id !== id);
      const next = remaining[0] ?? createAgentConversation(selectedModelId || readSelectedModelId());
      if (remaining.length === 0) remaining.push(next);
      setActiveConversationId(next.id);
      setMessages(transcriptsRef.current.get(next.id) ?? []);
      return remaining;
    });
    setConfirmDelete(false);
    setConversationLoadMessage(null);
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
              {conversationLoadMessage && (
                <p className="studio-agent__conversation-status" role="status">
                  {conversationLoadMessage}
                </p>
              )}
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
            OpenRouter · {connectionLabel} · <span>Tools off</span>
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
        <div
          className="studio-agent__messages"
          role="log"
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
              <div className="studio-agent__tips">
                {AGENT_EMPTY_TIPS.map((tip) => (
                  <div key={tip.title} className="studio-agent__tip">
                    <span className="studio-agent__tip-title">{tip.title}</span>
                    <span className="studio-agent__tip-copy">{tip.body}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ConversationMessage
                key={message.id}
                message={message}
                onRetry={retryLastUserMessage}
                onOpenModels={openModelPicker}
              />
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
        <details className="studio-agent__more">
          <summary>Connection and privacy</summary>
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
        </details>
        {toolCalls.map((call) => (
          <ToolCallCard
            key={call.id}
            call={call}
            modelName={selectedModel?.name}
            onApprove={onApproveToolCall}
            onReject={onRejectToolCall}
            {...(onUndoToolCall ? { onUndo: () => onUndoToolCall() } : {})}
          />
        ))}
        <details className="studio-agent__context" role="group" aria-label="Context">
          <summary>Context</summary>
          <ul>
            {sendContextLines({
              modelName: selectedModel?.name ?? null,
              draftCharacters: draft.trim().length,
              historyCount: messages.filter((message) => message.status === "complete").length,
              attachmentName: attachedImage?.name ?? null,
              direct: connectionHost === "web"
            }).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {selectedModel && warnPaidModels ? (
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
        </details>
      </div>

      <footer
        className="studio-agent-composer"
        onKeyDown={(event) => {
          if (event.key === "Tab" && event.shiftKey) {
            event.preventDefault();
            setComposerMode((mode) => nextComposerMode(mode));
          }
        }}
      >
        <label
          className="studio-agent__composer-label studio-agent__composer-label--mobile-sr-only"
          htmlFor="studio-chat-composer"
        >
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
            <div id="studio-composer-plus" className="studio-agent__plus" role="menu" aria-label="Add to context">
              <p className="studio-agent__plus-label">Add to context</p>
              {plusItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={!item.enabled}
                  title={item.reason ?? ""}
                  onClick={() => void runPlus(item.id)}
                >
                  <span>{item.label}</span>
                  {item.id === "choose-style" || item.id === "pick-skill" ? (
                    <span className="studio-agent__plus-chevron" aria-hidden="true">
                      ›
                    </span>
                  ) : item.id === "add-canvas" && !item.enabled ? (
                    <span className="studio-agent__plus-hint">Selection</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
          {skillMenuOpen && (
            <div id="studio-composer-skills" className="studio-agent__plus" role="menu" aria-label="Design skills">
              {DESIGN_SKILLS.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    appendDraft(skill.prompt);
                    setSkillMenuOpen(false);
                  }}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          )}
          {styleMenuOpen && editor && (
            <div id="studio-composer-styles" className="studio-agent__plus" role="menu" aria-label="Project styles">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.name}
                  type="button"
                  role="menuitemradio"
                  aria-checked={readProjectStyle(editor.getDocumentSettings()?.meta).name === style.name}
                  onClick={() => {
                    const current = editor.getDocumentSettings();
                    const meta = withProjectStyle(current?.meta ?? {}, style);
                    if (meta) editor.updateDocumentSettings({ meta: meta as NonNullable<typeof current>["meta"] });
                    appendDraft(`Use the ${style.name} style.`);
                    setStyleMenuOpen(false);
                  }}
                >
                  {style.name}
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
          <div className="studio-agent__mode">
            <button
              className="studio-agent__chip"
              type="button"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-controls="studio-composer-mode"
              title={modeDescription(composerMode)}
              onClick={() => setModeMenuOpen((open) => !open)}
            >
              {composerMode}
            </button>
            {modeMenuOpen && (
              <div id="studio-composer-mode" className="studio-agent__plus studio-agent__mode-menu" role="menu">
                {COMPOSER_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="menuitemradio"
                    aria-checked={mode === composerMode}
                    onClick={() => {
                      setComposerMode(mode);
                      setModeMenuOpen(false);
                    }}
                  >
                    <span>{mode}</span>
                    <span>{modeDescription(mode)}</span>
                  </button>
                ))}
                <p className="studio-agent__menu-note">
                  Cycle modes <kbd>Shift+Tab</kbd>
                </p>
              </div>
            )}
          </div>
          {effectiveComposerMode(composerMode, selectedModel?.supportedParameters.includes("tools") ?? false).reason ? (
            <p role="status">
              {
                effectiveComposerMode(composerMode, selectedModel?.supportedParameters.includes("tools") ?? false)
                  .reason
              }
            </p>
          ) : null}
          <div className="studio-agent__mode">
            <button
              className="studio-agent__chip"
              type="button"
              aria-haspopup="menu"
              aria-expanded={variantMenuOpen}
              aria-controls="studio-composer-variants"
              title="Run this prompt in 1 to 4 frames side by side."
              onClick={() => setVariantMenuOpen((open) => !open)}
            >
              {variantScale}×
            </button>
            {variantMenuOpen && (
              <div
                id="studio-composer-variants"
                className="studio-agent__plus studio-agent__mode-menu"
                role="menu"
                aria-label="Variants"
              >
                {(
                  [
                    [1, "One agent"],
                    [2, "Two variants, side by side"],
                    [3, "Three variants"],
                    [4, "Four variants"]
                  ] as const
                ).map(([count, label]) => (
                  <button
                    key={count}
                    type="button"
                    role="menuitemradio"
                    aria-checked={variantScale === count}
                    onClick={() => {
                      setVariantScale(count);
                      setVariantMenuOpen(false);
                    }}
                  >
                    <span>{count}×</span>
                    <span>{label}</span>
                  </button>
                ))}
                <p className="studio-agent__menu-note">Each variant runs in its own frame.</p>
              </div>
            )}
          </div>
          {variantSessions.length > 1 ? (
            <div className="studio-agent__variants" role="group" aria-label="Variant frames">
              {variantSessions.map((session) => (
                <button
                  key={session.frameId}
                  type="button"
                  onClick={() => {
                    if (!editor) return;
                    keepVariantFrame(adaptEditorForVariants(editor), variantSessions, session.index);
                    setVariantSessions([]);
                  }}
                >
                  Keep {session.name}
                </button>
              ))}
            </div>
          ) : null}
          <div
            className="studio-model-picker-anchor"
            ref={modelPickerAnchorRef}
            style={
              {
                "--studio-model-picker-width": "490px"
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
                    <span>
                      {modelCatalog.status === "loading"
                        ? "Loading available models…"
                        : modelCatalog.models.length === 0
                          ? "OpenRouter catalog"
                          : `${visibleModels.length.toLocaleString()} of ${modelCatalog.models.length.toLocaleString()} shown · newest first when unsorted`}
                    </span>
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

                <div className="studio-model-picker-popover__search-row">
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
                  <div className="studio-model-picker-popover__sort" ref={sortMenuRef}>
                    <button
                      type="button"
                      className="studio-model-picker-popover__sort-button"
                      aria-haspopup="menu"
                      aria-expanded={sortMenuOpen}
                      title="Sort models"
                      onClick={() => setSortMenuOpen((open) => !open)}
                    >
                      <ArrowUpDown size={13} aria-hidden="true" />
                      <span className="studio-model-picker-popover__sort-label">
                        {MODEL_SORT_OPTIONS.find((option) => option.id === modelSortOrder)?.label ?? "Sort"}
                      </span>
                      <ChevronDown size={13} aria-hidden="true" />
                    </button>
                    {sortMenuOpen && (
                      <div className="studio-model-picker-popover__sort-menu" role="menu" aria-label="Sort models">
                        {MODEL_SORT_OPTIONS.map((option) => {
                          const isSelected = option.id === modelSortOrder;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={isSelected}
                              className={`studio-model-picker-popover__sort-item${isSelected ? " is-selected" : ""}`}
                              onClick={() => {
                                setModelSortOrder(option.id);
                                setSortMenuOpen(false);
                              }}
                            >
                              <span>{option.label}</span>
                              {isSelected ? (
                                <Check
                                  size={14}
                                  aria-hidden="true"
                                  className="studio-model-picker-popover__sort-check"
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <fieldset className="studio-model-picker-popover__quick-filters">
                  <legend className="sr-only">Quick filters</legend>
                  {(
                    [
                      ["free", "Free"],
                      ["vision", "Vision"],
                      ["tools", "Tools"],
                      ["reasoning", "Reasoning"],
                      ["intelligence", "Intelligence"]
                    ] as const
                  ).map(([filter, label]) => {
                    const active = quickModelFilters.includes(filter);
                    const count = filterCounts.perFilter[filter];
                    return (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={active}
                        className={active ? "is-active" : ""}
                        title={`${label}: ${count.toLocaleString()} model${count === 1 ? "" : "s"} match on their own`}
                        onClick={() =>
                          setQuickModelFilters((current) =>
                            current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
                          )
                        }
                      >
                        {label}
                        <span className="studio-model-picker-popover__filter-count" aria-hidden="true">
                          {count.toLocaleString()}
                        </span>
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
                    const activeElement = document.activeElement as HTMLElement | null;
                    const activeOption = activeElement?.dataset.modelId
                      ? activeElement
                      : activeElement?.closest<HTMLElement>("[data-model-id]");
                    const activeModelId = activeOption?.dataset.modelId;
                    const current = activeModelId
                      ? options.findIndex((option) => option.dataset.modelId === activeModelId)
                      : -1;
                    const next = nextModelOptionIndex(
                      event.key as "ArrowDown" | "ArrowUp" | "Home" | "End",
                      current,
                      options.length
                    );
                    if (next !== null) options[next]?.focus();
                  }}
                >
                  {groupCatalogModels(
                    sortedModels,
                    readStoredIds(FAVORITE_MODELS_KEY),
                    readStoredIds(RECENT_MODELS_KEY),
                    modelSortOrder
                  ).map((group) => (
                    // biome-ignore lint/a11y/useSemanticElements: A listbox group labels related options and must keep ARIA listbox semantics.
                    <div
                      key={group.id}
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
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                chooseModel(model.id);
                              }}
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
                                      <span
                                        className={`studio-model-picker-popover__badge${
                                          badge === "Intelligence"
                                            ? " studio-model-picker-popover__badge--intelligence"
                                            : ""
                                        }`}
                                        key={badge}
                                      >
                                        {badge === "Intelligence" && typeof model.intelligence === "number"
                                          ? `Intelligence: ${model.intelligence.toFixed(1)}`
                                          : badge}
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
                              data-model-id={model.id}
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
                  {visibleModels.length === 0 && (
                    <div className="studio-model-picker-popover__empty" role="status">
                      {modelCatalog.status === "loading" ? (
                        <p>Loading models…</p>
                      ) : modelCatalog.models.length === 0 ? (
                        <div className="studio-model-picker-popover__empty-connect">
                          <p>No models available yet</p>
                          <span>Connect your OpenRouter key in Settings to load models.</span>
                          <button
                            type="button"
                            onClick={() => {
                              closeModelPicker(true);
                              document.querySelector<HTMLElement>('[aria-label="Settings"]')?.click();
                            }}
                          >
                            Open Settings
                          </button>
                        </div>
                      ) : filtersConflict ? (
                        <div className="studio-model-picker-popover__empty-connect">
                          <p>No model matches all of those filters together</p>
                          <span>
                            The filters combine with “and”. Each one matches on its own —{" "}
                            {quickModelFilters
                              .map((filter) => `${filterCounts.perFilter[filter].toLocaleString()} ${filter}`)
                              .join(", ")}{" "}
                            — but nothing matches them all at once. Drop one to see results.
                          </span>
                          <button type="button" onClick={() => setQuickModelFilters([])}>
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        <p>No models match the current search or filters.</p>
                      )}
                    </div>
                  )}
                </div>

                <footer className="studio-model-picker-popover__footer">
                  <span aria-live="polite">
                    {modelCatalog.models.length === 0
                      ? "Connect OpenRouter to browse models"
                      : `${visibleModels.length.toLocaleString()} of ${modelCatalog.models.length.toLocaleString()} models · $/1M input / output`}
                    {modelCatalog.refreshedAt
                      ? ` · refreshed ${formatCatalogRefresh(modelCatalog.refreshedAt)}`
                      : modelCatalog.message && modelCatalog.models.length > 0
                        ? ` · ${modelCatalog.message}`
                        : ""}
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
          // biome-ignore lint/a11y/useSemanticElements: This is a labeled attachment group, not a form fieldset.
          <div className="studio-agent__attachment" role="group" aria-label="Local screenshot attachment">
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
        {attachedImage && connectionHost === "web" && (
          <p className="studio-agent__attachment-notice" role="status">
            This image stays in this browser until you connect a vision model.
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
        <div
          className={`studio-agent__composer-actions${lastExchange(messages) ? " studio-agent__composer-actions--history" : ""}`}
        >
          {lastExchange(messages) ? (
            <div className="studio-agent__composer-history-actions">
              <button
                className="studio-agent__button"
                type="button"
                disabled={isChatBusy(chatRun)}
                title="Put the last message back in the composer."
                onClick={retryLastUserMessage}
              >
                Edit last message
              </button>
              <button
                className="studio-agent__button"
                type="button"
                disabled={!selectedModel || isChatBusy(chatRun) || Boolean(outboundPreview)}
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
            </div>
          ) : null}
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
        {!canChat && connectionHost === "web" ? (
          <div className="studio-agent__composer-help">
            Saved in this browser. Connect OpenRouter from this browser. Requests go directly to OpenRouter. Kurva has
            no server.
          </div>
        ) : !canChat && connectionHost === "browser" ? (
          <div className="studio-agent__composer-help">Use the VS Code editor tab to connect and chat.</div>
        ) : !canChat && !workspaceTrusted ? (
          <div className="studio-agent__composer-help">Workspace trust is required for OpenRouter requests.</div>
        ) : null}
        <p className={`studio-agent__host-status${connected ? " studio-agent__host-status--on" : ""}`} role="status">
          {connected
            ? connectionHost === "web"
              ? "OpenRouter connected · requests go directly from this browser. Kurva has no server."
              : "OpenRouter connected · your key stays on this computer"
            : `OpenRouter ${connectionLabel.toLowerCase()}`}
        </p>
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
              including a frame screenshot when requested, return to the selected model.{" "}
              {connectionHost === "web"
                ? "Requests go directly from this browser to OpenRouter. Kurva has no server."
                : "The OpenRouter key stays on the host."}
            </p>
            <button
              type="button"
              onClick={() => {
                setConsented(true);
                setConsentOpen(false);
                recordProjectChatConsent(projectId, window.sessionStorage);
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
          warnPaidModels={warnPaidModels}
          direct={connectionHost === "web"}
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
  warnPaidModels,
  direct = false,
  sendRef,
  onCancel,
  onSend
}: {
  preview: OutboundPreview;
  showFull: boolean;
  warnPaidModels: boolean;
  direct?: boolean;
  sendRef: React.RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onSend: () => void;
}) {
  const outboundMessages = keyedOutboundMessages([
    { kind: "system" as const, role: "assistant" as const, content: STUDIO_CHAT_SYSTEM_PROMPT },
    ...preview.history.map((message) => ({ kind: "history" as const, ...message })),
    { kind: "draft" as const, role: "user" as const, content: preview.message }
  ]);

  return (
    <div className="studio-outbound-overlay">
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
            {warnPaidModels
              ? (paidModelCue(
                  readCatalogPrice(preview.model.promptPrice),
                  readCatalogPrice(preview.model.completionPrice)
                ) ?? "This model is listed as free.")
              : "Paid-model price warnings are off in Settings."}
            {direct ? " Requests go directly from this browser to OpenRouter. Kurva has no server." : ""}
          </p>
        </header>
        {showFull && (
          <div className="studio-outbound-dialog__messages">
            {outboundMessages.map(({ key, kind, message }) => (
              <article className="studio-outbound-dialog__message" key={key}>
                <strong className="studio-outbound-dialog__message-role">
                  {kind === "system"
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

function keyedOutboundMessages(
  messages: Array<{ kind: "system" | "history" | "draft"; role: "assistant" | "user"; content: string }>
): Array<{
  key: string;
  kind: "system" | "history" | "draft";
  message: { role: "assistant" | "user"; content: string };
}> {
  const occurrences = new Map<string, number>();
  return messages.map(({ kind, role, content }) => {
    let hash = 2_166_136_261;
    for (let index = 0; index < content.length; index += 1) {
      hash = Math.imul(hash ^ content.charCodeAt(index), 16_777_619);
    }
    const identity = `${kind}:${role}:${content.length}:${(hash >>> 0).toString(36)}`;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { key: `${identity}:${occurrence}`, kind, message: { role, content } };
  });
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

function getComposerPlaceholder(
  host: "vscode" | "standalone" | "browser" | "web",
  canChat: boolean,
  catalog: StudioModelCatalog,
  model?: StudioModel
): string {
  if (host === "web") return "Saved in this browser";
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

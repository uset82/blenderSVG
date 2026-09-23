import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  STUDIO_CHAT_SYSTEM_PROMPT,
  type StudioChatHistoryMessage,
  type StudioModel
} from "@codex-avatar-studio/avatar-core";
import { filterStudioModels, readCatalogPrice, type ModalityFilter, type PriceFilter } from "./modelFilters.js";
import type { StudioChatRun, StudioModelCatalog, StudioImageAttachment } from "../bridge/studioHost.js";

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
  panelWidth: number;
  panelHeight: number;
  onConnectionAction: (action: OpenRouterConnectionAction) => void;
  onRefreshModels: () => void;
  onSendChat: (
    modelId: string,
    history: StudioChatHistoryMessage[],
    userMessage: string,
    attachment?: StudioImageAttachment
  ) => string | null;
  onCancelChat: (requestId: string) => void;
  onClearChatRun: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "error";
  errorMessage?: string;
  attachment?: { file: File; dataUrl: string };
}

interface OutboundPreview {
  model: StudioModel;
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
  panelWidth,
  panelHeight,
  onConnectionAction,
  onRefreshModels,
  onSendChat,
  onCancelChat,
  onClearChatRun
}: AgentHarnessSidebarProps) {
  const [selectedModelId, setSelectedModelId] = useState(readSelectedModelId);
  const [modelQuery, setModelQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>("all");
  const [minimumContext, setMinimumContext] = useState("all");
  const [maximumInputPrice, setMaximumInputPrice] = useState("");
  const [maximumOutputPrice, setMaximumOutputPrice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [outboundPreview, setOutboundPreview] = useState<OutboundPreview | null>(null);
  const previewSendRef = useRef<HTMLButtonElement>(null);
  const lastDraftPrefillIdRef = useRef<string | null>(null);
  const lastImagePrefillIdRef = useRef<string | null>(null);

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
      ? "This local browser preview cannot store keys or send chat. Open Studio from VS Code to use SecretStorage and the trusted host."
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
  const selectedModel = modelCatalog.models.find((model) => model.id === selectedModelId);
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
    if (!outboundPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOutboundPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [outboundPreview]);

  if (!isOpen) return null;

  const requestPreview = async () => {
    if (!canSend || !selectedModel) return;
    setAttachmentError(null);
    const transcript = messages
      .filter((message) => message.role === "user" || message.status === "complete")
      .map(({ role, content }) => ({ role, content }) as StudioChatHistoryMessage);
    const bounded = boundOutboundHistory(transcript);
    let attachment: OutboundPreview["attachment"];
    try {
      if (attachedImage) attachment = { file: attachedImage, dataUrl: await readImageAsDataUrl(attachedImage) };
    } catch {
      setAttachmentError("Studio could not prepare this image locally. Remove it and attach it again.");
      return;
    }
    setOutboundPreview({
      model: selectedModel,
      history: bounded.history,
      message: draft.trim(),
      omittedMessages: bounded.omittedMessages,
      ...(attachment ? { attachment } : {})
    });
  };

  const sendAfterPreview = () => {
    if (!outboundPreview) return;
    const requestId = onSendChat(
      outboundPreview.model.id,
      outboundPreview.history,
      outboundPreview.message,
      outboundPreview.attachment ? { dataUrl: outboundPreview.attachment.dataUrl } : undefined
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
  };

  const startNewConversation = () => {
    if (chatRun && isChatBusy(chatRun)) onCancelChat(chatRun.requestId);
    setMessages([]);
    setDraft("");
    setAttachedImage(null);
    onClearChatRun();
  };

  const stopGeneration = () => {
    if (chatRun && isChatBusy(chatRun)) onCancelChat(chatRun.requestId);
  };

  const retryLastUserMessage = () => {
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf("user");
    if (lastUserIndex < 0) return;
    const lastUser = messages[lastUserIndex];
    setMessages(messages.slice(0, lastUserIndex));
    setDraft(lastUser?.content ?? "");
    setAttachedImage(lastUser?.attachment?.file ?? null);
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
        <div>
          <div className="studio-agent__title">Conversation</div>
          <div className="studio-agent__subtitle">
            OpenRouter · {connectionLabel} · <span aria-label="Tool execution off">Tools off</span>
          </div>
        </div>
        <div className="studio-agent__header-actions">
          <button className="studio-agent__button" type="button" onClick={startNewConversation}>
            New chat
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
            <span role="status" className={`studio-agent__connection-status${connected ? " studio-agent__connection-status--connected" : ""}`}>
              {connectionLabel}
            </span>
          </div>
          <p className="studio-agent__connection-message">
            {connectionMessage}
          </p>
          {connectionHost === "vscode" && (
            <div className="studio-agent__connection-actions">
              <button
                className="studio-agent__button"
                type="button"
                disabled={!canManageConnection}
                onClick={() => onConnectionAction(connected ? "replace" : "connect")}
              >
                {connected ? "Replace key" : "Connect"}
              </button>
              {connected && (
                <>
                  <button
                    className="studio-agent__button"
                    type="button"
                    disabled={!canManageConnection}
                    onClick={() => onConnectionAction("test")}
                  >
                    Test
                  </button>
                  <button
                    className="studio-agent__button"
                    type="button"
                    disabled={!canManageConnection}
                    onClick={() => onConnectionAction("disconnect")}
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <section
          className="studio-agent__section studio-agent-sidebar__privacy"
          aria-label="Privacy and context"
        >
          <div className="studio-agent__privacy-title">Review before sending</div>
          <p className="studio-agent__privacy-copy">
            Studio sends the conversation only after review. A screenshot is included only when you attach it; the
            review shows the image before sending. Other canvas content, SVG, Blender scenes, and local paths stay local.
            Attach the screenshot again if a later message needs it.
          </p>
        </section>
        <section className="studio-agent__model-section" aria-label="Model selection">
          <div className="studio-agent__section-heading">
            <label className="studio-agent__model-title" htmlFor="studio-model-search">
              Model
            </label>
            <button
              className="studio-agent__button studio-agent__button--small"
              type="button"
              disabled={!canChat || modelCatalog.status === "loading"}
              onClick={onRefreshModels}
            >
              Refresh models
            </button>
          </div>
          <input
            id="studio-model-search"
            type="search"
            value={modelQuery}
            onChange={(event) => setModelQuery(event.target.value)}
            disabled={modelCatalog.status !== "ready"}
            placeholder="Search available models"
            className="studio-agent__field"
          />
          <details className="studio-agent__filters">
            <summary>
              Filter catalog
            </summary>
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
          <select
            aria-label="Choose an OpenRouter model"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            disabled={modelCatalog.status !== "ready" || !canChat}
            className="studio-agent__field"
          >
            <option value="">Choose a model</option>
            {matchingModels.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.textChatEligible}>
                {model.name} · {model.author} · {modelCapabilities(model)} · {formatCatalogPrice(model)}
              </option>
            ))}
          </select>
          {selectedModelId && !selectedModel && modelCatalog.status === "ready" && (
            <div role="status" className="studio-agent__notice">
              Your saved model ({selectedModelId}) is no longer listed for this account. Choose another model to
              continue; Studio has not switched it automatically.
            </div>
          )}
          {selectedModelId && selectedModel && !selectedModel.textChatEligible && (
            <div role="status" className="studio-agent__notice">
              This model is listed by OpenRouter but does not advertise both text input and text output, so chat is
              disabled.
            </div>
          )}
          <div aria-live="polite" className="studio-agent__catalog-status">
            {matchingModels.length.toLocaleString()} of {modelCatalog.models.length.toLocaleString()} models match these
            filters.
          </div>
          <div aria-live="polite" className="studio-agent__catalog-status studio-agent__catalog-status--detail">
            {modelCatalog.status === "loading" ? "Loading the account-filtered model catalog…" : modelCatalog.message}
            {modelCatalog.status === "ready" && selectedModel
              ? ` Selected: ${selectedModel.contextLength.toLocaleString()} token context · ${formatCatalogPrice(selectedModel)}.`
              : ""}
          </div>
          {modelCatalog.status === "error" && connectionHost === "vscode" && (
            <button className="studio-agent__button studio-agent__button--start" type="button" onClick={onRefreshModels}>
              Try again
            </button>
          )}
        </section>

        <div
          className="studio-agent__messages"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 ? (
            <div className="studio-agent__empty-message">
              Choose an account-available text model. Each send opens a review of the exact instructions, history, and
              message before the request reaches OpenRouter.
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`studio-agent__message${message.role === "user" ? " studio-agent__message--user" : ""}`}
                key={message.id}
                aria-label={`${message.role === "user" ? "You" : "Assistant"}${message.status === "streaming" ? ", generating" : ""}`}
              >
                <div className="studio-agent__message-heading">
                  <strong>
                    {message.role === "user" ? "You" : "Assistant"}
                  </strong>
                  {message.status === "streaming" ? <span role="status">Generating…</span> : null}
                </div>
                <div className="studio-agent__message-content">
                  {message.content || (message.status === "streaming" ? "Waiting for the first token…" : "")}
                </div>
                {message.attachment && (
                  <img className="studio-agent__message-image" src={message.attachment.dataUrl} alt="Screenshot sent with this message" />
                )}
                {message.errorMessage && (
                  <p role="alert" className="studio-agent__message-error">
                    {message.errorMessage}
                  </p>
                )}
              </article>
            ))
          )}
          {chatRun?.status === "complete" && chatRun.usage && (
            <div className="studio-agent__usage" role="status">
              Usage returned by OpenRouter: {chatRun.usage.promptTokens ?? "—"} input ·{" "}
              {chatRun.usage.completionTokens ?? "—"} output tokens.
            </div>
          )}
        </div>
      </div>

      <footer className="studio-agent-composer">
        <label className="studio-agent__composer-label" htmlFor="studio-chat-composer">
          Message
        </label>
        <textarea
          id="studio-chat-composer"
          className="studio-agent__field studio-agent-composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 12_000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              requestPreview();
            }
          }}
          disabled={
            !canChat || modelCatalog.status !== "ready" || !selectedModel?.textChatEligible || isChatBusy(chatRun)
          }
          placeholder={getComposerPlaceholder(connectionHost, canChat, modelCatalog, selectedModel)}
          rows={3}
        />
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
          <p className="studio-agent__attachment-notice" role="status">This image is still local. Open Studio in VS Code to connect a vision model.</p>
        )}
        {attachedImage && connectionHost === "vscode" && !selectedModel?.inputModalities.includes("image") && (
          <p className="studio-agent__attachment-notice" role="status">Choose a model with image input before reviewing this request.</p>
        )}
        {attachmentError && <p className="studio-agent__attachment-notice" role="alert">{attachmentError}</p>}
        <div className="studio-agent__composer-actions">
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
              className="studio-agent__button studio-agent__button--primary"
              type="button"
              disabled={!canSend}
              onClick={requestPreview}
            >
              Review &amp; send
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

      {outboundPreview && (
        <OutboundRequestDialog
          preview={outboundPreview}
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
  sendRef,
  onCancel,
  onSend
}: {
  preview: OutboundPreview;
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
          <h2 id="studio-outbound-title">
            Review what leaves Studio
          </h2>
          <p className="studio-outbound-dialog__description">
            {preview.attachment
              ? `This request sends the exact messages below and the attached screenshot to OpenRouter for ${preview.model.name}. No tools, other canvas files, SVG, Blender scenes, or local paths are attached.`
              : `This request sends the exact messages below to OpenRouter for ${preview.model.name}. No tools, canvas files, images, SVG, Blender scenes, or local paths are attached.`}
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
        </header>
        <div className="studio-outbound-dialog__messages">
          {outboundMessages.map((message, index) => (
            <article
              className="studio-outbound-dialog__message"
              key={`${message.role}-${index}`}
            >
              <strong className="studio-outbound-dialog__message-role">
                {index === 0
                  ? "Studio instructions"
                  : message.role === "user"
                    ? "User message"
                    : "Conversation history · assistant"}
              </strong>
              <pre className="studio-outbound-dialog__message-content">
                {message.content}
              </pre>
            </article>
          ))}
          {preview.attachment && (
            <figure className="studio-outbound-dialog__attachment">
              <figcaption>Screenshot included in this request</figcaption>
              <img src={preview.attachment.dataUrl} alt="Screenshot that will be sent to OpenRouter" />
            </figure>
          )}
        </div>
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

function isChatBusy(run: StudioChatRun | null): boolean {
  return run?.status === "streaming" || run?.status === "stopping";
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(reader.result)) {
        resolve(reader.result);
      } else reject(new Error("Unsupported image."));
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("Image read failed.")), { once: true });
    reader.readAsDataURL(file);
  });
}

function boundOutboundHistory(messages: StudioChatHistoryMessage[]): {
  history: StudioChatHistoryMessage[];
  omittedMessages: number;
} {
  const maxMessages = 40;
  const maxHistoryCharacters = 48_000;
  const perMessageLimit = 12_000;
  const bounded = messages.map((message) => {
    if (message.content.length <= perMessageLimit) return message;
    const marker = "[Earlier content omitted from this long reply]\n";
    return { ...message, content: marker + message.content.slice(-(perMessageLimit - marker.length)) };
  });
  const selected: StudioChatHistoryMessage[] = [];
  let characters = 0;
  for (let index = bounded.length - 1; index >= 0; index -= 1) {
    const message = bounded[index]!;
    if (selected.length >= maxMessages || characters + message.content.length > maxHistoryCharacters) break;
    selected.push(message);
    characters += message.content.length;
  }
  selected.reverse();
  return { history: selected, omittedMessages: bounded.length - selected.length };
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
  return "Describe what you want to design…";
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

function modelCapabilities(model: StudioModel): string {
  const capabilities = [
    ...(model.textChatEligible ? ["text chat"] : []),
    ...(model.inputModalities.includes("image") ? ["image input"] : []),
    ...(model.outputModalities.includes("image") ? ["image output"] : [])
  ];
  return capabilities.length ? capabilities.join(", ") : "other modality";
}

function readOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readSelectedModelId(): string {
  try {
    return window.localStorage.getItem("codex-avatar-studio-selected-model") ?? "";
  } catch {
    return "";
  }
}

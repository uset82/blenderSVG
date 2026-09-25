import { describe, expect, it } from "vitest";
import {
  createHostToStudioMessage,
  createStudioToHostMessage,
  parseHostToStudioMessage,
  parseStudioToHostMessage,
  STUDIO_PROTOCOL_VERSION
} from "../src/studioProtocol.js";

describe("Studio bridge protocol", () => {
  it("round-trips bounded connection messages", () => {
    const ready = createStudioToHostMessage({ type: "studio:ready" });
    const request = createStudioToHostMessage({ type: "studio:openRouterConnection", action: "replace" });
    const state = createHostToStudioMessage({
      type: "studio:hostState",
      host: "vscode",
      workspaceTrusted: true,
      connection: { status: "connected", message: "OpenRouter key verified." }
    });
    const standaloneState = createHostToStudioMessage({
      type: "studio:hostState",
      host: "standalone",
      workspaceTrusted: true,
      connection: { status: "connected", message: "OpenRouter key verified on this computer." }
    });
    expect(ready.protocolVersion).toBe(STUDIO_PROTOCOL_VERSION);
    expect(parseStudioToHostMessage(ready).success).toBe(true);
    expect(parseStudioToHostMessage(request).success).toBe(true);
    expect(parseHostToStudioMessage(state).success).toBe(true);
    expect(parseHostToStudioMessage(standaloneState).success).toBe(true);
  });

  it("rejects versions, unknown actions, oversized content, and credential fields", () => {
    expect(parseStudioToHostMessage({ protocolVersion: 2, type: "studio:ready" }).success).toBe(false);
    expect(parseStudioToHostMessage({ type: "studio:ready" }).success).toBe(true);
    const turn = createHostToStudioMessage({
      type: "studio:turnEvent",
      requestId: "request-1",
      state: "schedule-tools",
      text: ""
    });
    expect(turn.protocolVersion).toBe(2);
    expect(parseHostToStudioMessage(turn).success).toBe(true);
    expect(
      parseStudioToHostMessage({
        protocolVersion: 2,
        type: "studio:toolPermission",
        requestId: "request-1",
        callId: "call-1",
        granted: false,
        apiKey: "private"
      }).success
    ).toBe(false);
    expect(
      parseStudioToHostMessage({ protocolVersion: 1, type: "studio:openRouterConnection", action: "spend" }).success
    ).toBe(false);
    expect(parseStudioToHostMessage({ protocolVersion: 1, type: "studio:ready", apiKey: "private" }).success).toBe(
      false
    );
    expect(
      parseHostToStudioMessage({
        protocolVersion: 1,
        type: "studio:hostState",
        host: "vscode",
        workspaceTrusted: true,
        connection: { status: "connected", message: "ok", apiKey: "private" }
      }).success
    ).toBe(false);
    expect(
      parseHostToStudioMessage({
        protocolVersion: 1,
        type: "studio:hostState",
        host: "vscode",
        workspaceTrusted: true,
        connection: { status: "error", message: "x".repeat(501) }
      }).success
    ).toBe(false);
  });

  it("round-trips bounded tool approval, execution, and result messages", () => {
    const proposal = createHostToStudioMessage({
      type: "studio:toolProposed",
      requestId: "request-1234",
      callId: "call_123",
      name: "create_frame",
      summary: "Add a frame.",
      requiresApproval: true,
      arguments: JSON.stringify({ name: "Landing", width: 1440, height: 900 })
    });
    expect(parseHostToStudioMessage(proposal).success).toBe(true);

    const execute = createHostToStudioMessage({
      type: "studio:toolExecute",
      requestId: "request-1234",
      callId: "call_123",
      name: "create_frame",
      arguments: JSON.stringify({ name: "Landing", width: 1440, height: 900 })
    });
    expect(parseHostToStudioMessage(execute).success).toBe(true);

    const permission = createStudioToHostMessage({
      type: "studio:toolPermission",
      requestId: "request-1234",
      callId: "call_123",
      granted: true
    });
    expect(parseStudioToHostMessage(permission).success).toBe(true);
    const result = createStudioToHostMessage({
      type: "studio:toolExecutionResult",
      requestId: "request-1234",
      callId: "call_123",
      ok: true,
      content: "Frame created."
    });
    expect(parseStudioToHostMessage(result).success).toBe(true);
    expect(parseStudioToHostMessage({ ...result, content: "x".repeat(16_385) }).success).toBe(false);
    expect(parseHostToStudioMessage({ ...proposal, arguments: "[]" }).success).toBe(false);
    expect(parseHostToStudioMessage({ ...execute, apiKey: "must-not-cross-the-bridge" }).success).toBe(false);
  });

  it("bounds project import messages and keeps file paths out of the bridge", () => {
    const request = createStudioToHostMessage({ type: "studio:projectImportRequest", requestId: "import-1234" });
    expect(parseStudioToHostMessage(request).success).toBe(true);
    expect(parseStudioToHostMessage({ ...request, sourcePath: "C:\\private\\project.json" }).success).toBe(false);

    const response = createHostToStudioMessage({
      type: "studio:projectImported",
      requestId: "import-1234",
      project: {
        id: "44a4252c-5bc5-41e6-b7b7-68a79736c7d5",
        title: "Imported canvas",
        createdAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-01-03T03:04:05.000Z",
        formatVersion: 1,
        snapshot: JSON.stringify({ document: { schema: {}, store: {} } })
      }
    });
    expect(parseHostToStudioMessage(response).success).toBe(true);
    expect(parseHostToStudioMessage({ ...response, apiKey: "must-not-leak" }).success).toBe(false);
  });

  it("accepts only bounded Scratchpad provisioning and a valid project response", () => {
    const snapshot = JSON.stringify({ document: { schema: {}, store: {} } });
    const request = createStudioToHostMessage({ type: "studio:ensureScratchpad", requestId: "scratch-1234", snapshot });
    expect(parseStudioToHostMessage(request).success).toBe(true);
    expect(parseStudioToHostMessage({ ...request, snapshot: "x".repeat(20_000_001) }).success).toBe(false);
    expect(parseStudioToHostMessage({ ...request, sourcePath: "C:\\private\\project.json" }).success).toBe(false);

    const response = createHostToStudioMessage({
      type: "studio:scratchpadEnsured",
      requestId: "scratch-1234",
      project: {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Scratchpad",
        createdAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-01-02T03:04:05.000Z",
        formatVersion: 1,
        snapshot
      }
    });
    expect(parseHostToStudioMessage(response).success).toBe(true);
  });

  it("round-trips local conversation operations and rejects credentials or oversized transcripts", () => {
    const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
    const conversationId = "00000000-0000-4000-8000-000000000001";
    const list = createStudioToHostMessage({
      type: "studio:conversationListRequest",
      requestId: "conversation-list-1",
      projectId
    });
    const save = createStudioToHostMessage({
      type: "studio:conversationSaveRequest",
      requestId: "conversation-save-1",
      projectId,
      conversation: {
        id: conversationId,
        title: "Canvas review",
        modelId: "openrouter/auto",
        messages: [{ role: "user", content: "Remember this." }]
      }
    });
    if (save.type !== "studio:conversationSaveRequest")
      throw new Error("Conversation request factory returned the wrong message.");
    expect(parseStudioToHostMessage(list).success).toBe(true);
    expect(parseStudioToHostMessage(save).success).toBe(true);
    expect(parseStudioToHostMessage({ ...save, apiKey: "private" }).success).toBe(false);
    expect(
      parseStudioToHostMessage({
        ...save,
        conversation: {
          ...save.conversation,
          messages: Array.from({ length: 201 }, () => ({ role: "user", content: "x" }))
        }
      }).success
    ).toBe(false);

    const record = {
      id: conversationId,
      projectId,
      title: "Canvas review",
      modelId: "openrouter/auto",
      updatedAt: "2026-01-03T03:04:05.000Z",
      messages: [{ role: "user" as const, content: "Remember this." }]
    };
    const read = createHostToStudioMessage({
      type: "studio:conversationRead",
      requestId: "conversation-read-1",
      conversation: record
    });
    expect(parseHostToStudioMessage(read).success).toBe(true);
    expect(parseHostToStudioMessage({ ...read, conversation: { ...record, apiKey: "private" } }).success).toBe(false);
  });

  it("accepts bounded raster tracing and chat image attachments only", () => {
    const traceRequest = createStudioToHostMessage({
      type: "studio:traceImage",
      requestId: "trace-1234",
      mediaType: "image/png",
      dataBase64: "AAAA"
    });
    expect(parseStudioToHostMessage(traceRequest).success).toBe(true);
    expect(parseStudioToHostMessage({ ...traceRequest, mediaType: "image/svg+xml" }).success).toBe(false);

    const chatRequest = createStudioToHostMessage({
      type: "studio:chatRequest",
      requestId: "chat-1234",
      modelId: "openai/vision-model",
      history: [],
      userMessage: "Recreate this screenshot.",
      attachment: { dataUrl: "data:image/png;base64,iVBORw0KGgo=" }
    });
    expect(parseStudioToHostMessage(chatRequest).success).toBe(true);
    expect(
      parseStudioToHostMessage({
        ...chatRequest,
        attachment: { dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }
      }).success
    ).toBe(false);
    expect(
      parseStudioToHostMessage({
        ...chatRequest,
        attachment: { dataUrl: `data:image/png;base64,${"A".repeat(2_100_000)}` }
      }).success
    ).toBe(false);
  });
});

import { z } from "zod";

export const STUDIO_PROTOCOL_VERSION = 1 as const;
export const STUDIO_CHAT_SYSTEM_PROMPT =
  "You are the Codex Avatar Studio design assistant. Help the user plan and refine their canvas. Describe suggestions clearly. You cannot directly change the canvas in this version; never claim to have applied edits, saved files, or inspected content that was not explicitly included in the conversation.";

const version = z.literal(STUDIO_PROTOCOL_VERSION);
const agentVersion = z.literal(2);
export const STUDIO_AGENT_PROTOCOL_VERSION = 2 as const;
const requestId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const agentCallId = z.string().trim().min(1).max(80);
const boundedToolArguments = z
  .string()
  .min(2)
  .max(16_384)
  .refine((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Tool arguments must be a JSON object.");
const boundedToolImage = z
  .string()
  .max(2_100_000)
  .refine(
    (value) => /^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),
    "Tool image must be a bounded PNG data URL."
  );
const connection = z.strictObject({
  status: z.enum(["disconnected", "connected", "checking", "error"]),
  message: z.string().trim().min(1).max(500)
});
const model = z.strictObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  author: z.string().trim().max(120),
  description: z.string().max(1600),
  inputModalities: z.array(z.string().max(80)).max(32),
  outputModalities: z.array(z.string().max(80)).max(32),
  contextLength: z.number().int().nonnegative().max(10_000_000),
  promptPrice: z.string().max(64),
  completionPrice: z.string().max(64),
  supportedParameters: z.array(z.string().max(100)).max(256),
  textChatEligible: z.boolean()
});
const chatHistoryMessage = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12_000)
});
const chatImageAttachment = z
  .strictObject({ dataUrl: z.string().max(2_100_000) })
  .superRefine((attachment, context) => {
    const match = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(attachment.dataUrl);
    const payload = match?.[1] ?? "";
    const validBase64 =
      payload.length % 4 === 0 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/.test(payload);
    if (!validBase64) {
      context.addIssue({ code: "custom", message: "The image attachment must be a supported base64 image." });
    }
  });
const usage = z.strictObject({
  promptTokens: z.number().int().nonnegative().max(100_000_000).optional(),
  completionTokens: z.number().int().nonnegative().max(100_000_000).optional(),
  totalTokens: z.number().int().nonnegative().max(200_000_000).optional(),
  cost: z.number().nonnegative().max(1_000_000).optional()
});
const projectId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const projectMeta = z.strictObject({
  id: projectId,
  title: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
const projectDocument = z.strictObject({
  ...projectMeta.shape,
  formatVersion: z.literal(1),
  snapshot: z.string().min(2).max(20_000_000)
});
const conversationMeta = z.strictObject({
  id: projectId,
  title: z.string().trim().min(1).max(120),
  modelId: z.string().max(200),
  updatedAt: z.string().datetime()
});
const conversationMessage = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12_000)
});
const conversationRecord = z.strictObject({
  ...conversationMeta.shape,
  projectId,
  messages: z.array(conversationMessage).max(200)
});

/** Messages accepted by the trusted Studio host. No provider credential is permitted. */
export const studioToHostMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ protocolVersion: version, type: z.literal("studio:ready") }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:openRouterConnection"),
    action: z.enum(["connect", "replace", "test", "disconnect"])
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:modelCatalogRequest") }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:traceImage"),
    requestId,
    mediaType: z.literal("image/png"),
    dataBase64: z
      .string()
      .min(4)
      .max(11_200_000)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectListRequest") }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:ensureScratchpad"),
    requestId,
    snapshot: z.string().min(2).max(20_000_000)
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectImportRequest"), requestId }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectOpen"), requestId, projectId }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectSave"),
    requestId,
    projectId,
    title: z.string().trim().min(1).max(120),
    snapshot: z.string().min(2).max(20_000_000)
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectDuplicate"), requestId, projectId }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectRename"),
    requestId,
    projectId,
    title: z.string().max(256)
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectReveal"), requestId, projectId }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectDelete"), requestId, projectId }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:conversationListRequest"), requestId, projectId }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationReadRequest"),
    requestId,
    projectId,
    conversationId: projectId
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationSaveRequest"),
    requestId,
    projectId,
    conversation: z.strictObject({
      id: projectId,
      title: z.string().trim().min(1).max(120),
      modelId: z.string().max(200),
      messages: z.array(conversationMessage).max(200)
    })
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationRenameRequest"),
    requestId,
    projectId,
    conversationId: projectId,
    title: z.string().trim().min(1).max(120)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationDeleteRequest"),
    requestId,
    projectId,
    conversationId: projectId
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:chatRequest"),
    requestId,
    modelId: z.string().trim().min(1).max(200),
    history: z.array(chatHistoryMessage).max(40),
    userMessage: z.string().trim().min(1).max(12_000),
    attachment: chatImageAttachment.optional(),
    mode: z.enum(["ask", "plan", "build", "auto"]).optional()
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:chatCancel"), requestId }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:agentStart"),
    requestId,
    mode: z.enum(["ask", "plan", "build", "auto"])
  }),
  z.strictObject({ protocolVersion: agentVersion, type: z.literal("studio:agentStop"), requestId }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:toolPermission"),
    requestId,
    callId: agentCallId,
    granted: z.boolean()
  }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:toolExecutionResult"),
    requestId,
    callId: agentCallId,
    ok: z.boolean(),
    content: z.string().max(16_384),
    imageDataUrl: boundedToolImage.optional()
  })
]);

/** Sanitized host state sent to the Studio UI. This schema has no key field. */
export const hostToStudioMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:hostState"),
    host: z.enum(["vscode", "standalone", "browser"]),
    workspaceTrusted: z.boolean(),
    connection
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:modelCatalog"),
    status: z.enum(["ready", "error"]),
    message: z.string().trim().min(1).max(500),
    models: z.array(model).max(10_000),
    refreshedAt: z.string().datetime().optional()
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectList"),
    status: z.enum(["ready", "error"]),
    message: z.string().trim().min(1).max(500),
    projects: z.array(projectMeta).max(2_000),
    corruptCount: z.number().int().nonnegative().max(2_000)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectOpened"),
    requestId,
    project: projectDocument
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectImported"),
    requestId,
    project: projectDocument
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:scratchpadEnsured"),
    requestId,
    project: projectDocument
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectSaved"),
    requestId,
    project: projectMeta
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectRenamed"),
    requestId,
    project: projectMeta
  }),
  z.strictObject({ protocolVersion: version, type: z.literal("studio:projectRevealed"), requestId, projectId }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectDeleted"),
    requestId,
    projectId
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:projectError"),
    requestId,
    code: z.enum(["workspace", "missing", "corrupt", "too-large", "invalid-title", "io", "cancelled"]),
    message: z.string().trim().min(1).max(500)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationList"),
    requestId,
    conversations: z.array(conversationMeta).max(50)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationRead"),
    requestId,
    conversation: conversationRecord.nullable()
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationSaved"),
    requestId,
    conversation: conversationRecord
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationRenamed"),
    requestId,
    conversation: conversationMeta
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationDeleted"),
    requestId,
    conversationId: projectId
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:conversationError"),
    requestId,
    code: z.enum(["workspace", "missing", "invalid", "io"]),
    message: z.string().trim().min(1).max(500)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:chatDelta"),
    requestId,
    delta: z.string().min(1).max(16_384)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:chatReasoning"),
    requestId,
    delta: z.string().min(1).max(16_384)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:imageTraced"),
    requestId,
    svg: z.string().min(1).max(2_000_000)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:traceError"),
    requestId,
    message: z.string().trim().min(1).max(500)
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:chatComplete"),
    requestId,
    modelId: z.string().trim().min(1).max(200),
    finishReason: z.string().max(80).optional(),
    usage: usage.optional()
  }),
  z.strictObject({
    protocolVersion: version,
    type: z.literal("studio:chatError"),
    requestId,
    code: z.enum([
      "cancelled",
      "not-connected",
      "model-unavailable",
      "invalid-request",
      "timeout",
      "rate-limited",
      "credits",
      "provider",
      "offline"
    ]),
    message: z.string().trim().min(1).max(500)
  }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:turnEvent"),
    requestId,
    state: z.enum([
      "input",
      "model",
      "streaming",
      "schedule-tools",
      "await-permission",
      "execute",
      "aggregate",
      "done",
      "error"
    ]),
    text: z.string().max(8_000)
  }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:toolProposed"),
    requestId,
    callId: agentCallId,
    name: z.string().trim().min(1).max(80),
    summary: z.string().max(500),
    requiresApproval: z.boolean(),
    arguments: boundedToolArguments
  }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:toolExecute"),
    requestId,
    callId: agentCallId,
    name: z.string().trim().min(1).max(80),
    arguments: boundedToolArguments
  }),
  z.strictObject({
    protocolVersion: agentVersion,
    type: z.literal("studio:toolResult"),
    requestId,
    callId: agentCallId,
    ok: z.boolean(),
    summary: z.string().max(500)
  })
]);

export type StudioToHostMessage = z.output<typeof studioToHostMessageSchema>;
export type HostToStudioMessage = z.output<typeof hostToStudioMessageSchema>;
export type StudioModel = z.output<typeof model>;
export type StudioChatHistoryMessage = z.output<typeof chatHistoryMessage>;
export type StudioChatUsage = z.output<typeof usage>;
export type StudioProjectMeta = z.output<typeof projectMeta>;
export type StudioProjectDocument = z.output<typeof projectDocument>;
export type StudioConversationMeta = z.output<typeof conversationMeta>;
export type StudioConversationRecord = z.output<typeof conversationRecord>;
type WithoutVersion<T> = T extends unknown ? Omit<T, "protocolVersion"> : never;
export type StudioToHostMessageInput = WithoutVersion<StudioToHostMessage>;
export type HostToStudioMessageInput = WithoutVersion<HostToStudioMessage>;

const AGENT_MESSAGE_TYPES = new Set([
  "studio:agentStart",
  "studio:agentStop",
  "studio:toolPermission",
  "studio:toolExecutionResult",
  "studio:toolExecute",
  "studio:turnEvent",
  "studio:toolProposed",
  "studio:toolResult"
]);

export function migrateStudioMessage(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.protocolVersion !== undefined) return value;
  return { ...record, protocolVersion: STUDIO_PROTOCOL_VERSION };
}

export function parseStudioToHostMessage(value: unknown) {
  return studioToHostMessageSchema.safeParse(migrateStudioMessage(value));
}

export function parseHostToStudioMessage(value: unknown) {
  return hostToStudioMessageSchema.safeParse(migrateStudioMessage(value));
}

export function createStudioToHostMessage(value: StudioToHostMessageInput): StudioToHostMessage {
  const protocolVersion = AGENT_MESSAGE_TYPES.has(value.type) ? STUDIO_AGENT_PROTOCOL_VERSION : STUDIO_PROTOCOL_VERSION;
  return studioToHostMessageSchema.parse({ ...value, protocolVersion });
}

export function createHostToStudioMessage(value: HostToStudioMessageInput): HostToStudioMessage {
  const protocolVersion = AGENT_MESSAGE_TYPES.has(value.type) ? STUDIO_AGENT_PROTOCOL_VERSION : STUDIO_PROTOCOL_VERSION;
  return hostToStudioMessageSchema.parse({ ...value, protocolVersion });
}

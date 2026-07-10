import { z } from "zod";
import {
  avatarConfigSchema,
  avatarManifestSchema,
  avatarPoseInputSchema,
  avatarStateSchema,
  avatarTriggerSchema
} from "./manifest.js";

export const AVATAR_PROTOCOL_VERSION = 1 as const;

export type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const protocolVersionSchema = z.literal(AVATAR_PROTOCOL_VERSION);

export const extensionToWebviewMessageSchema = z.discriminatedUnion("type", [
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:initialize"),
    config: avatarConfigSchema,
    manifest: avatarManifestSchema
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("avatar:setState"), state: avatarStateSchema }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("avatar:trigger"), trigger: avatarTriggerSchema }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:setMessage"),
    text: z.string().nullable()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("avatar:setPoseInput"),
    input: avatarPoseInputSchema
  }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("settings:update"), config: avatarConfigSchema }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("assets:manifestLoaded"),
    manifest: avatarManifestSchema
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("debug:event"),
    event: z.string().trim().min(1),
    payload: jsonValueSchema.optional()
  })
]);

export const webviewToExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("webview:ready") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:toggleAssistant") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:resetSettings") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:openAssetsFolder") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:reloadAvatar") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:vectorizeImage") }),
  z.object({ protocolVersion: protocolVersionSchema, type: z.literal("command:exportBlender") }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("settings:update"),
    config: avatarConfigSchema.partial()
  }),
  z.object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("debug:log"),
    message: z.string().trim().min(1),
    payload: jsonValueSchema.optional()
  })
]);

export type ExtensionToWebviewMessage = z.infer<typeof extensionToWebviewMessageSchema>;
export type WebviewToExtensionMessage = z.infer<typeof webviewToExtensionMessageSchema>;
type WithoutProtocolVersion<T> = T extends { protocolVersion: number } ? Omit<T, "protocolVersion"> : never;
export type ExtensionToWebviewMessageInput = WithoutProtocolVersion<ExtensionToWebviewMessage>;
export type WebviewToExtensionMessageInput = WithoutProtocolVersion<WebviewToExtensionMessage>;

export function createExtensionToWebviewMessage(message: ExtensionToWebviewMessageInput): ExtensionToWebviewMessage {
  return { protocolVersion: AVATAR_PROTOCOL_VERSION, ...message } as ExtensionToWebviewMessage;
}

export function createWebviewToExtensionMessage(message: WebviewToExtensionMessageInput): WebviewToExtensionMessage {
  return { protocolVersion: AVATAR_PROTOCOL_VERSION, ...message } as WebviewToExtensionMessage;
}

export function parseExtensionToWebviewMessage(input: unknown) {
  return extensionToWebviewMessageSchema.safeParse(input);
}

export function parseWebviewToExtensionMessage(input: unknown) {
  return webviewToExtensionMessageSchema.safeParse(input);
}

export function isProtocolSerializable(message: ExtensionToWebviewMessage | WebviewToExtensionMessage): boolean {
  try {
    const serialized = JSON.stringify(message);
    if (serialized === undefined) {
      return false;
    }

    const parsed = JSON.parse(serialized) as unknown;
    return (
      extensionToWebviewMessageSchema.safeParse(parsed).success ||
      webviewToExtensionMessageSchema.safeParse(parsed).success
    );
  } catch {
    return false;
  }
}

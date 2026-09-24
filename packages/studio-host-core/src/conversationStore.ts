import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { containedLibraryPath } from "./studioLibrary.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CONVERSATIONS = 50;
const SECRET_KEYS = new Set(["key", "apikey", "api_key", "authorization", "token", "secret"]);

export interface StoredConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StoredConversation {
  id: string;
  projectId: string;
  title: string;
  modelId: string;
  updatedAt: string;
  messages: StoredConversationMessage[];
}

export function conversationRecord(value: unknown): StoredConversation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => SECRET_KEYS.has(key.toLowerCase()))) return null;
  if (typeof record.id !== "string" || !ID.test(record.id)) return null;
  if (typeof record.projectId !== "string" || !ID.test(record.projectId)) return null;
  if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 120) return null;
  if (typeof record.modelId !== "string" || record.modelId.length > 200) return null;
  if (typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) return null;
  if (!Array.isArray(record.messages) || record.messages.length > 200) return null;
  const messages: StoredConversationMessage[] = [];
  for (const message of record.messages) {
    if (!message || typeof message !== "object") return null;
    const item = message as Record<string, unknown>;
    if (
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      item.content.length > 12_000
    ) {
      return null;
    }
    if (Object.keys(item).some((key) => SECRET_KEYS.has(key.toLowerCase()))) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title.trim(),
    modelId: record.modelId,
    updatedAt: record.updatedAt,
    messages
  };
}

export async function writeConversation(libraryRoot: string, conversation: StoredConversation): Promise<void> {
  const target = conversationPath(libraryRoot, conversation.projectId, conversation.id);
  if (!target) throw new Error("The conversation path leaves the Studio library.");
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${conversation.id}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(conversation));
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  await trimConversations(path.dirname(target));
}

export async function readConversation(
  libraryRoot: string,
  projectId: string,
  id: string
): Promise<StoredConversation | null> {
  const target = conversationPath(libraryRoot, projectId, id);
  if (!target) return null;
  try {
    return conversationRecord(JSON.parse(await readFile(target, "utf8")));
  } catch {
    return null;
  }
}

export async function renameConversation(
  libraryRoot: string,
  projectId: string,
  id: string,
  title: string
): Promise<StoredConversation> {
  const current = await readConversation(libraryRoot, projectId, id);
  if (!current) throw new Error("That conversation is not in the library.");
  const next = conversationRecord({ ...current, title, updatedAt: new Date().toISOString() });
  if (!next) throw new Error("The conversation title is not valid.");
  await writeConversation(libraryRoot, next);
  return next;
}

export async function deleteConversation(libraryRoot: string, projectId: string, id: string): Promise<void> {
  const target = conversationPath(libraryRoot, projectId, id);
  if (!target) throw new Error("The conversation path leaves the Studio library.");
  await rm(target, { force: true });
}

function conversationPath(libraryRoot: string, projectId: string, id: string): string | null {
  if (!ID.test(projectId) || !ID.test(id)) return null;
  return containedLibraryPath(libraryRoot, path.join("conversations", projectId, `${id}.json`));
}

async function trimConversations(directory: string): Promise<void> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
  if (names.length <= MAX_CONVERSATIONS) return;
  const files = await Promise.all(
    names.map(async (name) => ({ name, mtime: (await stat(path.join(directory, name))).mtimeMs }))
  );
  files.sort((left, right) => left.mtime - right.mtime);
  for (const file of files.slice(0, files.length - MAX_CONVERSATIONS)) {
    await rm(path.join(directory, file.name), { force: true });
  }
}

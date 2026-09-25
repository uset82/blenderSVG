import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { conversationRecord, MAX_CONVERSATIONS, PROJECT_ID, type StoredConversation } from "./projectEnvelope.js";
import { containedLibraryPath } from "./studioLibrary.js";

export {
  conversationRecord,
  type StoredConversation,
  type StoredConversationMessage
} from "./projectEnvelope.js";

export type StoredConversationSummary = Pick<StoredConversation, "id" | "title" | "modelId" | "updatedAt">;

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

export async function listConversations(libraryRoot: string, projectId: string): Promise<StoredConversationSummary[]> {
  if (!PROJECT_ID.test(projectId)) return [];
  const directory = containedLibraryPath(libraryRoot, path.join("conversations", projectId));
  if (!directory) return [];
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const ids = names
    .filter((name) => name.endsWith(".json") && PROJECT_ID.test(name.slice(0, -5)))
    .map((name) => name.slice(0, -5));
  const records = await Promise.all(ids.map((id) => readConversation(libraryRoot, projectId, id)));
  return records
    .filter((record): record is StoredConversation => record !== null)
    .map(({ id, title, modelId, updatedAt }) => ({ id, title, modelId, updatedAt }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
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
  if (!PROJECT_ID.test(projectId) || !PROJECT_ID.test(id)) return null;
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

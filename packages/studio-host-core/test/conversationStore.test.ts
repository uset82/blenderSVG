import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  conversationRecord,
  deleteConversation,
  readConversation,
  renameConversation,
  writeConversation
} from "../src/conversationStore.js";

const projectId = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
const id = "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6";

describe("conversation store", () => {
  it("stores the model and messages and refuses a key field", async () => {
    const library = await mkdtemp(path.join(tmpdir(), "studio-conversations-"));
    const conversation = conversationRecord({
      id,
      projectId,
      title: "Landing",
      modelId: "openrouter/auto",
      updatedAt: "2026-09-24T07:00:00.000Z",
      messages: [{ role: "user", content: "Frame a page" }],
      key: "sk-or-secret"
    });
    expect(conversation).toBeNull();
    const clean = conversationRecord({
      id,
      projectId,
      title: "Landing",
      modelId: "openrouter/auto",
      updatedAt: "2026-09-24T07:00:00.000Z",
      messages: [{ role: "user", content: "Frame a page" }]
    });
    expect(clean?.modelId).toBe("openrouter/auto");
    if (!clean) return;
    await writeConversation(library, clean);
    const stored = await readConversation(library, projectId, id);
    expect(stored?.messages[0]?.content).toBe("Frame a page");
    expect(JSON.stringify(stored)).not.toContain("sk-or");
    const files = await readdir(path.join(library, "conversations", projectId));
    expect(files).toEqual([`${id}.json`]);
    const renamed = await renameConversation(library, projectId, id, "Board");
    expect(renamed.title).toBe("Board");
    await deleteConversation(library, projectId, id);
    expect(await readConversation(library, projectId, id)).toBeNull();
  });
});

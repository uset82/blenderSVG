import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-studio-e2e-"));
const library = path.join(temporaryRoot, "library");
mkdirSync(library, { recursive: true });
const staticRoot = path.join(root, "apps", "studio", "dist");
const launchToken = randomBytes(32).toString("hex");
const testKey = "sk-or-v1-e2e-local-0123456789abcdef";
const modelId = "openai/gpt-4o-mini";
let storedKey = null;
const keyring = {
  async get() {
    return storedKey;
  },
  async set(value) {
    storedKey = value;
  }
};

const providerRequest = async (input, init) => {
  const url = String(input);
  const authorization = new Headers(init?.headers).get("authorization");
  assert.equal(authorization, `Bearer ${testKey}`);
  if (url.endsWith("/key")) {
    return json({ data: { label: "Studio e2e key", is_management_key: false, limit_remaining: 10 } });
  }
  if (url.includes("/models/user?output_modalities=all")) {
    return json({
      data: [
        {
          id: modelId,
          name: "GPT 4o mini",
          architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          context_length: 128_000,
          pricing: { prompt: "0.00000015", completion: "0.0000006" },
          supported_parameters: ["tools"]
        }
      ]
    });
  }
  if (url.endsWith("/chat/completions")) {
    const tool = {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "callframe1",
                function: {
                  name: "create_frame",
                  arguments: JSON.stringify({ name: "Landing", width: 800, height: 600 })
                }
              }
            ]
          }
        }
      ]
    };
    const done = {
      choices: [{ delta: {}, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12, cost: 0.0001 }
    };
    const body = `data: ${JSON.stringify(tool)}\n\ndata: ${JSON.stringify(done)}\n\ndata: [DONE]\n\n`;
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  throw new Error(`Unexpected OpenRouter request: ${url}`);
};

function json(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

const server = await startStudioServer(0, staticRoot, launchToken, keyring, library, providerRequest);
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${origin}/?studioToken=${launchToken}`);
  await page.getByText("Recents").first().waitFor();
  await page.locator(".recents__button--primary").first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  const composer = page.locator("#studio-chat-composer");
  if ((await composer.count()) === 0) {
    await page.getByRole("button", { name: "Open conversation" }).click();
  }
  await composer.waitFor({ state: "attached" });
  await page.locator(".studio-windowbar summary[aria-label='Settings']").click();
  await page.locator('input[name="openrouter-key"]').waitFor();
  await page.locator('input[name="openrouter-key"]').fill(testKey);
  await page.locator('input[name="openrouter-key"]').press("Enter");
  await page.locator(".studio-agent__connection-message", { hasText: "OpenRouter key verified" }).waitFor({
    state: "attached",
    timeout: 15_000
  });
  await page.locator(".studio-windowbar summary[aria-label='Settings']").click();
  await page.locator("button.studio-agent__model-trigger").click();
  await page.locator(`[role="option"][data-model-id="${modelId}"]`).click({ timeout: 15_000 });
  await page.locator("button.studio-agent__chip", { hasText: "ask" }).click();
  await page.getByRole("menuitemradio", { name: /^build/ }).click();
  await page.locator("#studio-chat-composer").fill("Add a landing frame.");
  await page.getByRole("button", { name: "Review & send" }).click();
  await page.locator("#studio-consent-title").waitFor();
  await page.locator('[aria-labelledby="studio-consent-title"] button').first().click();
  await page.locator("#studio-outbound-title").waitFor();
  await page.getByRole("button", { name: "Send to OpenRouter" }).click();
  await page.getByRole("button", { name: "Approve and run" }).click({ timeout: 15_000 });
  const proposal = page.getByRole("region", { name: "Pending canvas changes" });
  await proposal.waitFor({ timeout: 15_000 });
  await proposal.getByText("Apply to keep · Reject to discard").waitFor();
  await page.getByText("Proposed", { exact: true }).waitFor();
  const agentCount = await page.locator(".studio-windowbar__count").innerText();
  if (agentCount !== "1") throw new Error(`Expected one agent session, saw ${agentCount}`);
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((button) => button.textContent === "Undo"),
    undefined,
    { timeout: 15_000 }
  );
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent === "Undo");
    button?.click();
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("button.studio-windowbar__labeled", { hasText: "Export" }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().length > 0, "export produced a file");
  console.log(`studio-e2e ok ${download.suggestedFilename()}`);
} catch (error) {
  const text = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  console.error(text.slice(0, 1500));
  throw error;
} finally {
  await browser.close();
  server.close();
}

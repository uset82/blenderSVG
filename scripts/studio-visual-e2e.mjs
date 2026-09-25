import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(root, ".codex-avatar", "previews", "studio-v2", "after");
const stateDir = path.join(outDir, "states");
const referenceDir = path.join(root, ".codex-avatar", "previews", "studio-v2", "reference");
mkdirSync(outDir, { recursive: true });
mkdirSync(stateDir, { recursive: true });
mkdirSync(referenceDir, { recursive: true });
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "kurva-studio-visual-"));
const library = path.join(temporaryRoot, "library");
mkdirSync(library, { recursive: true });
const launchToken = randomBytes(32).toString("hex");
const testKey = "sk-or-v1-visual-fixture-local-0123456789abcdef";
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
  if (authorization !== `Bearer ${testKey}`) throw new Error("Unexpected visual-fixture authorization.");
  if (url.endsWith("/key"))
    return json({ data: { label: "Visual fixture", is_management_key: false, limit_remaining: 10 } });
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
                id: "callvisual1",
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
  throw new Error(`Unexpected visual-fixture request: ${url}`);
};
const server = await startStudioServer(
  0,
  path.join(root, "apps", "studio", "dist"),
  launchToken,
  keyring,
  library,
  providerRequest
);
const address = server.address();
if (!address || typeof address === "string") throw new Error("Studio host did not bind.");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const viewports = [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
  [768, 900],
  [390, 844]
];
const themes = ["dark", "light", "contrast"];
const screens = [
  ["home", "#/"],
  ["settings", "#/settings"],
  ["connectors", "#/connectors"],
  ["editor", "#/p/visual"]
];
const references = [
  ["target-home", "docs/design/target-ui/Main.dc.html", 1440, 900],
  ["target-editor-empty", "docs/design/target-ui/Editor-Empty.dc.html", 1440, 900],
  ["target-editor-working", "docs/design/target-ui/Editor-Working.dc.html", 1440, 900],
  ["target-composer-menus", "docs/design/target-ui/Composer-Menus.dc.html", 1440, 900],
  ["target-vector-asset", "docs/design/target-ui/Vector-Asset.dc.html", 1440, 900],
  ["target-connectors", "docs/design/target-ui/Connectors.dc.html", 1440, 900],
  ["target-settings", "docs/design/target-ui/Settings-Models.dc.html", 1440, 900],
  ["target-editor-light", "docs/design/target-ui/Editor-Light.dc.html", 1440, 900],
  ["target-editor-mobile", "docs/design/target-ui/Editor-Mobile.dc.html", 390, 844],
  ["kurva-home", "docs/design/kurva/StudioHome.dc.html", 1440, 900]
];

function json(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

async function setStudioTheme(theme) {
  await page.waitForFunction(() => typeof window.__studioSetTheme === "function");
  await page.evaluate((next) => {
    window.__studioSetTheme?.(next);
  }, theme);
  await page.waitForFunction((next) => document.querySelector(".studio-app")?.getAttribute("data-theme") === next, theme);
}

async function captureState(name, width) {
  for (const theme of themes) {
    await setStudioTheme(theme);
    const file = path.join(stateDir, `editor-${name}-${theme}-${width}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
}

async function selectFixtureModel() {
  await page.locator("button.studio-agent__model-trigger").click();
  await page.locator(`[role="option"][data-model-id="${modelId}"]`).click({
    position: { x: 24, y: 24 },
    timeout: 15_000
  });
}

async function openVisualProject(width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => {
    location.hash = "#/";
  });
  await page.waitForFunction(() => location.hash === "#/");
  const category = width === 390 ? "Mobile app" : "Landing page";
  const categoryButton = page.getByRole("button", { name: category, exact: true });
  await categoryButton.waitFor({ state: "visible" });
  await categoryButton.click();
  await page.getByRole("button", { name: "New file" }).first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  await page.locator(".studio-canvas-content").waitFor({ state: "visible" });
}

async function captureInteractiveStates(width, height) {
  await openVisualProject(width, height);
  if (width > 700 && width < 1100) {
    await page.waitForFunction(() => document.querySelector(".studio-agent-sidebar") === null);
  } else if (width <= 700) {
    await page.waitForFunction(() => document.querySelector(".studio-agent-sidebar") !== null);
  }
  const layersTab = page.getByRole("tab", { name: "Layers" });
  if (!(await layersTab.isVisible())) {
    await page.locator(".studio-windowbar summary[aria-label='Agents']").click();
    await page.getByRole("button", { name: "Open conversation" }).click();
    await layersTab.waitFor({ state: "visible" });
  }

  await layersTab.click();
  await page.locator('[role="tabpanel"][aria-labelledby="studio-left-tab-layers"]').waitFor();
  await captureState("layers", width);
  await page.getByRole("tab", { name: "Agent" }).click();

  await page.getByRole("button", { name: "Add to the message" }).click();
  await page.locator("#studio-composer-plus").waitFor();
  await captureState("composer-context-menu", width);
  await page.getByRole("button", { name: "Add to the message" }).click();

  await page.locator(".studio-agent__mode button.studio-agent__chip").first().click();
  await page.locator("#studio-composer-mode").waitFor();
  await captureState("composer-mode-menu", width);
  await page.locator(".studio-agent__mode button.studio-agent__chip").first().click();

  await page.locator(".studio-agent__mode button.studio-agent__chip").nth(1).click();
  await page.locator("#studio-composer-variants").waitFor();
  await captureState("composer-variants-menu", width);
  await page.locator(".studio-agent__mode button.studio-agent__chip").nth(1).click();

  await page.locator("button.studio-agent__model-trigger").click();
  await page.locator("#studio-model-picker-popover").waitFor();
  await captureState("model-picker", width);
  await page.locator("button.studio-agent__model-trigger").click();

  await page.getByRole("button", { name: "Trace image locally" }).click();
  await page.getByRole("dialog", { name: "Vector asset" }).waitFor();
  await captureState("vector-dialog", width);
  await page.locator(".studio-vector-dialog__close").click();
  await page.getByRole("dialog", { name: "Vector asset" }).waitFor({ state: "detached" });
}

async function startWorkingAgent() {
  await openVisualProject(1440, 900);
  await selectFixtureModel();
  await page.locator("#studio-model-picker-popover").waitFor({ state: "detached" });
  await page.locator(".studio-agent__mode button.studio-agent__chip").first().click();
  await page.locator("#studio-composer-mode").waitFor();
  await page
    .locator("#studio-composer-mode [role='menuitemradio']")
    .filter({ hasText: /^build/ })
    .click();
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
}

async function connectVisualFixture() {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "New file" }).first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  await page.waitForFunction(
    () => document.querySelector(".studio-windowbar")?.textContent?.includes("Auto-saved") === true,
    undefined,
    { timeout: 15_000 }
  );

  const settingsDisclosure = page.locator(".studio-windowbar summary[aria-label='Settings']");
  await settingsDisclosure.click();
  await page.locator('input[name="openrouter-key"]').waitFor();
  await page.locator('input[name="openrouter-key"]').fill(testKey);
  await page.locator('input[name="openrouter-key"]').press("Enter");
  await page.locator(".studio-agent__connection-message", { hasText: "OpenRouter key verified" }).waitFor({
    state: "attached",
    timeout: 15_000
  });
  await settingsDisclosure.click();
  await page.evaluate(() => {
    location.hash = "#/";
  });
  await page.getByText("Recents").first().waitFor();
}

try {
  for (const [name, file, width, height] of references) {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(path.join(root, file)).href);
    const referenceFile = path.join(referenceDir, `${name}.png`);
    await page.screenshot({ path: referenceFile });
    console.log(referenceFile);
  }

  await page.goto(`http://127.0.0.1:${address.port}/?studioToken=${launchToken}&perf=1#/`);
  await page.getByText("Recents").first().waitFor();
  await connectVisualFixture();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const [screen, hash] of screens) {
      if (screen === "editor") {
        await openVisualProject(width, height);
      } else {
        await page.evaluate((next) => {
          location.hash = next;
        }, hash);
        await page.waitForTimeout(200);
      }
      if (screen === "editor") {
        await page.waitForFunction(
          () => document.querySelector(".studio-windowbar")?.textContent?.includes("Auto-saved") === true,
          undefined,
          { timeout: 15_000 }
        );
      }
      for (const theme of themes) {
        await setStudioTheme(theme);
        const file = path.join(outDir, `${screen}-${theme}-${width}.png`);
        await page.screenshot({ path: file });
        console.log(file);
        if (screen === "editor" && width === 390) {
          const layout = await page.evaluate(() => {
            const rect = (selector) => {
              const element = document.querySelector(selector);
              if (!(element instanceof HTMLElement)) return null;
              const bounds = element.getBoundingClientRect();
              return { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom };
            };
            const editor = window.__studioEditor;
            const frame = editor?.getCurrentPageShapes().find((shape) => shape.type === "frame");
            const bounds = frame ? editor.getShapePageBounds(frame.id) : null;
            const frameTopLeft = bounds ? editor.pageToScreen({ x: bounds.x, y: bounds.y }) : null;
            const frameBottomRight = bounds
              ? editor.pageToScreen({ x: bounds.x + bounds.w, y: bounds.y + bounds.h })
              : null;
            return {
              viewportWidth: window.innerWidth,
              documentWidth: document.documentElement.scrollWidth,
              canvas: rect(".studio-canvas-content"),
              frame:
                frameTopLeft && frameBottomRight
                  ? {
                      left: frameTopLeft.x,
                      top: frameTopLeft.y,
                      right: frameBottomRight.x,
                      bottom: frameBottomRight.y
                    }
                  : null,
              frameSize: frame ? { width: frame.props.w, height: frame.props.h } : null,
              header: rect(".studio-windowbar__left"),
              panel: rect(".studio-agent-sidebar, .studio-inspector"),
              toolbar: rect(".studio-toolbar"),
              messages: rect(".studio-agent__messages"),
              modelTrigger: rect(".studio-model-picker-anchor > button"),
              send: rect('.studio-agent__composer-actions [aria-label="Review & send"]'),
              emptyTitle: rect(".studio-agent__empty-title"),
              suggestions: [...document.querySelectorAll(".studio-agent__suggestions .studio-agent__chip")].map(
                (item) => {
                  const bounds = item.getBoundingClientRect();
                  return { top: bounds.top, bottom: bounds.bottom, height: bounds.height, visible: bounds.height > 0 };
                }
              ),
              composer: rect(".studio-agent-composer")
            };
          });
          if (
            !layout.canvas ||
            !layout.frame ||
            !layout.header ||
            !layout.panel ||
            !layout.toolbar ||
            !layout.messages ||
            !layout.modelTrigger ||
            !layout.send ||
            !layout.emptyTitle ||
            layout.suggestions.length === 0 ||
            !layout.composer
          ) {
            throw new Error(`Mobile editor layout is incomplete: ${JSON.stringify(layout)}`);
          }
          if (layout.frameSize?.width !== 390 || layout.frameSize?.height !== 844) {
            throw new Error(`Mobile editor should show a 390×844 artboard: ${JSON.stringify(layout.frameSize)}`);
          }
          if (layout.documentWidth > layout.viewportWidth) {
            throw new Error(`Mobile editor overflows horizontally: ${JSON.stringify(layout)}`);
          }
          if (layout.panel.x < 0 || layout.panel.right > layout.viewportWidth) {
            throw new Error(`Mobile panel escapes the viewport: ${JSON.stringify(layout)}`);
          }
          if (layout.toolbar.bottom > layout.panel.y) {
            throw new Error(`Mobile toolbar overlaps the bottom panel: ${JSON.stringify(layout)}`);
          }
          if (Math.abs(layout.send.y - layout.modelTrigger.y) > 8) {
            throw new Error(`Mobile send control is not aligned with the model selector: ${JSON.stringify(layout)}`);
          }
          if (
            layout.frame.left < layout.canvas.x ||
            layout.frame.top < layout.header.bottom ||
            layout.frame.right > layout.canvas.right ||
            layout.frame.bottom > layout.canvas.bottom
          ) {
            throw new Error(`Mobile frame is clipped by the canvas: ${JSON.stringify(layout)}`);
          }
          if (
            layout.emptyTitle.bottom > layout.composer.y ||
            layout.suggestions
              .slice(0, 3)
              .some(
                (suggestion) => !suggestion.visible || suggestion.height < 44 || suggestion.bottom > layout.composer.y
              )
          ) {
            throw new Error(`Mobile agent starter prompts are obscured by the composer: ${JSON.stringify(layout)}`);
          }
          if (
            layout.emptyTitle.top < layout.messages.y ||
            layout.emptyTitle.bottom > layout.messages.bottom ||
            layout.suggestions
              .slice(0, 3)
              .some((suggestion) => suggestion.top < layout.messages.y || suggestion.bottom > layout.messages.bottom)
          ) {
            throw new Error(`Mobile agent starter prompts are clipped by the message area: ${JSON.stringify(layout)}`);
          }
          if (layout.suggestions.length < 3) {
            throw new Error(`Mobile empty state is missing its suggested prompts: ${JSON.stringify(layout)}`);
          }
          if (layout.suggestions.filter((suggestion) => suggestion.visible).length !== 3) {
            throw new Error(`Mobile empty state should show exactly three starter prompts: ${JSON.stringify(layout)}`);
          }
        }
      }
    }
  }

  for (const [width, height] of viewports) {
    await captureInteractiveStates(width, height);
  }

  await startWorkingAgent();
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await captureState("working-agent", width);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporaryRoot, { recursive: true, force: true });
}

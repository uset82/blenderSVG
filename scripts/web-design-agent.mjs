// The design agent end to end in the web build, under the production CSP, with OpenRouter mocked:
// Home prompt → editor → Connect (PKCE) → consent once → the agent designs a landing page into the
// empty starter frame → "make the hero dark and add a mobile version" (a bad patch the model then
// fixes, and a 390 frame to the right) → one Undo reverts that reply, Redo restores it → a model
// without tools draws a cat from a fenced SVG block.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";
import { ROOT, startWebServer } from "./lib/webHarness.mjs";

const fixture = readFileSync(path.join(ROOT, "scripts", "fixtures", "design", "ceramics-desktop.html"), "utf8");
const PROMPT = "Design a landing page for a neighborhood ceramics studio";
const DESIGN_MODEL = { id: "kurva/designer", name: "Kurva Designer" };
const TEXT_MODEL = { id: "kurva/texter", name: "Kurva Texter" };
const CAT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>Gatito</title><g id="body"><ellipse cx="256" cy="330" rx="130" ry="100" fill="#e0a370"/></g><g id="head"><circle cx="256" cy="200" r="90" fill="#e0a370"/><path d="M186 150 L200 80 L236 130 Z M326 150 L312 80 L276 130 Z" fill="#c9844f"/></g><g id="eyes"><circle cx="226" cy="200" r="12" fill="#1d1a17"/><circle cx="286" cy="200" r="12" fill="#1d1a17"/><circle cx="230" cy="196" r="4" fill="#fff"/><circle cx="290" cy="196" r="4" fill="#fff"/></g></svg>';

const server = await startWebServer({ scratch: path.join(os.tmpdir(), "kurva-design-agent") });
const browser = await launchStudioBrowser();
const chatBodies = [];
const requests = [];
const consoleErrors = [];

try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  context.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await context.route("https://openrouter.ai/**", (route) => fulfill(route, server.origin));

  // 1. Home: type the prompt and send while OpenRouter is not connected yet.
  await page.goto(`${server.origin}/`);
  await page.getByRole("heading", { name: "Home" }).waitFor();
  await page.getByLabel("Describe what to design").fill(PROMPT);
  await page.getByRole("button", { name: "Open design in editor" }).click();
  await page.waitForURL(/#\/p\//);
  const projectHash = new URL(page.url()).hash;

  // 2. The panel keeps the message and offers Connect; the message survives the sign-in redirect.
  const connect = page.getByRole("button", { name: "Connect OpenRouter" });
  await connect.waitFor();
  assert.equal(await page.locator("#studio-chat-composer").inputValue(), PROMPT);
  await page.waitForFunction(() => Boolean(sessionStorage.getItem("kurva-pending-agent-send")));
  await connect.click({ noWaitAfter: true });
  await page.waitForURL((url) => url.hash === projectHash && !url.pathname.includes("oauth"), { timeout: 30_000 });

  // 3. Back in the editor: consent is asked once, then the message sends with no review dialog.
  const consent = page.getByRole("button", { name: "Agree and send" });
  await consent.waitFor({ timeout: 30_000 });
  const consentText = await page.getByRole("dialog", { name: "Before your first request" }).innerText();
  assert.match(consentText, /HTML of frames it opens or creates goes to the\s+model/);
  await consent.click();
  await page.getByText("I designed a warm landing page for Clay & Kiln").waitFor({ timeout: 30_000 });
  assert.equal(await page.locator("#studio-outbound-title").count(), 0, "no review dialog by default");

  const desktop = await waitForFrame(
    page,
    "Clay & Kiln — Desktop",
    (state) => state.heroBackground === "rgb(246, 241, 234)"
  );
  assert.equal(desktop.heroColumns, 2);
  const first = chatBodies[0];
  assert.equal(first.model, DESIGN_MODEL.id, "the default pick is the best design model");
  assert.equal(first.max_completion_tokens, 32_000, "the output budget comes from the catalog");
  assert.ok(first.tools.some((tool) => tool.function.name === "create_design_frame"));
  const system = String(first.messages[0].content);
  assert.match(system, /Design brief: Landing page/);
  assert.match(system, /, empty/);
  assert.doesNotMatch(system, /cannot change the canvas/);

  // 4. Iterate: the model reads the frame, sends a patch that does not match, reads the error,
  //    fixes it and adds a mobile frame to the right, all in one reply.
  await page.locator("#studio-chat-composer").fill("make the hero dark and add a mobile version");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText("The hero is dark now, and there is a mobile version").waitFor({ timeout: 30_000 });
  await waitForFrame(page, "Clay & Kiln — Desktop", (state) => state.heroBackground === "rgb(29, 26, 23)");
  const mobile = await waitForFrame(page, "Clay & Kiln — Mobile", (state) => state.heroColumns === 1);
  assert.ok(mobile.frameLeft > desktop.frameLeft, "the mobile frame sits to the right of the desktop frame");
  const correction = chatBodies.find((body) =>
    body.messages.some(
      (message) => message.role === "tool" && /the find text was not found/.test(String(message.content))
    )
  );
  assert.ok(correction, "the failed patch went back to the model as a tool result");

  // 5. One Undo reverts the whole reply (the patch and the mobile frame); Redo brings it back.
  // Give the canvas keyboard focus without a click (clicks wait for the moving canvas to settle).
  await page.locator(".tl-container").first().focus();
  await page.keyboard.press("ControlOrMeta+z");
  await page.locator('iframe[title="Clay & Kiln — Mobile"]').waitFor({ state: "detached" });
  await waitForFrame(page, "Clay & Kiln — Desktop", (state) => state.heroBackground === "rgb(246, 241, 234)");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await waitForFrame(page, "Clay & Kiln — Mobile", (state) => state.heroColumns === 1);
  await waitForFrame(page, "Clay & Kiln — Desktop", (state) => state.heroBackground === "rgb(29, 26, 23)");

  // 6. A model without tool support still designs: its fenced SVG lands on the canvas as a drawing.
  await page.locator("button.studio-agent__model-trigger").click();
  await page.locator(`[role="option"][data-model-id="${TEXT_MODEL.id}"]`).click();
  await page.locator("#studio-chat-composer").fill("dibuja un gato");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/Placed the drawing “Gatito” on the canvas/).waitFor({ timeout: 30_000 });
  await page.locator('.tl-shape[data-shape-type="vector-studio"]').first().waitFor({ state: "attached" });
  const textOnly = chatBodies.at(-1);
  assert.equal(textOnly.model, TEXT_MODEL.id);
  assert.equal(textOnly.tools, undefined, "no tools are sent to a model without them");
  assert.match(String(textOnly.messages[0].content), /```svg/);

  // 7. Every tool call was answered, and nothing left the page except OpenRouter.
  for (const body of chatBodies) {
    const answered = new Set(body.messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id));
    for (const message of body.messages.filter((m) => m.role === "assistant" && m.tool_calls)) {
      for (const call of message.tool_calls) assert.ok(answered.has(call.id), `tool call ${call.id} was answered`);
    }
  }
  const violations = await page.evaluate(() => window.__kurvaCspViolations ?? []);
  const origins = [...new Set(requests.filter((url) => url.startsWith("http")).map((url) => new URL(url).origin))];
  const summary = { chatRequests: chatBodies.length, origins, violations, consoleErrors };
  console.log(JSON.stringify(summary, null, 2));
  assert.deepEqual(violations, [], "the journey must not trigger CSP violations");
  assert.deepEqual(
    origins.filter((origin) => origin !== server.origin && origin !== "https://openrouter.ai"),
    [],
    "only the page and OpenRouter are contacted"
  );
  assert.equal(chatBodies.length, 7);
  console.log(`web-design-agent ok ${await browser.version()}`);
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  const panel = page
    ? await page
        .locator(".studio-agent")
        .first()
        .innerText()
        .catch(() => "")
    : "";
  if (page && process.env.KURVA_AGENT_SHOT)
    await page.screenshot({ path: process.env.KURVA_AGENT_SHOT }).catch(() => undefined);
  console.error(
    JSON.stringify(
      {
        chatRequests: chatBodies.length,
        lastModel: chatBodies.at(-1)?.model,
        consoleErrors,
        url: page?.url(),
        panel: panel.slice(-1_500)
      },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser.close();
  await server.close();
}

/** Reads a design frame through the page, the way the app reaches it. */
function readFrame(page, title) {
  return page.evaluate((frameTitle) => {
    const iframe = document.querySelector(`iframe[title="${frameTitle}"]`);
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc?.body || !win) return { found: false };
    const css = (selector, property) => {
      const element = doc.querySelector(selector);
      return element ? win.getComputedStyle(element).getPropertyValue(property) : "";
    };
    const columns = css(".hero", "grid-template-columns");
    return {
      found: true,
      rendered: css("body", "margin-top") !== "",
      heroBackground: css(".hero", "background-color"),
      heroColumns: columns ? columns.trim().split(/\s+/).length : 0,
      frameLeft: iframe.getBoundingClientRect().left
    };
  }, title);
}

async function waitForFrame(page, title, ready, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let state;
  while (Date.now() < deadline) {
    state = await readFrame(page, title);
    if (state.found && state.rendered && ready(state)) return state;
    // Bring the frame on screen; tldraw hides off-screen shapes.
    if (state.found && !state.rendered) {
      await page.evaluate((frameTitle) => {
        document.querySelector(`iframe[title="${frameTitle}"]`)?.scrollIntoView();
      }, title);
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`${title} did not reach the expected state: ${JSON.stringify(state)}`);
}

// ---- OpenRouter mock ------------------------------------------------------------------------------

function sse(round) {
  const events = [];
  if (round.text) events.push({ choices: [{ delta: { content: round.text } }] });
  for (const [index, call] of (round.calls ?? []).entries()) {
    events.push({
      choices: [{ delta: { tool_calls: [{ index, id: call.id, function: { name: call.name, arguments: "" } }] } }]
    });
    for (let offset = 0; offset < call.arguments.length; offset += 4_000) {
      events.push({
        choices: [
          { delta: { tool_calls: [{ index, function: { arguments: call.arguments.slice(offset, offset + 4_000) } }] } }
        ]
      });
    }
  }
  events.push({ choices: [{ delta: {}, finish_reason: round.calls?.length ? "tool_calls" : "stop" }] });
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

function frameId(system, pattern) {
  const match = pattern.exec(system);
  assert.ok(match?.[1], `the canvas context lists ${pattern}: ${system.slice(-800)}`);
  return match[1];
}

/** The scripted model: each request gets the next reply, built from what the request carries. */
function nextReply(body) {
  const step = chatBodies.length - 1;
  const system = String(body.messages[0]?.content ?? "");
  const lastTool = [...body.messages].reverse().find((message) => message.role === "tool");
  if (step === 0) {
    const empty = frameId(system, /Frame "[^"]*" \((shape:[^)]+)\), \d+×\d+ at -?\d+, -?\d+, empty/);
    return {
      text: "Designing a warm landing page.",
      calls: [
        {
          id: "call-create",
          name: "create_design_frame",
          arguments: JSON.stringify({ name: "Clay & Kiln — Desktop", html: fixture, intoFrameId: empty })
        }
      ]
    };
  }
  if (step === 1) {
    assert.match(String(lastTool?.content), /"created":"design frame"/);
    return { text: "I designed a warm landing page for Clay & Kiln with a hero, classes and a visit section." };
  }
  const desktopId = () => frameId(system, /Design frame "Clay & Kiln — Desktop" \((shape:[^)]+)\)/);
  if (step === 2) {
    return {
      calls: [{ id: "call-read", name: "get_design_frame", arguments: JSON.stringify({ frameId: desktopId() }) }]
    };
  }
  if (step === 3) {
    assert.match(String(lastTool?.content), /class=\\"hero\\"|class="hero"/);
    return {
      calls: [
        {
          id: "call-bad-patch",
          name: "patch_design_frame",
          arguments: JSON.stringify({
            frameId: desktopId(),
            edits: [{ find: ".hero{background:var(--paper)}", replace: "x" }]
          })
        }
      ]
    };
  }
  if (step === 4) {
    assert.match(String(lastTool?.content), /the find text was not found/);
    return {
      text: "That did not match; using the exact rule.",
      calls: [
        {
          id: "call-patch",
          name: "patch_design_frame",
          arguments: JSON.stringify({
            frameId: desktopId(),
            edits: [
              { find: ".hero { background: var(--paper);", replace: ".hero { background: #1d1a17; color: #f6f1ea;" }
            ]
          })
        },
        {
          id: "call-mobile",
          name: "create_design_frame",
          arguments: JSON.stringify({
            name: "Clay & Kiln — Mobile",
            html: fixture,
            width: 390,
            placement: { relativeTo: desktopId(), side: "right" }
          })
        }
      ]
    };
  }
  if (step === 5) return { text: "The hero is dark now, and there is a mobile version to the right." };
  if (step === 6) return { text: `¡Claro! Aquí tienes un gatito:\n\n\`\`\`svg\n${CAT_SVG}\n\`\`\`\n` };
  return { text: "Done." };
}

function catalog() {
  const base = {
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    description: "Fixture",
    context_length: 200_000,
    benchmarks: { artificial_analysis: {} }
  };
  return {
    data: [
      {
        ...base,
        ...TEXT_MODEL,
        pricing: { prompt: "0", completion: "0" },
        supported_parameters: ["max_tokens"]
      },
      {
        ...base,
        ...DESIGN_MODEL,
        top_provider: { max_completion_tokens: 64_000 },
        pricing: { prompt: "0.000003", completion: "0.000015" },
        supported_parameters: ["max_completion_tokens", "tools", "tool_choice"],
        benchmarks: { artificial_analysis: {}, design_arena: [{ elo: 1320 }] }
      }
    ]
  };
}

async function fulfill(route, pageOrigin) {
  const request = route.request();
  const url = request.url();
  const requested = request.headers()["access-control-request-headers"];
  const headers = {
    "access-control-allow-origin": pageOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": requested || "authorization, content-type, accept, x-title",
    vary: "Origin"
  };
  try {
    if (request.method() === "OPTIONS") return await route.fulfill({ status: 204, headers });
    if (url.startsWith("https://openrouter.ai/auth")) {
      const callback = new URL(new URL(url).searchParams.get("callback_url") ?? "");
      callback.searchParams.set("code", "design-agent-code");
      return await route.fulfill({ status: 302, headers: { location: callback.toString() } });
    }
    if (url.startsWith("https://openrouter.ai/api/v1/auth/keys")) {
      return await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ key: "sk-or-v1-design-agent-key" })
      });
    }
    if (url.includes("/models")) {
      return await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(catalog())
      });
    }
    if (url.endsWith("/chat/completions")) {
      const body = request.postDataJSON();
      chatBodies.push(body);
      return await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "text/event-stream" },
        body: sse(nextReply(body))
      });
    }
    return await route.fulfill({ status: 404, headers, body: `unexpected ${url}` });
  } catch (error) {
    console.error("mock failed:", error);
    return await route.fulfill({ status: 500, headers, body: String(error) }).catch(() => undefined);
  }
}

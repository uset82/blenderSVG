// Proves a design frame renders agent HTML with its CSS under the production web CSP
// (style-src 'self', frame-src 'none'), and that the sanitizer keeps data: images while
// dropping scripts, external stylesheets, remote images and event handlers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchStudioBrowser } from "./launch-studio-browser.mjs";
import { ROOT, startWebServer } from "./lib/webHarness.mjs";

const fixture = readFileSync(path.join(ROOT, "scripts", "fixtures", "design", "ceramics-desktop.html"), "utf8");
const server = await startWebServer({ scratch: path.join(os.tmpdir(), "kurva-design-frame") });
const browser = await launchStudioBrowser();

try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const offOrigin = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(server.origin) && !url.startsWith("data:") && !url.startsWith("blob:") && url !== "about:blank")
      offOrigin.push(url);
  });
  await page.goto(`${server.origin}/?perf=1`);
  await page.getByRole("heading", { name: "Home" }).waitFor({ timeout: 30_000 });
  await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 30_000
  });

  const reveal = (id) =>
    page.evaluate((shapeId) => {
      const editor = window.__studioEditor;
      const bounds = editor.getShapePageBounds(shapeId);
      editor.zoomToBounds(bounds, { inset: 32, animation: { duration: 0 } });
    }, id);

  const messages = await page.evaluate(() => {
    window.__kurvaFrameMessages = [];
    window.addEventListener("message", (event) => window.__kurvaFrameMessages.push(String(event.data)));
    return true;
  });
  assert.ok(messages);

  const desktopFrameId = "shape:clay-kiln-desktop";
  const mobileFrameId = "shape:clay-kiln-mobile";
  await page.evaluate(
    ([html, desktopId, mobileId]) => {
      const editor = window.__studioEditor;
      const parentId = editor.getCurrentPageId();
      editor.createShape({
        id: desktopId,
        type: "design-frame",
        parentId,
        x: -4000,
        y: 0,
        props: { w: 1440, h: 2200, name: "Clay & Kiln — Desktop", html }
      });
      editor.createShape({
        id: mobileId,
        type: "design-frame",
        parentId,
        x: -2400,
        y: 0,
        props: { w: 390, h: 2600, name: "Clay & Kiln — Mobile", html }
      });
    },
    [fixture, desktopFrameId, mobileFrameId]
  );

  // tldraw hides off-screen shapes with display:none, and Firefox reports empty computed styles
  // inside a hidden iframe. Bring each frame on screen before reading what it renders.
  await reveal(desktopFrameId);
  const styles = await waitForFrame(page, "Clay & Kiln — Desktop", () => true);
  const culled = await page.evaluate(() => [...window.__studioEditor.getCulledShapes()]);
  await reveal(mobileFrameId);
  const mobileColumns = (await waitForFrame(page, "Clay & Kiln — Mobile", () => true)).heroColumns;

  if (process.env.KURVA_DESIGN_SHOT) {
    await page.evaluate(
      ([first, last]) => {
        const editor = window.__studioEditor;
        const a = editor.getShapePageBounds(first);
        const b = editor.getShapePageBounds(last);
        const box = { x: a.x, y: a.y, w: b.x + b.w - a.x, h: Math.max(a.h, b.h) * 0.5 };
        editor.zoomToBounds(box, { inset: 24, animation: { duration: 0 } });
      },
      [desktopFrameId, mobileFrameId]
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: process.env.KURVA_DESIGN_SHOT });
  }
  const violations = await page.evaluate(() => window.__kurvaCspViolations ?? []);
  const frameMessages = await page.evaluate(() => window.__kurvaFrameMessages ?? []);
  const summary = {
    styles,
    mobileColumns,
    culledWhileReading: culled,
    violations,
    frameMessages,
    offOrigin,
    consoleErrors
  };
  console.log(JSON.stringify(summary, null, 2));

  assert.equal(styles.heroBackground, "rgb(246, 241, 234)", "the <style> block did not apply");
  assert.equal(styles.heroColumns, 2, "desktop hero should be a two-column grid");
  assert.match(styles.headingFont, /Georgia|ui-serif/, "heading font should come from the CSS variable");
  assert.equal(styles.bodyMargin, "0px");
  assert.equal(styles.inlineCardBackground, "rgb(251, 244, 236)", 'the style="" attribute did not apply');
  assert.match(styles.tileGradient, /linear-gradient/);
  assert.equal(styles.scripts, 0, "scripts must be removed");
  assert.equal(styles.links, 0, "external stylesheets must be removed");
  assert.equal(styles.handlers, 0, "event handlers must be removed");
  assert.ok(
    styles.images.some((src) => src.startsWith("data:image/svg+xml")),
    "data: images must be kept"
  );
  assert.ok(!styles.images.some((src) => src.startsWith("http")), "remote images must be removed");
  assert.equal(styles.bodyClass, "page");
  assert.ok(styles.text);
  assert.equal(mobileColumns, 1, "a 390-wide frame should apply the mobile media query");
  assert.deepEqual(frameMessages, [], "frame scripts must not run");
  assert.deepEqual(offOrigin, [], "a design frame must not reach the network");
  assert.deepEqual(violations, [], "rendering a design frame must not trigger CSP violations");
  assert.deepEqual(
    consoleErrors.filter((text) => /Content Security Policy|Refused to/i.test(text)),
    [],
    "design frames must not trip the page CSP"
  );

  // The design tools against the real tldraw editor.
  const run = (name, args) =>
    page.evaluate(
      async ([toolName, toolArgs]) => {
        try {
          const outcome = await window.__kurvaRunCanvasTool(toolName, JSON.stringify(toolArgs));
          return { ok: true, value: JSON.parse(outcome.content) };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      [name, args]
    );
  const canvasSummary = await run("get_canvas_summary", {});
  assert.ok(canvasSummary.ok, canvasSummary.error);
  assert.equal(canvasSummary.value.designFrames.length, 2);
  const empty = canvasSummary.value.emptyFrames[0];
  assert.ok(empty, "a new file has an empty preset frame to fill");

  const created = await run("create_design_frame", {
    name: "Clay & Kiln — Tools",
    html: fixture,
    intoFrameId: empty.id
  });
  assert.ok(created.ok, created.error);
  assert.equal(created.value.replacedEmptyFrame, empty.id);
  assert.equal(created.value.width, empty.width);
  assert.equal(created.value.x, empty.x);
  assert.ok(created.value.height > 1200, `measured height ${created.value.height}`);
  assert.ok(
    created.value.removed.some((entry) => /script/.test(entry)),
    "removed content is reported"
  );
  const desktopId = created.value.id;
  const afterFill = await run("get_canvas_summary", {});
  assert.equal(afterFill.value.emptyFrames.length, 0, "the empty frame was replaced");

  const read = await run("get_design_frame", { frameId: desktopId });
  assert.ok(read.ok, read.error);
  assert.match(read.value.html, /class="hero"/);
  assert.doesNotMatch(read.value.html, /<script/i);

  const ambiguous = await run("patch_design_frame", {
    frameId: desktopId,
    edits: [{ find: "<article", replace: "<div" }]
  });
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.error, /matched \d+ places/);

  const patched = await run("patch_design_frame", {
    frameId: desktopId,
    edits: [{ find: ".hero { background: var(--paper);", replace: ".hero { background: #1d1a17; color: #f6f1ea;" }]
  });
  assert.ok(patched.ok, patched.error);
  await reveal(desktopId);
  await waitForFrame(page, "Clay & Kiln — Tools", (state) => state.heroBackground === "rgb(29, 26, 23)");

  const mobileTool = await run("create_design_frame", {
    name: "Clay & Kiln — Tools Mobile",
    html: fixture,
    width: 390,
    placement: { relativeTo: desktopId, side: "right" }
  });
  assert.ok(mobileTool.ok, mobileTool.error);
  assert.equal(mobileTool.value.width, 390);
  assert.ok(mobileTool.value.x >= created.value.x + created.value.width, "the mobile frame sits to the right");
  await reveal(mobileTool.value.id);
  await waitForFrame(page, "Clay & Kiln — Tools Mobile", (state) => state.heroColumns === 1);

  const cat = await run("insert_svg", {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><ellipse cx="100" cy="110" rx="60" ry="42" fill="#e0a370"/><circle cx="100" cy="62" r="38" fill="#e0a370"/><path d="M68 40 L74 8 L92 30 Z M132 40 L126 8 L108 30 Z" fill="#c9844f"/><circle cx="86" cy="60" r="5" fill="#1d1a17"/><circle cx="114" cy="60" r="5" fill="#1d1a17"/><script>alert(1)</script></svg>',
    width: 320,
    placement: { relativeTo: mobileTool.value.id, side: "right" }
  });
  assert.ok(cat.ok, cat.error);
  assert.equal(cat.value.width, 320);
  assert.equal(cat.value.height, 256);
  const catShape = await page.evaluate((id) => {
    const shape = window.__studioEditor.getShape(id);
    return { type: shape?.type, svg: shape?.props.lastSvg ?? "" };
  }, cat.value.id);
  assert.equal(catShape.type, "vector-studio");
  assert.doesNotMatch(catShape.svg, /<script/i);

  // Export HTML from the canvas menu downloads a standalone, script-free document.
  await reveal(desktopId);
  await page.evaluate((id) => {
    window.__studioEditor.select(id);
  }, desktopId);
  const canvasBox = await page.locator(".tl-canvas").boundingBox();
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { button: "right" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export HTML" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "clay-kiln-tools.html");
  const exported = readFileSync(await download.path(), "utf8");
  assert.match(exported, /^<!doctype html>/);
  assert.match(exported, /<meta charset="utf-8">/);
  assert.match(exported, /\.hero \{ background: #1d1a17;/);
  assert.doesNotMatch(exported, /<script|onclick|https:\/\//i);

  const renamed = await run("update_design_frame", { frameId: desktopId, name: "Clay & Kiln — Final" });
  assert.ok(renamed.ok, renamed.error);
  const missing = await run("get_design_frame", { frameId: "shape:nope" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /get_canvas_summary/);

  if (process.env.KURVA_DESIGN_TOOLS_SHOT) {
    await page.evaluate(
      ([first, last]) => {
        const editor = window.__studioEditor;
        const a = editor.getShapePageBounds(first);
        const b = editor.getShapePageBounds(last);
        const box = { x: a.x, y: a.y, w: b.x + b.w - a.x, h: Math.max(a.h, b.h) * 0.45 };
        editor.zoomToBounds(box, { inset: 24, animation: { duration: 0 } });
      },
      [desktopId, cat.value.id]
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: process.env.KURVA_DESIGN_TOOLS_SHOT });
  }
  console.log(`web-design-frame ok ${await browser.version()}`);
} finally {
  await browser.close();
  await server.close();
}

async function frameFor(page, title) {
  const handle = await page.waitForSelector(`iframe[title="${title}"]`, { state: "attached", timeout: 15_000 });
  const frame = await handle.contentFrame();
  assert.ok(frame, `${title} has no content frame`);
  return frame;
}

/**
 * Reads a design frame from the page through the iframe's same-origin contentWindow, the way the app
 * reaches it, so no test code has to run inside the script-less sandboxed frame.
 */
function readFrame(page, title) {
  return page.evaluate((frameTitle) => {
    const iframe = document.querySelector(`iframe[title="${frameTitle}"]`);
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc?.body || !win) return { found: Boolean(iframe), hasDocument: Boolean(doc?.body) };
    const css = (selector, property) => {
      const element = doc.querySelector(selector);
      return element ? win.getComputedStyle(element).getPropertyValue(property) : null;
    };
    const tracks = (value) => (value ? value.trim().split(/\s+/).length : 0);
    const shape = iframe.closest(".tl-shape");
    return {
      found: true,
      url: doc.URL,
      readyState: doc.readyState,
      shapeDisplay: shape ? getComputedStyle(shape).display : null,
      frameWidth: Math.round(iframe.getBoundingClientRect().width),
      adoptedSheets: doc.adoptedStyleSheets?.length ?? -1,
      rendered: doc.body.textContent.includes("Make something") && css("body", "margin-top") !== "",
      heroBackground: css(".hero", "background-color"),
      heroColumns: tracks(css(".hero", "grid-template-columns")),
      headingFont: css(".hero h1", "font-family"),
      bodyMargin: css("body", "margin-top"),
      inlineCardBackground: css(".card:nth-child(3)", "background-color"),
      tileGradient: css(".tile", "background-image"),
      scripts: doc.querySelectorAll("script").length,
      links: doc.querySelectorAll("link").length,
      handlers: doc.querySelectorAll("[onclick]").length,
      images: [...doc.querySelectorAll("img")].map((image) => image.getAttribute("src") ?? ""),
      bodyClass: doc.body.className,
      text: doc.body.textContent.includes("This week’s classes")
    };
  }, title);
}

/** Polls a frame until it has rendered and `ready(state)` holds; on timeout, fails with what it saw. */
async function waitForFrame(page, title, ready, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let state;
  while (Date.now() < deadline) {
    state = await readFrame(page, title);
    if (state.rendered && ready(state)) return state;
    await page.waitForTimeout(150);
  }
  const culled = await page.evaluate(() => [...window.__studioEditor.getCulledShapes()]);
  let insideFrame;
  try {
    const frame = await frameFor(page, title);
    insideFrame = await frame.evaluate(() => ({
      url: document.URL,
      textLength: document.body?.textContent?.length ?? 0,
      bodyMargin: getComputedStyle(document.body).marginTop
    }));
  } catch (error) {
    insideFrame = String(error);
  }
  throw new Error(`${title} did not render: ${JSON.stringify({ state, insideFrame, culled }, null, 2)}`);
}

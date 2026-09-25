import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const library = path.join(mkdtempSync(path.join(os.tmpdir(), "kurva-studio-perf-")), "library");
mkdirSync(library, { recursive: true });
const staticRoot = path.join(root, "apps", "studio", "dist");
const launchToken = randomBytes(32).toString("hex");
const server = await startStudioServer(0, staticRoot, launchToken, undefined, library);
const address = server.address();
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();

try {
  await page.goto(`http://127.0.0.1:${address.port}/?studioToken=${launchToken}&perf=1`);
  await page.locator(".recents__button--primary").first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor, undefined, {
    timeout: 20_000
  });
  const sample = await page.evaluate(async () => {
    const editor = window.__studioEditor;
    const shapes = [];
    for (let index = 0; index < 1000; index += 1) {
      shapes.push({
        type: "geo",
        x: (index % 40) * 48,
        y: Math.floor(index / 40) * 48,
        props: { geo: "rectangle", w: 36, h: 36 }
      });
    }
    editor.createShapes(shapes);
    const before = editor.getCurrentPageShapes().length;
    const measure = async (mode) => {
      const started = performance.now();
      let frames = 0;
      let error = "";
      const origin = editor.getCamera();
      await new Promise((resolve) => {
        const step = (now) => {
          try {
            const camera = editor.getCamera();
            if (mode === "pan") editor.setCamera({ ...camera, x: camera.x + 12, y: camera.y + 6 });
            else if (mode === "same") editor.setCamera(camera);
            else if (mode === "zoom") editor.setCamera({ ...origin, z: 0.8 + (frames % 20) / 40 });
          } catch (failure) {
            error = failure instanceof Error ? failure.message : String(failure);
            resolve();
            return;
          }
          frames += 1;
          if (now - started < 1000) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      editor.setCamera(origin);
      return {
        frames,
        elapsedMs: Math.round(performance.now() - started),
        fps: Math.round((frames * 1000) / Math.max(1, performance.now() - started)),
        error
      };
    };
    await measure("pan");
    await measure("zoom");
    const idle = await measure("idle");
    const unchanged = await measure("same");
    const pan = await measure("pan");
    const zoom = await measure("zoom");
    const memory = performance.memory
      ? { usedJsHeapSize: performance.memory.usedJSHeapSize, totalJsHeapSize: performance.memory.totalJSHeapSize }
      : null;
    return {
      shapes: before,
      selectionCount: editor.getSelectedShapeIds().length,
      culledShapeCount: editor.getCulledShapes().size,
      renderedDOMShapes: document.querySelectorAll(".tl-shape").length,
      idle,
      unchanged,
      pan,
      zoom,
      memory,
      machine: navigator.userAgent
    };
  });
  console.log(`studio-perf ${JSON.stringify(sample)}`);
  assert.ok(sample.shapes >= 1000, JSON.stringify(sample));
  await page.locator('summary[aria-label="Agents"]').click();
  await page.getByRole("button", { name: "Close conversation" }).last().click();
  const closedPanelCamera = await page.evaluate(async () => {
    const editor = window.__studioEditor;
    const origin = editor.getCamera();
    const measure = async (mode) => {
      let frames = 0;
      const started = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const camera = editor.getCamera();
          if (mode === "pan") editor.setCamera({ ...camera, x: camera.x + 12, y: camera.y + 6 });
          else editor.setCamera({ ...origin, z: 0.8 + (frames % 20) / 40 });
          frames += 1;
          if (now - started < 1000) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      editor.setCamera(origin);
      const elapsedMs = Math.round(performance.now() - started);
      return { frames, elapsedMs, fps: Math.round((frames * 1000) / elapsedMs) };
    };
    return { pan: await measure("pan"), zoom: await measure("zoom") };
  });
  console.log(`studio-perf-closed-panel ${JSON.stringify(closedPanelCamera)}`);
  await page.locator('summary[aria-label="Agents"]').click();
  await page.getByRole("button", { name: "Open conversation" }).click();
  await page.getByRole("tab", { name: "Agent" }).click();
  await page.locator(".studio-agent__messages").waitFor();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("kurva-seed-messages", { detail: { count: 500 } }));
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".studio-agent__messages article").length >= 500,
    undefined,
    { timeout: 20_000 }
  );
  const messages = await page.evaluate(async () => {
    const log = document.querySelector(".studio-agent__messages");
    const count = log?.querySelectorAll("article, .studio-agent__message").length ?? 0;
    const started = performance.now();
    let frames = 0;
    let slowFrames = 0;
    let last = started;
    await new Promise((resolve) => {
      const step = (now) => {
        const gap = now - last;
        if (gap > 32) slowFrames += 1;
        last = now;
        frames += 1;
        if (log) log.scrollTop += 80;
        if (now - started < 1000) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    return { count, frames, slowFrames, elapsedMs: Math.round(performance.now() - started) };
  });
  console.log(`studio-perf-messages ${JSON.stringify(messages)}`);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("kurva-stream-messages")));
  await page.waitForFunction(() => window.__studioStream, undefined, { timeout: 5_000 });
  const stream = await page.evaluate(() => window.__studioStream);
  console.log(`studio-perf-stream ${JSON.stringify(stream)}`);
} finally {
  await browser.close();
  server.close();
}

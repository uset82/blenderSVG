import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const library = path.join(mkdtempSync(path.join(os.tmpdir(), "kurva-studio-reopen-")), "library");
mkdirSync(library, { recursive: true });
const staticRoot = path.join(root, "apps", "studio", "dist");

async function launch() {
  const token = randomBytes(32).toString("hex");
  const server = await startStudioServer(0, staticRoot, token, undefined, library);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, token, origin: `http://127.0.0.1:${address.port}` };
}

function rectangleCount(snapshot) {
  const parsed = JSON.parse(snapshot);
  return Object.values(parsed.document?.store ?? {}).filter(
    (record) => record?.typeName === "shape" && record?.type === "geo" && record?.props?.geo === "rectangle"
  ).length;
}

const first = await launch();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
let projectId = "";
try {
  await page.goto(`${first.origin}/?studioToken=${first.token}&perf=1`);
  await page.getByRole("button", { name: "New file" }).first().click();
  await page.waitForFunction(() => location.hash.startsWith("#/p/") && window.__studioEditor);
  projectId = await page.evaluate(() => location.hash.slice("#/p/".length));
  console.log(`project ${projectId}`);
  page.on("request", (request) => {
    if (request.url().includes("/api/")) console.log(`request ${request.method()} ${request.url().split("?")[0]}`);
  });
  page.on("requestfailed", (request) => {
    console.log(`failed ${request.url().split("?")[0]} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/projects") && response.request().method() === "POST") {
      response
        .text()
        .then((body) => console.log(`save-response ${response.status()} ${body.slice(0, 400)}`))
        .catch(() => undefined);
    }
  });
  const created = await page.evaluate(() => {
    window.__studioEditor.createShape({
      type: "geo",
      x: 40,
      y: 40,
      props: { geo: "rectangle", w: 80, h: 40 }
    });
    let snapshotError = "";
    try {
      JSON.stringify(window.__studioEditor.getSnapshot());
    } catch (failure) {
      snapshotError = failure instanceof Error ? failure.message : String(failure);
    }
    return {
      geos: window.__studioEditor.getCurrentPageShapes().filter((shape) => shape.type === "geo").length,
      snapshotError
    };
  });
  console.log(JSON.stringify(created));
  assert.equal(created.geos, 1);
  try {
    await page.getByText("Auto-saved").waitFor({ timeout: 8_000 });
  } catch (error) {
    const probe = await page.evaluate(async (id) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          title: "Untitled",
          snapshot: JSON.stringify({ document: { schema: { schemaVersion: 1 }, store: {} } })
        })
      });
      return { status: response.status, body: (await response.text()).slice(0, 300) };
    }, projectId);
    console.log(`probe ${JSON.stringify(probe)}`);
    throw error;
  }
  const savedResponse = await fetch(`${first.origin}/api/projects/${projectId}?studioToken=${first.token}`);
  const savedBody = await savedResponse.json();
  assert.equal(rectangleCount(savedBody.snapshot), 1);
} finally {
  await browser.close();
  await new Promise((resolve) => first.server.close(resolve));
}

assert.ok(projectId);
const second = await launch();
try {
  const reopened = await fetch(`${second.origin}/api/projects/${projectId}?studioToken=${second.token}`);
  const body = await reopened.json();
  const count = rectangleCount(body.snapshot);
  console.log(
    `studio-reopen ${JSON.stringify({ projectId, status: reopened.status, title: body.title, rectangles: count })}`
  );
  assert.equal(reopened.status, 200);
  assert.equal(count, 1);
} finally {
  await new Promise((resolve) => second.server.close(resolve));
}

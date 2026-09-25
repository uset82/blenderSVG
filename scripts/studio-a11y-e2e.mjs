import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStudioServer } from "../apps/studio-server/src/server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const library = path.join(mkdtempSync(path.join(os.tmpdir(), "kurva-studio-a11y-")), "library");
mkdirSync(library, { recursive: true });
const staticRoot = path.join(root, "apps", "studio", "dist");
const launchToken = randomBytes(32).toString("hex");
const server = await startStudioServer(0, staticRoot, launchToken, undefined, library);
const address = server.address();
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: "reduce" });

try {
  await page.goto(`http://127.0.0.1:${address.port}/?studioToken=${launchToken}`);
  await page.getByText("Recents").first().waitFor();
  let opened = false;
  for (let step = 0; step < 40 && !opened; step += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => document.activeElement?.textContent ?? "");
    if (label.includes("New file")) {
      await page.keyboard.press("Enter");
      opened = true;
    }
  }
  assert.equal(opened, true, "keyboard focus reached New file");
  await page.waitForFunction(() => location.hash.startsWith("#/p/"));
  const metrics = await page.evaluate(() => {
    const button = document.querySelector("button.studio-windowbar__labeled");
    const box = button ? button.getBoundingClientRect() : null;
    const motion = getComputedStyle(document.querySelector(".studio-app") ?? document.body).animationDuration;
    const live = document.querySelector("[aria-live], [role='status']");
    const focus = getComputedStyle(document.activeElement ?? document.body).outlineStyle;
    return {
      targetHeight: box?.height ?? 0,
      targetWidth: box?.width ?? 0,
      motion,
      hasLiveRegion: Boolean(live),
      focus
    };
  });
  assert.ok(metrics.targetHeight >= 44 && metrics.targetWidth >= 44, JSON.stringify(metrics));
  assert.ok(
    metrics.motion === "0.01ms" || metrics.motion === "0s" || metrics.motion === "1e-05s",
    JSON.stringify(metrics)
  );
  assert.equal(metrics.hasLiveRegion, true);
  console.log(`studio-a11y ok ${JSON.stringify(metrics)}`);
} finally {
  await browser.close();
  server.close();
}

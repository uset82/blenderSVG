import { chromium } from "playwright";

/** Prefer installed Edge. Set KURVA_BROWSER=chromium to use Playwright's Chromium, which CI installs. */
export async function launchStudioBrowser() {
  if (process.env.KURVA_BROWSER === "chromium") return chromium.launch({ headless: true });
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

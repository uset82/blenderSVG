import { chromium, firefox, webkit } from "playwright";

/**
 * Prefer installed Edge. Override with KURVA_BROWSER=chromium|firefox|webkit.
 * CI installs Chromium; Firefox/WebKit use Playwright's browsers.
 */
export async function launchStudioBrowser() {
  const choice = (process.env.KURVA_BROWSER ?? "").toLowerCase();
  if (choice === "firefox") return firefox.launch({ headless: true });
  if (choice === "webkit") return webkit.launch({ headless: true });
  if (choice === "chromium") return chromium.launch({ headless: true });
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

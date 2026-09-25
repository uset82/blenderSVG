import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const after = path.join(root, ".codex-avatar", "previews", "studio-v2", "after");
const ref = path.join(root, ".codex-avatar", "previews", "studio-v2", "reference");
const review = path.join(after, "review");
fs.mkdirSync(review, { recursive: true });

const pairs = [
  ["Home", "target-home.png", "home-dark-1440.png"],
  ["Connectors", "target-connectors.png", "connectors-dark-1440.png"],
  ["Settings", "target-settings.png", "settings-dark-1440.png"],
  ["Editor empty", "target-editor-empty.png", "editor-dark-1440.png"],
  ["Working agent", "target-editor-working.png", "states/editor-working-agent-dark-1440.png"],
  ["Vector dialog", "target-vector-asset.png", "states/editor-vector-dialog-dark-1440.png"],
  ["Editor light", "target-editor-light.png", "editor-light-1440.png"],
  ["Mobile 390", "target-editor-mobile.png", "editor-dark-390.png"]
];

const rows = pairs
  .map(([label, targetName, liveName]) => {
    const target = pathToFileURL(path.join(ref, targetName)).href;
    const live = pathToFileURL(path.join(after, liveName)).href;
    return `<section><h2>${label}</h2><div class="pair"><figure><figcaption>Target</figcaption><img src="${target}" alt="${label} target"/></figure><figure><figcaption>Live</figcaption><img src="${live}" alt="${label} live"/></figure></div></section>`;
  })
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#eee;font:14px/1.4 system-ui}
h1{margin:16px 24px;font-size:18px}
h2{margin:0 0 8px;font-size:14px;font-weight:600}
section{padding:16px 24px;border-top:1px solid #333}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0;background:#1a1a1a;border:1px solid #333;border-radius:8px;overflow:hidden}
figcaption{padding:6px 10px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#aaa;border-bottom:1px solid #333}
img{display:block;width:100%;height:auto}
</style></head><body>
<h1>23.1 side-by-side · Target vs Live (Kurva tokens restyle colors by design)</h1>
${rows}
</body></html>`;

const pagePath = path.join(review, "side-by-side-review.html");
fs.writeFileSync(pagePath, html);

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(pagePath).href, { waitUntil: "networkidle" });
const out = path.join(review, "screens-1440-current.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${path.relative(root, out)}`);

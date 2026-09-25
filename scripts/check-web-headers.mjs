import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const caddy = readFileSync(path.join(root, "apps/studio/web/Caddyfile"), "utf8");
const csp = /Content-Security-Policy "([^"]+)"/.exec(caddy)?.[1] ?? "";
if (!csp.includes("connect-src 'self' https://openrouter.ai")) {
  throw new Error("Web CSP must allow only this origin and https://openrouter.ai.");
}
if (csp.includes("connect-src 'self' https://openrouter.ai http")) {
  throw new Error("Web CSP connect-src is wider than the app origin and openrouter.ai.");
}
if (!caddy.includes("query delete")) throw new Error("Web access logs must drop query strings.");
if (!caddy.includes("respond /health 200")) throw new Error("Web Caddyfile must answer /health.");
console.log("Web headers file OK.");

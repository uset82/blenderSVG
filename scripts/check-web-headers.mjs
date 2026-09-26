import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const caddy = readFileSync(path.join(root, "apps/studio/web/Caddyfile"), "utf8");
const csp = /Content-Security-Policy "([^"]+)"/.exec(caddy)?.[1] ?? "";
if (!csp.includes("connect-src 'self' https://openrouter.ai data:")) {
  throw new Error("Web CSP must allow this origin, https://openrouter.ai, and data: for the licensed canvas.");
}
if (csp.includes("connect-src 'self' https://openrouter.ai data: http")) {
  throw new Error("Web CSP connect-src is wider than the app origin, openrouter.ai, and data:.");
}
if (!caddy.includes("query delete")) throw new Error("Web access logs must drop query strings.");
if (!caddy.includes("handle /health") || !caddy.includes("respond 200")) {
  throw new Error("Web Caddyfile must answer /health before the static fallback.");
}
for (const required of [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "precompressed br gzip",
  "max-age=31536000, immutable",
  'Cache-Control "no-cache"'
]) {
  if (!caddy.includes(required)) throw new Error(`Web Caddyfile is missing ${required}.`);
}
if (caddy.includes("require-trusted-types-for")) {
  throw new Error("Trusted Types stay off until a licensed editor journey reports zero violations.");
}
if (caddy.includes("hide .*")) {
  throw new Error("A blanket dotfile hide would block /.well-known/security.txt.");
}
console.log("Web headers file OK.");

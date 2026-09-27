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
// Design frames render under the page CSP (see apps/studio/src/shapes/designFrameRenderer.ts), so the
// directives they depend on must match between the web edition and the /app/ block of the site.
const site = readFileSync(path.join(root, "apps/site/Caddyfile"), "utf8");
const siteAppCsp = /Content-Security-Policy "([^"]+)"/.exec(site)?.[1] ?? "";
const directive = (policy, name) =>
  policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? `${name} (missing)`;
for (const name of ["style-src", "img-src", "font-src", "frame-src", "script-src", "worker-src"]) {
  if (directive(csp, name) !== directive(siteAppCsp, name)) {
    throw new Error(`${name} differs between apps/studio/web/Caddyfile and apps/site/Caddyfile /app/.`);
  }
}
if (directive(csp, "style-src") !== "style-src 'self'") {
  throw new Error("style-src must stay 'self'; design frames apply CSS through the CSSOM instead.");
}
console.log("Web headers file OK.");

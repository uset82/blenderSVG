// Shared harness for web-edition journeys: serves apps/studio/dist-web over local HTTPS with the
// security headers copied from apps/studio/web/Caddyfile, so tests run under the production CSP.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WEB_DIST = path.join(ROOT, "apps", "studio", "dist-web");
export const WEB_CADDYFILE = path.join(ROOT, "apps", "studio", "web", "Caddyfile");

/** Reads the first `header { … }` block of a Caddyfile into a name → value map. */
export function headersFromCaddy(source) {
  const block = /header \{([\s\S]*?)\n\t\}/.exec(source)?.[1] ?? "";
  const headers = {};
  for (const line of block.split("\n")) {
    const match = /^\s*([A-Za-z0-9-]+)\s+"([^"]*)"/.exec(line);
    if (match?.[1] && match[2]) headers[match[1]] = match[2];
  }
  if (!headers["Content-Security-Policy"]) throw new Error("Caddyfile has no Content-Security-Policy.");
  return headers;
}

export function cspDirective(policy, name) {
  const part = policy
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name} `));
  return part?.slice(name.length).trim() ?? "";
}

/** A throwaway self-signed certificate for 127.0.0.1, cached in `directory`. */
export function ensureCertificate(directory) {
  mkdirSync(directory, { recursive: true });
  const keyPath = path.join(directory, "key.pem");
  const certPath = path.join(directory, "cert.pem");
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  }
  const configPath = path.join(directory, "openssl.cnf");
  writeFileSync(
    configPath,
    [
      "[req]",
      "distinguished_name = dn",
      "x509_extensions = v3_req",
      "prompt = no",
      "[dn]",
      "CN = 127.0.0.1",
      "[v3_req]",
      "subjectAltName = @alt",
      "basicConstraints = CA:FALSE",
      "keyUsage = digitalSignature, keyEncipherment",
      "extendedKeyUsage = serverAuth",
      "[alt]",
      "IP.1 = 127.0.0.1",
      "DNS.1 = localhost",
      ""
    ].join("\n")
  );
  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "2",
      "-nodes",
      "-config",
      configPath
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) throw new Error(`openssl failed: ${result.stderr || result.stdout}`);
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".map": "application/json"
};

function safeFile(rootDir, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relative) return path.join(rootDir, "index.html");
  const full = path.resolve(rootDir, relative);
  const rootResolved = path.resolve(rootDir);
  if (full !== rootResolved && !full.startsWith(`${rootResolved}${path.sep}`)) return null;
  return existsSync(full) && statSync(full).isFile() ? full : null;
}

const CSP_LISTENER =
  "window.__kurvaCspViolations=[];document.addEventListener('securitypolicyviolation',function(event){window.__kurvaCspViolations.push({directive:event.violatedDirective,blocked:event.blockedURI,sample:event.sample});});";

/**
 * Serves `dist` over HTTPS on 127.0.0.1 with the Caddyfile headers. Unknown non-asset paths fall back to
 * index.html like the production host. index.html gets a same-origin CSP violation listener injected.
 */
export async function startWebServer({ dist = WEB_DIST, caddyfile = WEB_CADDYFILE, scratch } = {}) {
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error(`Build the web edition first: ${path.relative(ROOT, dist)}/index.html is missing.`);
  }
  const headers = headersFromCaddy(readFileSync(caddyfile, "utf8"));
  const certificate = ensureCertificate(scratch ?? path.join(os.tmpdir(), "kurva-web-harness"));
  const server = createServer({ key: certificate.key, cert: certificate.cert }, (request, response) => {
    const url = new URL(request.url ?? "/", "https://127.0.0.1");
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    if (url.pathname === "/health") {
      response.writeHead(200);
      response.end();
      return;
    }
    if (url.pathname === "/__kurva_csp_listener.js") {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(CSP_LISTENER);
      return;
    }
    const filePath =
      safeFile(dist, url.pathname) ?? (url.pathname.startsWith("/assets/") ? null : path.join(dist, "index.html"));
    if (!filePath) {
      response.writeHead(404);
      response.end();
      return;
    }
    let body = readFileSync(filePath);
    if (path.basename(filePath) === "index.html") {
      body = Buffer.from(
        body.toString("utf8").replace("<head>", '<head><script src="/__kurva_csp_listener.js"></script>')
      );
    }
    response.setHeader(
      "Content-Type",
      CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
    );
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
  return { origin, headers, close: () => new Promise((resolve) => server.close(resolve)) };
}

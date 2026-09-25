import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import https, { createServer } from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import playwright from "playwright";
import { assertSvgPathCount } from "../apps/studio/src/components/vtracerPresets.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "studio", "dist-web");
const caddyPath = path.join(root, "apps", "studio", "web", "Caddyfile");
const scratch = path.resolve(process.env.KURVA_CSP_SCRATCH || path.join(os.tmpdir(), "kurva-csp-journey"));
const mockKey = "sk-or-v1-csp-journey-key";
const mockReply = "Kurva CSP stream payload";
const modelName = "CSP Text";

mkdirSync(scratch, { recursive: true });

const securityHeaders = headersFromCaddy(readFileSync(caddyPath, "utf8"));
const csp = securityHeaders["Content-Security-Policy"];
const connectSrc = cspDirective(csp, "connect-src");
const scriptSrc = cspDirective(csp, "script-src");
assert.equal(connectSrc, "'self' https://openrouter.ai");
assert.equal(scriptSrc, "'self' 'wasm-unsafe-eval'");

writePathGuardLog();
writeServeLog();
writeSafariLog();

if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("Build apps/studio/dist-web before running node scripts/web-csp-journey.mjs.");
}

const certificate = ensureCertificate(scratch);
const server = createServer({ key: certificate.key, cert: certificate.cert }, handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `https://127.0.0.1:${port}`;
const outcomes = [];

try {
  await assertServedHeaders(origin);
  for (const browserName of ["chromium", "firefox"]) {
    for (const run of [1, 2]) {
      outcomes.push(await runJourney(browserName, run, origin));
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

for (const browserName of ["chromium", "firefox"]) {
  const pair = outcomes.filter((item) => item.browserName === browserName);
  assert.equal(pair.length, 2, `${browserName} ran ${pair.length} times`);
  assert.deepEqual(pair[0].summary, pair[1].summary, `${browserName} runs differed`);
}
console.log(`Web CSP journey OK on ${origin}.`);

function writePathGuardLog() {
  const over = `<svg>${"<path d='M0'/>".repeat(20_001)}</svg>`;
  const atLimit = `<svg>${"<path d='M0'/>".repeat(20_000)}</svg>`;
  let rejected = "";
  try {
    assertSvgPathCount(over);
    rejected = "accepted 20001 paths";
  } catch (error) {
    rejected = error instanceof Error ? error.message : String(error);
  }
  const accepted = assertSvgPathCount(atLimit);
  const lines = [
    "command: node scripts/web-csp-journey.mjs",
    "function: assertSvgPathCount default limit 20000",
    `20001 paths: ${rejected}`,
    `20000 paths: returned ${accepted}`
  ];
  writeFileSync(path.join(scratch, "path-guard.log"), `${lines.join("\n")}\n`);
  assert.equal(rejected, "The trace has 20001 paths, above the 20000 path limit.");
  assert.equal(accepted, 20_000);
}

function writeServeLog() {
  const caddy = spawnSync("where.exe", ["caddy"], { encoding: "utf8" });
  const lines = [
    "Caddy was not used.",
    `where.exe caddy exit ${caddy.status}: ${(caddy.stdout || caddy.stderr || "not found").trim()}`,
    "The Caddyfile listens with auto_https off, and its CSP includes upgrade-insecure-requests.",
    "Serving that policy over plain HTTP makes the browser upgrade asset requests to HTTPS, so this run uses a local HTTPS static server.",
    "Every response copies the security header values from apps/studio/web/Caddyfile.",
    "GET /health returns 200. Hashed /assets use the immutable cache header. The shell files use no-cache."
  ];
  writeFileSync(path.join(scratch, "serve.log"), `${lines.join("\n")}\n`);
}

function writeSafariLog() {
  const probes = [
    ["where.exe", ["safari"]],
    ["where.exe", ["Safari"]]
  ];
  const lines = ["Safari probe on Windows. Playwright WebKit is not Safari and is not recorded as a W4.2 pass."];
  for (const [command, args] of probes) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    lines.push(`${command} ${args.join(" ")} exit ${result.status}: ${(result.stdout || result.stderr || "").trim()}`);
  }
  lines.push("Safari.exe was not found. W4.2 stays unchecked.");
  writeFileSync(path.join(scratch, "safari-launcher.log"), `${lines.join("\n")}\n`);
}

async function assertServedHeaders(pageOrigin) {
  const response = await httpsGet(pageOrigin);
  assert.equal(response.headers["content-security-policy"], csp);
  for (const [name, value] of Object.entries(securityHeaders)) {
    assert.equal(response.headers[name.toLowerCase()], value, name);
  }
  const health = await httpsGet(`${pageOrigin}/health`);
  assert.equal(health.status, 200);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      response.resume();
      resolve({ status: response.statusCode, headers: response.headers });
    });
    request.on("error", reject);
  });
}

async function runJourney(browserName, run, pageOrigin) {
  const exchangeBodies = [];
  const requests = [];
  const consoleNotes = [];
  const pageErrors = [];
  let browser;
  try {
    browser = await playwright[browserName].launch({
      headless: true,
      ...(browserName === "chromium" ? { args: ["--ignore-certificate-errors"] } : {})
    });
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    writeFileSync(path.join(scratch, "browser-launcher.log"), `${browserName} run ${run}\n${message}\n`);
    throw error;
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  context.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleNotes.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.route("https://openrouter.ai/**", (route) => fulfillOpenRouter(route, pageOrigin, exchangeBodies));
  try {
    await page.goto(`${pageOrigin}/`);
    await page.locator("[data-kurva-target='web']").waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "OpenRouter" }).waitFor();
    const callback = page.waitForURL((url) => url.pathname === "/oauth/openrouter");
    await page.getByRole("button", { name: "Connect", exact: true }).click({ noWaitAfter: true });
    await callback;
    await page.waitForFunction(() => window.location.hash === "#/settings", undefined, { timeout: 20_000 });
    assert.equal(exchangeBodies.length, 1);
    assert.equal(exchangeBodies[0].code, "csp-auth-code");
    assert.equal(exchangeBodies[0].code_challenge_method, "S256");
    assert.equal(typeof exchangeBodies[0].code_verifier, "string");
    await page.getByRole("button", { name: "Back to Home" }).click();
    await page.getByRole("heading", { name: "Home" }).waitFor();
    await page.locator(".recents__header").getByRole("button", { name: "New file" }).click();
    await page.waitForURL(/#\/p\//);
    await page.getByText("OpenRouter connected").waitFor();
    await page.getByRole("button", { name: "Choose model" }).click();
    const option = page.getByRole("option", { name: modelName });
    const catalogFailed = page
      .getByRole("dialog", { name: "Choose an OpenRouter model" })
      .getByRole("status")
      .filter({ hasText: "Could not reach OpenRouter" });
    if (!(await option.count())) {
      await page.getByRole("button", { name: "Refresh" }).click();
    }
    const catalogOutcome = await Promise.race([
      option.waitFor().then(() => "ready"),
      catalogFailed.waitFor().then(() => "failed")
    ]);
    if (catalogOutcome === "failed") {
      const fetchLog = await page.evaluate(() => window.__fetchLog ?? []);
      throw new Error(`catalog failed ${JSON.stringify(fetchLog)}`);
    }
    await option.click();
    await page.locator("#studio-chat-composer").fill("Hello from the CSP check");
    await page.getByRole("button", { name: "Review & send" }).click();
    const send = page.getByRole("button", { name: "Send to OpenRouter" });
    const consent = page.getByRole("button", { name: "Continue to review" });
    await consent.or(send).waitFor();
    if (await consent.count()) await consent.click();
    await send.click();
    await page
      .getByRole("article", { name: /^Assistant/ })
      .getByText(mockReply, { exact: true })
      .waitFor();

    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("heading", { name: "Home" }).waitFor();
    await page.getByRole("button", { name: /Image → SVG/ }).click();
    const dialog = page.getByRole("dialog", { name: "Vector asset" });
    await dialog.waitFor();
    const imageInput = dialog.getByLabel("Image to trace");
    await imageInput.setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: png(24, 24, [220, 40, 40]) });
    await dialog.getByRole("button", { name: "Trace image" }).click();
    await dialog.getByRole("status").filter({ hasText: "Trace ready" }).waitFor({ timeout: 60_000 });
    const wasmRequests = requests.filter((url) => url.startsWith(pageOrigin) && url.includes(".wasm"));
    const workerRequests = requests.filter((url) => url.startsWith(pageOrigin) && url.includes("traceImage.worker"));
    assert.ok(wasmRequests.length > 0, "the built trace did not request WASM");
    assert.ok(workerRequests.length > 0, "the built trace did not start the module worker");

    await imageInput.setInputFiles({ name: "noise.png", mimeType: "image/png", buffer: png(640, 480) });
    await dialog.getByRole("button", { name: "Trace image" }).click();
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    await cancel.waitFor();
    await page.waitForTimeout(250);
    await cancel.click();
    await dialog.getByRole("status").filter({ hasText: "Image tracing was cancelled." }).waitFor();

    const violations = await page.evaluate(() => window.__kurvaCspViolations ?? []);
    const origins = [...new Set(requests.map(requestOrigin))];
    const allowed = new Set([pageOrigin, "https://openrouter.ai"]);
    const unexpected = origins.filter((item) => !allowed.has(item));
    const sameOriginKey = requests.some((url) => url.startsWith(pageOrigin) && url.includes(mockKey));
    const summary = {
      exchange: "S256",
      reply: mockReply,
      violations: violations.length,
      origins: origins.sort(),
      wasm: wasmRequests.length > 0,
      worker: workerRequests.length > 0,
      cancelled: true,
      pageErrors: pageErrors.length
    };
    const journeyLog = [
      `browser: ${browserName} ${browser.version()} run ${run}`,
      `origin: ${pageOrigin}`,
      `exchange: code=${exchangeBodies[0].code} method=${exchangeBodies[0].code_challenge_method} verifierLength=${exchangeBodies[0].code_verifier.length}`,
      `stream text: ${mockReply}`,
      `securitypolicyviolation events: ${violations.length} ${JSON.stringify(violations)}`,
      `request origins: ${origins.sort().join(", ")}`,
      "request urls:",
      ...requests
    ];
    appendLog("csp-journey.log", journeyLog);
    appendLog("trace-csp.log", [
      `browser: ${browserName} ${browser.version()} run ${run}`,
      `origin: ${pageOrigin}`,
      `wasm requests: ${wasmRequests.length}`,
      `worker requests: ${workerRequests.length}`,
      "worker urls:",
      ...workerRequests,
      "result: compiled WASM, returned Trace ready, then Image tracing was cancelled."
    ]);
    assert.deepEqual(unexpected, [], `unexpected request origins: ${unexpected.join(", ")}`);
    assert.equal(violations.length, 0);
    assert.equal(sameOriginKey, false);
    assert.deepEqual(pageErrors, []);
    if (consoleNotes.length > 0) {
      appendLog("csp-journey.log", ["console errors:", ...consoleNotes]);
    }
    return { browserName, summary };
  } catch (error) {
    const target = path.join(scratch, `${browserName}-run-${run}-failure.png`);
    await page.screenshot({ path: target, fullPage: true }).catch(() => undefined);
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const currentUrl = page.url();
    const violations = await page.evaluate(() => window.__kurvaCspViolations ?? []).catch(() => []);
    writeFileSync(
      path.join(scratch, `${browserName}-run-${run}-failure.txt`),
      `${error instanceof Error ? error.stack : error}\nurl: ${currentUrl}\nexchange: ${JSON.stringify(exchangeBodies)}\nviolations: ${JSON.stringify(violations)}\nconsole: ${consoleNotes.join("\n")}\nrequests:\n${requests.filter((url) => url.includes("openrouter") || url.includes(".wasm") || url.includes("worker")).join("\n")}\n\n${body.slice(0, 1500)}\n`
    );
    throw error;
  } finally {
    await browser?.close();
  }
}

async function fulfillOpenRouter(route, pageOrigin, exchangeBodies) {
  const request = route.request();
  const url = request.url();
  try {
    await fulfillOpenRouterRequest(route, request, url, pageOrigin, exchangeBodies);
  } catch (error) {
    await route
      .fulfill({ status: 500, body: error instanceof Error ? error.message : String(error) })
      .catch(() => undefined);
  }
}

async function fulfillOpenRouterRequest(route, request, url, pageOrigin, exchangeBodies) {
  const headers = corsHeaders(pageOrigin, request);
  if (request.method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers });
    return;
  }
  if (url.startsWith("https://openrouter.ai/auth")) {
    const callback = new URL(new URL(url).searchParams.get("callback_url") ?? "");
    callback.searchParams.set("code", "csp-auth-code");
    await route.fulfill({ status: 302, headers: { location: callback.toString() } });
    return;
  }
  if (url.startsWith("https://openrouter.ai/api/v1/auth/keys")) {
    const body = request.postDataJSON();
    exchangeBodies.push(body);
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ key: mockKey })
    });
    return;
  }
  if (url.includes("/models/user")) {
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            id: "kurva/csp-text",
            name: modelName,
            architecture: { input_modalities: ["text"], output_modalities: ["text"] },
            description: "Fixture",
            context_length: 8000,
            pricing: { prompt: "0", completion: "0" },
            supported_parameters: ["max_tokens"]
          }
        ]
      })
    });
    return;
  }
  if (url.endsWith("/chat/completions")) {
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "text/event-stream" },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: mockReply } }] })}\n\ndata: [DONE]\n\n`
    });
    return;
  }
  await route.fulfill({ status: 404, headers, body: `unexpected ${url}` });
}

function corsHeaders(pageOrigin, request) {
  const requested = request.headers()["access-control-request-headers"];
  return {
    "access-control-allow-origin": pageOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": requested || "authorization, content-type, accept, x-title",
    vary: "Origin"
  };
}

function requestOrigin(url) {
  return new URL(url).origin;
}

function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", "https://127.0.0.1");
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  if (url.pathname.startsWith("/assets/")) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (["/", "/index.html", "/sw.js", "/sw-kill.js", "/manifest.webmanifest"].includes(url.pathname)) {
    response.setHeader("Cache-Control", "no-cache");
  }
  if (url.pathname === "/health") {
    response.writeHead(200);
    response.end();
    return;
  }
  if (url.pathname === "/__kurva_csp_listener.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(
      "window.__kurvaCspViolations=[];document.addEventListener('securitypolicyviolation',function(event){window.__kurvaCspViolations.push({directive:event.violatedDirective,blocked:event.blockedURI,sample:event.sample});});"
    );
    return;
  }
  const filePath = safeFile(dist, url.pathname);
  if (filePath && statSync(filePath).isFile()) {
    serveFile(response, filePath);
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    response.writeHead(404);
    response.end();
    return;
  }
  serveFile(response, path.join(dist, "index.html"));
}

function serveFile(response, filePath) {
  let body = readFileSync(filePath);
  if (path.basename(filePath) === "index.html") {
    const html = body.toString("utf8").replace("<head>", '<head><script src="/__kurva_csp_listener.js"></script>');
    body = Buffer.from(html);
  }
  response.setHeader("Content-Type", contentType(filePath));
  response.end(body);
}

function safeFile(rootDir, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relative) return path.join(rootDir, "index.html");
  const full = path.resolve(rootDir, relative);
  const rootResolved = path.resolve(rootDir);
  if (full !== rootResolved && !full.startsWith(`${rootResolved}${path.sep}`)) return null;
  return existsSync(full) ? full : null;
}

function contentType(filePath) {
  const types = {
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
  return types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function headersFromCaddy(source) {
  const block = /header \{([\s\S]*?)\n\t\}/.exec(source)?.[1] ?? "";
  const headers = {};
  for (const line of block.split("\n")) {
    const match = /^\s*([A-Za-z0-9-]+)\s+"([^"]*)"/.exec(line);
    if (match?.[1] && match[2]) headers[match[1]] = match[2];
  }
  if (!headers["Content-Security-Policy"]) throw new Error("Caddyfile has no Content-Security-Policy.");
  return headers;
}

function cspDirective(policy, name) {
  const part = policy
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name} `));
  return part?.slice(name.length).trim() ?? "";
}

function appendLog(name, lines) {
  const file = path.join(scratch, name);
  const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
  writeFileSync(file, `${previous}${lines.join("\n")}\n\n`);
}

function ensureCertificate(directory) {
  const keyPath = path.join(directory, "key.pem");
  const certPath = path.join(directory, "cert.pem");
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  }
  const configPath = path.join(directory, "openssl.cnf");
  writeFileSync(
    configPath,
    [
      "openssl_conf = openssl_init",
      "[openssl_init]",
      "providers = provider_sect",
      "[provider_sect]",
      "default = default_sect",
      "[default_sect]",
      "activate = 1",
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
    { env: { ...process.env, OPENSSL_CONF: configPath }, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`openssl failed: ${result.stderr || result.stdout}`);
  }
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

function png(width, height, pixel) {
  const rowBytes = width * 3 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * rowBytes;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3;
      const noise = (x * 13 + y * 17) & 255;
      raw[index] = pixel ? pixel[0] : noise;
      raw[index + 1] = pixel ? pixel[1] : (noise * 3) & 255;
      raw[index + 2] = pixel ? pixel[2] : (noise * 7) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

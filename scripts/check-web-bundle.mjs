import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "apps", "studio", "dist-web");
const manifestPath = path.join(dist, ".vite", "manifest.json");
const HOME_JS_GZIP_LIMIT = 400 * 1024;
const EDITOR_JS_GZIP_LIMIT = 1000 * 1024;
const REMOTE_FONT = /fonts\.googleapis|fonts\.gstatic|use\.typekit|fast\.fonts|cdn\.jsdelivr/i;
const DRAWING_FONT = /shantell|ibmplexsans|ibmplexserif/i;

if (!existsSync(manifestPath)) {
  throw new Error(`Web build manifest is missing: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entry = Object.entries(manifest).find(([, value]) => value.isEntry);
if (!entry) throw new Error("Web build manifest has no entry.");
const [entryId] = entry;

function walk(id, followDynamic, seen = new Set()) {
  if (seen.has(id) || !manifest[id]) return seen;
  seen.add(id);
  const item = manifest[id];
  for (const imported of item.imports ?? []) walk(imported, followDynamic, seen);
  if (followDynamic) {
    for (const imported of item.dynamicImports ?? []) walk(imported, followDynamic, seen);
  }
  return seen;
}

function gzipSize(relativeFile) {
  return gzipSync(readFileSync(path.join(dist, relativeFile))).length;
}

function jsFiles(ids) {
  const files = [];
  for (const id of ids) {
    const file = manifest[id]?.file;
    if (typeof file === "string" && file.endsWith(".js")) files.push(file);
  }
  return files;
}

function isTraceChunk(id, file) {
  return /traceImage\.worker/i.test(id) || /traceImage\.worker/i.test(file);
}

const homeIds = walk(entryId, false);
const homeFiles = jsFiles(homeIds);
const homeBytes = homeFiles.reduce((sum, file) => sum + gzipSize(file), 0);

const editorIds = walk(entryId, true);
const editorFiles = [];
for (const id of editorIds) {
  const file = manifest[id]?.file;
  if (typeof file !== "string" || !file.endsWith(".js") || isTraceChunk(id, file)) continue;
  editorFiles.push(file);
}
const editorBytes = [...new Set(editorFiles)].reduce((sum, file) => sum + gzipSize(file), 0);

const html = readFileSync(path.join(dist, "index.html"), "utf8");
if (!/src="\/assets\//.test(html)) throw new Error("Web index.html must load scripts from /assets/.");
if (/src="\.\/assets\//.test(html)) throw new Error("Web index.html still uses a relative asset base.");

const homeSource = homeFiles.map((file) => readFileSync(path.join(dist, file), "utf8")).join("\n");
if (homeSource.includes(".wasm")) {
  throw new Error("Home JS references the VTracer WASM. It must load on the first trace only.");
}
if (DRAWING_FONT.test(homeSource)) {
  throw new Error("Home JS references a tldraw drawing font. Those load with the editor.");
}
for (const face of [
  "fraunces-latin-full-normal",
  "hanken-grotesk-latin-400-normal",
  "ibm-plex-mono-latin-400-normal"
]) {
  if (!homeSource.includes(face)) throw new Error(`Home JS does not preload ${face}.`);
}

let wasmCount = 0;
const files = [];
function collect(directory) {
  for (const entryName of readdirSync(directory)) {
    const fullPath = path.join(directory, entryName);
    if (statSync(fullPath).isDirectory()) collect(fullPath);
    else files.push(fullPath);
  }
}
collect(dist);
for (const file of files) {
  if (file.endsWith(".wasm")) {
    wasmCount += 1;
    const relative = path.relative(dist, file).replaceAll("\\", "/");
    const referencedByHome = homeFiles.some((homeFile) =>
      readFileSync(path.join(dist, homeFile), "utf8").includes(path.basename(file))
    );
    if (referencedByHome) throw new Error(`Home JS references ${relative}.`);
  }
  if (file.endsWith(".html")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src = match[1] ?? "";
      if (/^https?:/i.test(src) || src.startsWith("//")) {
        throw new Error(`Third-party script in ${path.relative(dist, file)}: ${src}`);
      }
    }
  }
  if (/\.(html|css|js)$/.test(file)) {
    const source = readFileSync(file, "utf8");
    if (REMOTE_FONT.test(source)) throw new Error(`Remote font request in ${path.relative(dist, file)}.`);
    if (/cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|esm\.sh/i.test(source)) {
      throw new Error(`CDN script reference in ${path.relative(dist, file)}.`);
    }
    if (/from["']node:|require\(["']node:/.test(source)) {
      throw new Error(`Node import in the web bundle: ${path.relative(dist, file)}.`);
    }
  }
}
if (wasmCount !== 1) throw new Error(`Expected one VTracer WASM file, found ${wasmCount}.`);

if (homeBytes > HOME_JS_GZIP_LIMIT) {
  throw new Error(`Home initial JS is ${homeBytes} bytes gzip; the limit is ${HOME_JS_GZIP_LIMIT}.`);
}
if (editorBytes > EDITOR_JS_GZIP_LIMIT) {
  throw new Error(`Editor route JS is ${editorBytes} bytes gzip; the limit is ${EDITOR_JS_GZIP_LIMIT}.`);
}

console.log(`Web bundle OK: home ${homeBytes} bytes gzip, editor ${editorBytes} bytes gzip, wasm files ${wasmCount}.`);

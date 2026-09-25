import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);
const vtracerPackageEntry = require.resolve("@visioncortex/vtracer");
const vtracerWasmModule = resolve(dirname(vtracerPackageEntry), "pkg/vtracer_wasm.js");

function browserVtracerPlugin() {
  return {
    name: "browser-vtracer",
    enforce: "pre" as const,
    resolveId(source: string) {
      return source === "@visioncortex/vtracer/pkg/vtracer_wasm.js" ? vtracerWasmModule : null;
    },
    load(id: string) {
      const loadedPath = (id.split("?")[0] ?? "").replaceAll("\\", "/");
      if (loadedPath !== vtracerWasmModule.replaceAll("\\", "/")) return null;
      const code = readFileSync(vtracerWasmModule, "utf8");
      const withoutNodeExports = code
        .replace("exports.vectorize_bytes = vectorize_bytes;", "")
        .replace("exports.vectorize_rgba = vectorize_rgba;", "");
      const browserInit = `let wasm;
let wasmReady;
export function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasmUrl = new URL("./vtracer_wasm_bg.wasm", import.meta.url);
      const wasmBytes = await (await fetch(wasmUrl)).arrayBuffer();
      const wasmModule = await WebAssembly.compile(wasmBytes);
      const wasmInstance = await WebAssembly.instantiate(wasmModule, __wbg_get_imports());
      wasm = wasmInstance.exports;
      wasm.__wbindgen_start();
    })();
  }
  return wasmReady;
}
export { vectorize_bytes, vectorize_rgba };`;
      return withoutNodeExports.replace(
        /let WASM_VECTOR_LEN = 0;[\s\S]*$/,
        `let WASM_VECTOR_LEN = 0;\n${browserInit}\n`
      );
    }
  };
}

// tldraw stays out of manualChunks. Forcing it into one chunk makes Vite's preload
// helper a static import of that chunk, so Home downloads the editor.
function manualChunk(id: string): string | undefined {
  const normalized = id.replaceAll("\\", "/");
  if (normalized.includes("/node_modules/radix-ui/") || normalized.includes("/node_modules/@radix-ui/")) return "radix";
  if (
    normalized.includes("/node_modules/react-markdown/") ||
    normalized.includes("/node_modules/rehype-sanitize/") ||
    normalized.includes("/node_modules/remark-") ||
    normalized.includes("/node_modules/micromark") ||
    normalized.includes("/node_modules/mdast") ||
    normalized.includes("/node_modules/hast-") ||
    normalized.includes("/node_modules/unified/") ||
    normalized.includes("/node_modules/vfile")
  ) {
    return "markdown";
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  const web = mode === "web" || mode === "web-site";
  return {
    base: mode === "web-site" ? "/app/" : web ? "/" : "./",
    plugins: [browserVtracerPlugin() as Plugin, react()],
    resolve: {
      alias: [{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) }]
    },
    optimizeDeps: {
      // imports.vite.js uses Vite `?url` imports. Prebundling them drops the URLs.
      exclude: ["@tldraw/assets", "@visioncortex/vtracer"]
    },
    worker: {
      format: "es",
      plugins: () => [browserVtracerPlugin()]
    },
    build: {
      outDir: web ? "dist-web" : "dist",
      emptyOutDir: true,
      ...(web
        ? {
            manifest: true,
            rollupOptions: {
              output: {
                manualChunks: manualChunk
              }
            }
          }
        : {})
    },
    server: {
      port: 5174,
      host: "127.0.0.1"
    },
    preview: {
      host: "127.0.0.1"
    }
  };
});

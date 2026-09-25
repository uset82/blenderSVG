import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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

export default defineConfig({
  base: "./",
  plugins: [browserVtracerPlugin(), react()],
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
  server: {
    port: 5174,
    host: "127.0.0.1"
  },
  preview: {
    host: "127.0.0.1"
  }
});

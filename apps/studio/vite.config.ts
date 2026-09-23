import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

function browserVtracerPlugin() {
  return {
    name: "browser-vtracer",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      const normalized = id.replaceAll("\\", "/");
      if (!normalized.includes("/@visioncortex/vtracer/pkg/vtracer_wasm.js")) return null;
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
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  optimizeDeps: {
    // imports.vite.js uses Vite `?url` imports. Prebundling them drops the URLs.
    exclude: ["@tldraw/assets", "@visioncortex/vtracer"]
  },
  server: {
    port: 5174,
    host: "127.0.0.1"
  },
  preview: {
    host: "127.0.0.1"
  }
});

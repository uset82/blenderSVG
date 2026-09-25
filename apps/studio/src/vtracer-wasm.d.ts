declare module "@visioncortex/vtracer/pkg/vtracer_wasm.js" {
  export function ensureWasm(): Promise<void>;
  export function vectorize_rgba(rgba: Uint8Array, width: number, height: number, options: unknown): string;
}

export interface BrowserFeatures {
  secureContext: boolean;
  subtleCrypto: boolean;
  indexedDB: boolean;
  webAssembly: boolean;
  moduleWorker: boolean;
  webLocks: boolean;
  broadcastChannel: boolean;
}

export const SUPPORTED_BROWSER_COPY =
  "Kurva supports the latest two versions of Chrome, Edge, and Firefox, and Safari 17 or later on macOS and iOS.";

const FEATURE_LABELS: Record<keyof BrowserFeatures, string> = {
  secureContext: "a secure context (HTTPS)",
  subtleCrypto: "WebCrypto (crypto.subtle)",
  indexedDB: "IndexedDB",
  webAssembly: "WebAssembly",
  moduleWorker: "module workers",
  webLocks: "the Web Locks API",
  broadcastChannel: "BroadcastChannel"
};

/** Names the missing platform features. An empty list means the browser can run the web edition. */
export function browserSupportGaps(features: BrowserFeatures): string[] {
  return (Object.keys(FEATURE_LABELS) as Array<keyof BrowserFeatures>)
    .filter((key) => !features[key])
    .map((key) => FEATURE_LABELS[key]);
}

function supportsModuleWorker(): boolean {
  if (typeof Worker === "undefined" || typeof window === "undefined") return false;
  try {
    // A blob: probe fires a worker-src violation under the production CSP, which
    // allows only same-origin workers. Image tracing uses that same-origin kind.
    const worker = new Worker(new URL(`${import.meta.env.BASE_URL}module-worker-probe.js`, window.location.href), {
      type: "module"
    });
    worker.terminate();
    return true;
  } catch {
    return false;
  }
}

export function detectBrowserSupportGaps(): string[] {
  if (typeof window === "undefined") return ["a browser window"];
  return browserSupportGaps({
    secureContext: window.isSecureContext === true,
    subtleCrypto: typeof crypto !== "undefined" && typeof crypto.subtle?.digest === "function",
    indexedDB: typeof indexedDB !== "undefined",
    webAssembly: typeof WebAssembly?.compile === "function",
    moduleWorker: supportsModuleWorker(),
    webLocks: typeof navigator !== "undefined" && typeof navigator.locks?.request === "function",
    broadcastChannel: typeof BroadcastChannel === "function"
  });
}

import "./web/zodCsp.js";
import { OPENROUTER_CALLBACK_PATH } from "@codex-avatar-studio/studio-host-core/openRouterPkce";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { appPath } from "./web/appBase.js";
import { BrowserSupportNotice } from "./web/BrowserSupportNotice.js";
import { detectBrowserSupportGaps } from "./web/browserSupport.js";
import { isWebEdition } from "./web/kurvaTarget.js";
import { completeWebOpenRouterConnect } from "./web/openRouterConnect.js";
import { preloadHomeFonts } from "./web/preloadHomeFonts.js";
import "./styles/studio.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element in index.html");

preloadHomeFonts();
if (isWebEdition() && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}
// A tab opened before a deploy still references the previous build's chunks, which are
// gone. Reload once to pick up the new build instead of failing to open the editor.
const PRELOAD_RELOAD_KEY = "kurva-preload-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(window.sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    // Without sessionStorage there is no loop guard; let the error surface instead.
    return;
  }
  event.preventDefault();
  window.location.reload();
});
const browserGaps = isWebEdition() ? detectBrowserSupportGaps() : [];
const openRouterReturnPath = appPath(OPENROUTER_CALLBACK_PATH);
const openRouterReturn = isWebEdition() && window.location.pathname === openRouterReturnPath;

function OpenRouterReturn() {
  const [message, setMessage] = useState("Connecting to OpenRouter…");
  useEffect(() => {
    void completeWebOpenRouterConnect({
      search: window.location.search
    })
      .then((result) => {
        // Keep this replace on the callback path. Moving to the app root first turns the
        // return into a hash-only change, and the callback screen stays mounted.
        window.location.replace(`${window.location.origin}${appPath(result.returnHash)}`);
      })
      .catch((error: unknown) => {
        window.history.replaceState(null, "", openRouterReturnPath);
        setMessage(error instanceof Error ? error.message : "OpenRouter did not connect.");
      });
  }, []);
  return (
    <main>
      <p role="status">{message}</p>
    </main>
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {browserGaps.length > 0 ? (
      <BrowserSupportNotice gaps={browserGaps} />
    ) : openRouterReturn ? (
      <OpenRouterReturn />
    ) : (
      <App />
    )}
  </React.StrictMode>
);

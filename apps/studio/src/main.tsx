import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
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
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}
const browserGaps = isWebEdition() ? detectBrowserSupportGaps() : [];
const openRouterReturn = isWebEdition() && window.location.pathname === "/oauth/openrouter";

function OpenRouterReturn() {
  const [message, setMessage] = useState("Connecting to OpenRouter…");
  useEffect(() => {
    void completeWebOpenRouterConnect({
      search: window.location.search,
      replaceUrl: () => window.history.replaceState(null, "", "/")
    })
      .then((result) => {
        window.location.replace(`${window.location.origin}/${result.returnHash}`);
      })
      .catch((error: unknown) => {
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

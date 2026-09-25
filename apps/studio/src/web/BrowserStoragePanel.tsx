import { useEffect, useState } from "react";
import { downloadBrowserBackup, importBrowserBackup } from "./browserBackup.js";
import { clearBrowserLibrary } from "./browserProjects.js";

const STORAGE_PERSIST_KEY = "kurva-storage-persist";

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const agent = navigator.userAgent;
  return /safari/i.test(agent) && !/chrome|chromium|android|edg/i.test(agent);
}

export function clearBrowserPreferences(): void {
  const keys = Object.keys(window.localStorage);
  for (const key of keys) {
    if (key.startsWith("studio-") || key.startsWith("blendersvg-studio") || key.startsWith("codex-avatar-studio")) {
      window.localStorage.removeItem(key);
    }
  }
}

function readPersistResult(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PERSIST_KEY);
  } catch {
    return null;
  }
}

export async function rememberPersistentStorage(): Promise<string> {
  let message = "This browser does not offer persistent storage.";
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      message = granted
        ? "This browser agreed to keep Kurva’s data on this device."
        : "This browser may still remove Kurva’s data when space is low.";
    }
  } catch {
    message = "This browser may still remove Kurva’s data when space is low.";
  }
  try {
    sessionStorage.setItem(STORAGE_PERSIST_KEY, message);
  } catch {
    // Settings still explains where projects live when this write is blocked.
  }
  window.dispatchEvent(new Event("kurva-storage-persist"));
  return message;
}

export function BrowserStoragePanel() {
  const [usage, setUsage] = useState("Checking storage…");
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [persistResult, setPersistResult] = useState<string | null>(readPersistResult);
  useEffect(() => {
    const sync = () => setPersistResult(readPersistResult());
    window.addEventListener("kurva-storage-persist", sync);
    return () => window.removeEventListener("kurva-storage-persist", sync);
  }, []);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      const used = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const usedMb = (used / 1_000_000).toFixed(1);
      const quotaMb = quota ? (quota / 1_000_000).toFixed(0) : "unknown";
      setUsage(`${usedMb} MB of ${quotaMb} MB`);
      if (quota > 0 && used / quota >= 0.8)
        setWarning("Storage is over 80% full. Export a backup before the browser runs out of space.");
    });
  }, []);
  return (
    <section id="storage" className="studio-settings-card" aria-label="Storage on this device">
      <h2>Storage</h2>
      <p>Projects, images, and conversations stay in this browser. Kurva has no server.</p>
      <p>{usage}</p>
      {persistResult ? <p role="status">{persistResult}</p> : null}
      {warning ? <p role="status">{warning}</p> : null}
      {isSafari() ? (
        <p>Safari can remove this data after seven days without a visit unless Kurva is added to the Home Screen.</p>
      ) : null}
      <div className="studio-settings-card__actions">
        <button
          type="button"
          onClick={() => {
            void downloadBrowserBackup();
          }}
        >
          Export all projects
        </button>
        <label>
          Import backup
          <input
            type="file"
            accept=".zip,application/zip"
            aria-label="Import backup"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              void file
                .arrayBuffer()
                .then((buffer) =>
                  importBrowserBackup(new Uint8Array(buffer)).then((result) =>
                    setNotice(
                      `Imported ${result.imported}. ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} saved as copies.`
                    )
                  )
                );
            }}
          />
        </label>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (confirmation !== "delete") return;
          void clearBrowserLibrary().then(() => {
            clearBrowserPreferences();
            setConfirmation("");
            setNotice("Cleared all Kurva data on this device.");
          });
        }}
      >
        <label>
          Type delete to clear all data on this device
          <input
            value={confirmation}
            aria-label="Type delete to confirm"
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button type="submit" disabled={confirmation !== "delete"}>
          Clear all data
        </button>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}

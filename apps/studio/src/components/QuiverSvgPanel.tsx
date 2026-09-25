import { useEffect, useRef, useState } from "react";
import type { QuiverHostStatus } from "../projects/quiverClient.js";
import { generateQuiverSvg, getQuiverStatus, updateQuiverSettings } from "../projects/quiverClient.js";

export function QuiverSvgPanel({
  referenceImage,
  onGenerated,
  onStatus,
  statusMessage
}: {
  referenceImage: File | null;
  onGenerated: (svg: string) => void;
  onStatus: (message: string) => void;
  statusMessage: string;
}) {
  const [host, setHost] = useState<QuiverHostStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [key, setKey] = useState("");
  const [prompt, setPrompt] = useState(
    "Create a clean, friendly vector illustration with simple shapes and a limited color palette."
  );
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void getQuiverStatus()
      .then((status) => {
        if (active) {
          setHost(status);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "QuiverAI is unavailable here.");
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => setConsent(false), [prompt, referenceImage]);

  const update = async (action: "save" | "clear" | "enable" | "disable", value?: string) => {
    setPending(true);
    try {
      const next = await updateQuiverSettings(action, value);
      setHost(next);
      setLoadError("");
      if (action === "save") setKey("");
      if (action === "disable" || action === "clear") setConsent(false);
      onStatus(next.message);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not update QuiverAI settings.");
    } finally {
      setPending(false);
    }
  };

  const generate = async () => {
    if (!host?.enabled || !consent || generationBusy) return;
    if (!prompt.trim()) {
      onStatus("Enter a prompt before generating.");
      return;
    }
    if (referenceImage && !isSupportedRemoteReference(referenceImage)) {
      onStatus("QuiverAI references must be PNG or JPEG. Remove the image or choose a supported format.");
      return;
    }

    const abort = new AbortController();
    controller.current = abort;
    setGenerationBusy(true);
    setConsent(false);
    onStatus("Sending the reviewed prompt and selected reference to QuiverAI. Local tracing remains available.");
    try {
      const result = await generateQuiverSvg({
        model: "arrow-1.1",
        prompt: prompt.trim(),
        referenceImage,
        signal: abort.signal
      });
      if (abort.signal.aborted) return;
      onGenerated(result.svg);
      const total = result.usage?.totalTokens;
      onStatus(
        typeof total === "number"
          ? `Sanitized SVG ready · ${total.toLocaleString()} provider tokens reported. Any provider charge is billed to your QuiverAI account.`
          : "Sanitized SVG ready. The provider did not report usage for this response; check your QuiverAI account for any charge."
      );
    } catch (error) {
      onStatus(
        abort.signal.aborted
          ? "QuiverAI generation was cancelled."
          : error instanceof Error
            ? error.message
            : "QuiverAI generation failed."
      );
    } finally {
      if (controller.current === abort) controller.current = null;
      setGenerationBusy(false);
    }
  };

  const serviceUnavailable = loadError || (host && !host.available ? host.message : "");

  return (
    <section className="studio-quiver-panel" aria-label="Optional QuiverAI SVG generation">
      <div className="studio-quiver-panel__title">
        <div>
          <span className="studio-vector-dialog__eyebrow">OPTIONAL REMOTE ENGINE</span>
          <h3>Generate with QuiverAI</h3>
        </div>
        <span className="studio-quiver-panel__badge">Off by default</span>
      </div>

      {serviceUnavailable ? (
        <p className="studio-quiver-panel__notice" role="status">
          {serviceUnavailable} Local image tracing remains available.
        </p>
      ) : (
        <>
          <p className="studio-quiver-panel__notice">
            This optional service sends only the prompt below and a reference image you select. QuiverAI may charge your
            account; this Studio does not receive a reliable price quote before generation.
          </p>

          <label className="studio-vector-dialog__field">
            <span>Prompt</span>
            <textarea
              aria-label="QuiverAI generation prompt"
              maxLength={4_000}
              rows={5}
              value={prompt}
              disabled={!host?.available || generationBusy}
              onChange={(event) => setPrompt(event.currentTarget.value)}
            />
          </label>

          <label className="studio-vector-dialog__field">
            <span>Model</span>
            <select aria-label="QuiverAI model" value="arrow-1.1" disabled>
              <option value="arrow-1.1">Arrow 1.1</option>
            </select>
          </label>

          <details className="studio-quiver-panel__disclosure">
            <summary>Review exactly what will be sent</summary>
            <div>
              <strong>Prompt</strong>
              <pre>{prompt.trim() || "No prompt entered."}</pre>
              <strong>Reference image</strong>
              {referenceImage ? (
                <p>
                  {referenceImage.name} · {formatBytes(referenceImage.size)}. The image contents will be sent as base64
                  to QuiverAI. Its filename is not sent to the provider.
                </p>
              ) : (
                <p>No image is attached.</p>
              )}
              <p>
                Provider: api.quiver.ai. Your QuiverAI account may be billed; the cost is not available before sending.
              </p>
            </div>
          </details>

          {!host?.configured ? (
            <div className="studio-quiver-panel__key-entry">
              <label className="studio-vector-dialog__field">
                <span>QuiverAI API key</span>
                <input
                  aria-label="QuiverAI API key"
                  autoComplete="off"
                  type="password"
                  value={key}
                  onChange={(event) => setKey(event.currentTarget.value)}
                  disabled={pending || !host?.available}
                />
              </label>
              <button
                className="studio-agent__button studio-agent__button--small"
                type="button"
                disabled={pending || !host?.available || !key.trim()}
                onClick={() => void update("save", key)}
              >
                Save key on this computer
              </button>
              <small>
                The key is stored by the local Studio host and is never sent to your browser or QuiverAI as part of this
                save action.
              </small>
            </div>
          ) : (
            <div className="studio-quiver-panel__key-status">
              <span>API key stored in the host keychain</span>
              <button
                className="studio-agent__button studio-agent__button--small"
                type="button"
                disabled={pending || generationBusy}
                onClick={() => void update("clear")}
              >
                Remove key
              </button>
            </div>
          )}

          {host?.configured && (
            <label className="studio-quiver-panel__toggle">
              <input
                type="checkbox"
                checked={host.enabled}
                disabled={pending || generationBusy || !host.available}
                onChange={(event) => void update(event.currentTarget.checked ? "enable" : "disable")}
              />
              <span>Enable QuiverAI for this Studio session</span>
            </label>
          )}

          <label className="studio-quiver-panel__toggle studio-quiver-panel__consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={!host?.enabled || generationBusy || !prompt.trim()}
              onChange={(event) => setConsent(event.currentTarget.checked)}
            />
            <span>I reviewed the exact prompt and image disclosure above and agree to send it to QuiverAI.</span>
          </label>

          <div className="studio-quiver-panel__actions">
            {generationBusy ? (
              <button className="studio-agent__button" type="button" onClick={() => controller.current?.abort()}>
                Cancel generation
              </button>
            ) : (
              <button
                className="studio-agent__button studio-agent__button--primary"
                type="button"
                disabled={!host?.enabled || !consent || pending}
                onClick={() => void generate()}
              >
                Generate SVG
              </button>
            )}
          </div>
          <p className="studio-vector-dialog__status" role="status" aria-live="polite">
            {statusMessage}
          </p>
        </>
      )}
    </section>
  );
}

function isSupportedRemoteReference(file: File): boolean {
  return file.type === "image/png" || file.type === "image/jpeg" || /\.(?:png|jpe?g)$/i.test(file.name);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

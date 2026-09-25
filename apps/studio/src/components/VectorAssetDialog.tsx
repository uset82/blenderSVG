import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { assertLocalAssetFile } from "../projects/localAssets.js";
import { QuiverSvgPanel } from "./QuiverSvgPanel.js";
import { svgPathCount, VECTOR_PRESETS, type VectorPresetId, type VectorTraceSettings } from "./vtracerPresets.js";

export function VectorAssetDialog({
  onClose,
  onTrace,
  onInsert
}: {
  onClose: () => void;
  onTrace: (file: File, preset: VectorPresetId, signal: AbortSignal, tuning: VectorTraceSettings) => Promise<string>;
  onInsert: (svg: string, name: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState<VectorPresetId>("color-illustration");
  const [tuning, setTuning] = useState<VectorTraceSettings>(VECTOR_PRESETS["color-illustration"]);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [svg, setSvg] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose an image. Tracing stays on this computer.");
  const [busy, setBusy] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [split, setSplit] = useState(50);
  const [engine, setEngine] = useState<"local" | "quiver">("local");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selected = VECTOR_PRESETS[preset];
  const svgPreview = useMemo(() => (svg ? prepareSvgPreview(svg) : null), [svg]);
  const svgBytes = useMemo(() => (svg ? new TextEncoder().encode(svg).byteLength : 0), [svg]);

  useEffect(() => {
    if (!file) {
      setSourceUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const dismissOnBackdrop = (event: PointerEvent) => {
      if (event.target === overlay && !busy && !inserting) onClose();
    };
    overlay.addEventListener("pointerdown", dismissOnBackdrop);
    return () => overlay.removeEventListener("pointerdown", dismissOnBackdrop);
  }, [busy, inserting, onClose]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    try {
      assertLocalAssetFile(candidate, "image");
      setFile(candidate);
      setSvg(null);
      setSplit(50);
      setStatus(`${candidate.name} is ready. Tracing stays on this computer.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Choose a supported image file.";
      setStatus(`${reason} The current selection is unchanged.`);
    }
  };

  const trace = async () => {
    if (!file || busy) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setSvg(null);
    setStatus("Tracing on this computer. Nothing is uploaded.");
    try {
      const next = await onTrace(file, preset, abort.signal, tuning);
      if (abort.signal.aborted) {
        setStatus("Image tracing was cancelled.");
        return;
      }
      setSvg(next);
      setSplit(50);
      setStatus(
        `Trace ready · ${svgPathCount(next).toLocaleString()} paths · ${formatBytes(file.size)} source → ${formatBytes(new TextEncoder().encode(next).byteLength)} SVG. Adjust the comparison, then insert it on the canvas.`
      );
    } catch (error) {
      setStatus(
        abort.signal.aborted
          ? "Image tracing was cancelled."
          : error instanceof Error
            ? error.message
            : "The image could not be traced."
      );
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setBusy(false);
    }
  };

  const insert = async () => {
    if (!svg || inserting) return;
    setInserting(true);
    setStatus("Placing the sanitized SVG on the canvas.");
    try {
      await onInsert(svg, file?.name ?? "quiver-generated.svg");
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The SVG could not be inserted.");
    } finally {
      setInserting(false);
    }
  };

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <div ref={overlayRef} className="studio-outbound-overlay" role="presentation">
      <section
        className="studio-outbound-dialog studio-vector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-vector-title"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          if (busy) abortRef.current?.abort();
          else if (!inserting) close();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files.item(0) ?? undefined);
        }}
      >
        <header className="studio-vector-dialog__header">
          <span className="studio-vector-dialog__mark" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15.7 21.3a1 1 0 0 1-1.4 0l-1.6-1.6a1 1 0 0 1 0-1.4l5.6-5.6a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4z" />
              <path d="m18 13-1.4-6.9a1 1 0 0 0-.7-.8L3.2 2a1 1 0 0 0-1.2 1.2l3.3 12.7a1 1 0 0 0 .8.7L13 18" />
              <path d="m2.3 2.3 7.3 7.3" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </span>
          <div className="studio-vector-dialog__heading">
            <h2 id="studio-vector-title">Vector asset</h2>
            <p>
              {engine === "local"
                ? "Trace a picture into editable SVG. Runs on this computer; nothing is uploaded."
                : "Optional. A reviewed prompt and reference image can be sent to QuiverAI."}
            </p>
          </div>
          <span className="studio-vector-dialog__privacy">
            {engine === "local" ? "Runs on this computer" : "Optional remote generation"}
          </span>
          <button
            className="studio-vector-dialog__close"
            type="button"
            aria-label="Close"
            disabled={busy || inserting}
            onClick={close}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <nav className="studio-vector-dialog__engine-tabs" aria-label="SVG generation method">
          <button
            className={engine === "local" ? "is-active" : ""}
            type="button"
            aria-pressed={engine === "local"}
            disabled={busy || inserting}
            onClick={() => setEngine("local")}
          >
            Trace locally
          </button>
          <button
            className={engine === "quiver" ? "is-active" : ""}
            type="button"
            aria-pressed={engine === "quiver"}
            disabled={busy || inserting}
            onClick={() => setEngine("quiver")}
          >
            Generate with QuiverAI · optional
          </button>
        </nav>

        <div className="studio-vector-dialog__body">
          <div className="studio-vector-dialog__main">
            <input
              ref={inputRef}
              aria-label="Image to trace"
              className="studio-vector-dialog__file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => selectFile(event.currentTarget.files?.[0])}
              disabled={busy || inserting}
            />
            <section
              className={`studio-vector-dialog__preview${dragging ? " studio-vector-dialog__drop--active" : ""}`}
              aria-label="Source and traced SVG comparison"
            >
              {sourceUrl ? (
                <div
                  className="studio-vector-dialog__comparison"
                  style={{ "--studio-vector-split": `${split}%` } as CSSProperties}
                >
                  <img className="studio-vector-dialog__comparison-source" src={sourceUrl} alt="Original" />
                  {svgPreview && (
                    <>
                      <img
                        className="studio-vector-dialog__comparison-trace"
                        src={svgPreview.src}
                        alt="Sanitized vector trace"
                      />
                      <span className="studio-vector-dialog__comparison-divider" aria-hidden="true" />
                    </>
                  )}
                  {svgPreview ? (
                    <>
                      <span className="studio-vector-dialog__preview-label studio-vector-dialog__preview-label--before">
                        Before
                      </span>
                      <span className="studio-vector-dialog__preview-label studio-vector-dialog__preview-label--after">
                        After · SVG
                      </span>
                    </>
                  ) : (
                    <span className="studio-vector-dialog__preview-label studio-vector-dialog__preview-label--before">
                      Original image
                    </span>
                  )}
                </div>
              ) : svgPreview ? (
                <div className="studio-vector-dialog__generated-preview">
                  <img src={svgPreview.src} alt="Sanitized generated SVG" />
                  <span className="studio-vector-dialog__preview-label studio-vector-dialog__preview-label--after">
                    Generated · sanitized SVG
                  </span>
                </div>
              ) : (
                <div className="studio-vector-dialog__preview-empty">
                  <strong>Drop an image to begin</strong>
                  <span>PNG, JPEG, WebP or GIF · up to 8 MB</span>
                  <button
                    className="studio-agent__button"
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy || inserting}
                  >
                    Choose image
                  </button>
                </div>
              )}
              {svgPreview && sourceUrl && (
                <>
                  <label className="studio-vector-dialog__compare-control">
                    <span>Before</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={split}
                      aria-label="Before and after comparison"
                      aria-valuetext={`${split}% source image`}
                      onChange={(event) => setSplit(Number(event.currentTarget.value))}
                    />
                    <span>After</span>
                  </label>
                  <output className="studio-vector-dialog__metrics" aria-label="SVG metrics">
                    <span>{svgPathCount(svg ?? "").toLocaleString()} paths</span>
                    <span>{file ? `${formatBytes(file.size)} source` : "Generated from prompt"}</span>
                    <span>{formatBytes(svgBytes)} SVG</span>
                  </output>
                </>
              )}
            </section>
          </div>

          <aside className="studio-vector-dialog__controls">
            {engine === "quiver" ? (
              <QuiverSvgPanel
                referenceImage={file}
                onGenerated={(next) => {
                  setSvg(next);
                  setSplit(50);
                }}
                onStatus={setStatus}
                statusMessage={status}
              />
            ) : (
              <>
                <div className="studio-vector-dialog__field">
                  <span id="studio-trace-preset-label">Preset</span>
                  <div
                    className="studio-vector-dialog__presets"
                    role="radiogroup"
                    aria-labelledby="studio-trace-preset-label"
                  >
                    {(Object.keys(VECTOR_PRESETS) as VectorPresetId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={preset === id}
                        disabled={busy || inserting}
                        onClick={() => {
                          setPreset(id);
                          setTuning(VECTOR_PRESETS[id]);
                          setSvg(null);
                        }}
                      >
                        <span>{VECTOR_PRESETS[id].label}</span>
                        <span>
                          {id === "color-illustration"
                            ? "Keeps the color range"
                            : id === "clean-icon"
                              ? "Few flat shapes"
                              : id === "silhouette"
                                ? "One color, high contrast"
                                : "Square, hard edges"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="studio-vector-dialog__preset-summary">
                  {selected.mode} paths · {selected.hierarchical} layers ·{" "}
                  {selected.clustering === "bw" ? "2-color" : "color"} trace
                </p>

                <details className="studio-vector-dialog__advanced">
                  <summary>Advanced settings</summary>
                  <div className="studio-vector-dialog__setting-grid">
                    <NumberSetting
                      label="Color precision"
                      value={tuning.colorPrecision}
                      min={1}
                      max={10}
                      step={1}
                      disabled={busy || inserting}
                      onChange={(colorPrecision) => setTuning((current) => ({ ...current, colorPrecision }))}
                    />
                    <NumberSetting
                      label="Layer difference"
                      value={tuning.layerDifference}
                      min={0}
                      max={255}
                      step={1}
                      disabled={busy || inserting}
                      onChange={(layerDifference) => setTuning((current) => ({ ...current, layerDifference }))}
                    />
                    <NumberSetting
                      label="Speckle filter"
                      value={tuning.filterSpeckle}
                      min={0}
                      max={64}
                      step={1}
                      disabled={busy || inserting}
                      onChange={(filterSpeckle) => setTuning((current) => ({ ...current, filterSpeckle }))}
                    />
                    <NumberSetting
                      label="Corner threshold"
                      value={tuning.cornerThreshold}
                      min={0}
                      max={180}
                      step={1}
                      disabled={busy || inserting}
                      onChange={(cornerThreshold) => setTuning((current) => ({ ...current, cornerThreshold }))}
                    />
                    <NumberSetting
                      label="Length threshold"
                      value={tuning.lengthThreshold}
                      min={0}
                      max={20}
                      step={0.1}
                      disabled={busy || inserting}
                      onChange={(lengthThreshold) => setTuning((current) => ({ ...current, lengthThreshold }))}
                    />
                    <NumberSetting
                      label="Splice threshold"
                      value={tuning.spliceThreshold}
                      min={0}
                      max={180}
                      step={1}
                      disabled={busy || inserting}
                      onChange={(spliceThreshold) => setTuning((current) => ({ ...current, spliceThreshold }))}
                    />
                    <div className="studio-vector-dialog__field">
                      <span id="studio-trace-mode-label">Path mode</span>
                      <div
                        className="studio-vector-dialog__segment"
                        role="radiogroup"
                        aria-labelledby="studio-trace-mode-label"
                      >
                        {(["spline", "polygon", "pixel"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={tuning.mode === mode}
                            disabled={busy || inserting}
                            onClick={() => setTuning((current) => ({ ...current, mode }))}
                          >
                            {mode === "spline" ? "Spline" : mode === "polygon" ? "Polygon" : "Pixel"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="studio-vector-dialog__field">
                      <span id="studio-trace-layer-label">Layering</span>
                      <div
                        className="studio-vector-dialog__segment"
                        role="radiogroup"
                        aria-labelledby="studio-trace-layer-label"
                      >
                        {(["stacked", "cutout"] as const).map((hierarchical) => (
                          <button
                            key={hierarchical}
                            type="button"
                            role="radio"
                            aria-checked={tuning.hierarchical === hierarchical}
                            disabled={busy || inserting}
                            onClick={() => setTuning((current) => ({ ...current, hierarchical }))}
                          >
                            {hierarchical === "stacked" ? "Stacked" : "Cutout"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>

                <p className="studio-vector-dialog__status" role="status" aria-live="polite">
                  {status}
                </p>
              </>
            )}
          </aside>
        </div>

        <footer className="studio-outbound-dialog__footer studio-vector-dialog__footer">
          <span className="studio-vector-dialog__file">
            {file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "No image chosen"}
          </span>
          {file && (
            <button
              className="studio-agent__button"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy || inserting}
            >
              Replace image
            </button>
          )}
          {engine === "local" && busy && (
            <button className="studio-agent__button" type="button" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          )}
          {engine === "local" && (
            <button
              className="studio-agent__button"
              type="button"
              disabled={!file || busy || inserting}
              onClick={() => void trace()}
            >
              {svg ? "Trace again" : "Trace image"}
            </button>
          )}
          <button
            className="studio-agent__button studio-agent__button--primary"
            type="button"
            disabled={!svg || busy || inserting}
            title={
              svg ? "Place the sanitized SVG on the canvas" : "Trace an image or generate an SVG before inserting it."
            }
            onClick={() => void insert()}
          >
            {inserting ? "Inserting…" : "Insert on canvas"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="studio-vector-dialog__slider">
      <span>{label}</span>
      <span>{value}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{ "--studio-slider": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

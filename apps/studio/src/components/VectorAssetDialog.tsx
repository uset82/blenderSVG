import { useRef, useState } from "react";
import { VECTOR_PRESETS, svgPathCount, type VectorPresetId } from "./vtracerPresets.js";

export function VectorAssetDialog({
  onClose,
  onTrace,
  onInsert
}: {
  onClose: () => void;
  onTrace: (file: File, preset: VectorPresetId, signal: AbortSignal) => Promise<string>;
  onInsert: (svg: string, name: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState<VectorPresetId>("color-illustration");
  const [file, setFile] = useState<File | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose an image. Tracing stays on this computer.");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selected = VECTOR_PRESETS[preset];

  const trace = async () => {
    if (!file) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setSvg(null);
    setStatus("Tracing on this computer. Nothing is uploaded.");
    try {
      const next = await onTrace(file, preset, abort.signal);
      setSvg(next);
      setStatus(
        `${svgPathCount(next)} paths. Source ${file.size} bytes. SVG ${new TextEncoder().encode(next).length} bytes.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The image could not be traced.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-outbound-overlay">
      <section className="studio-outbound-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-vector-title">
        <h2 id="studio-vector-title">Vector asset</h2>
        <p role="status">{status}</p>
        <input
          aria-label="Image to trace"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setSvg(null);
          }}
        />
        <label>
          Preset
          <select
            aria-label="Trace preset"
            value={preset}
            onChange={(event) => {
              setPreset(event.target.value as VectorPresetId);
              setSvg(null);
            }}
          >
            {(Object.keys(VECTOR_PRESETS) as VectorPresetId[]).map((id) => (
              <option key={id} value={id}>
                {VECTOR_PRESETS[id].label}
              </option>
            ))}
          </select>
        </label>
        <p>
          Mode {selected.mode}. Speckle {selected.filterSpeckle}. Color precision {selected.colorPrecision}. Layering{" "}
          {selected.hierarchical}.
        </p>
        <p>Corner, length, and splice thresholds are not separate tracer fields yet. Speckle maps to path omission.</p>
        <button type="button" disabled={!file || busy} onClick={() => void trace()}>
          Trace
        </button>
        <button
          type="button"
          disabled={!busy}
          onClick={() => {
            abortRef.current?.abort();
            setStatus("Image tracing was cancelled.");
          }}
        >
          Cancel trace
        </button>
        <button
          type="button"
          disabled={!svg || !file || busy}
          title={svg ? "Place the traced SVG on the canvas" : "Trace an image before inserting it."}
          onClick={() => {
            if (!svg || !file) return;
            void onInsert(svg, file.name).then(onClose);
          }}
        >
          Insert
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  );
}

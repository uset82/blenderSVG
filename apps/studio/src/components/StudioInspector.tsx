import { GripHorizontal, X } from "lucide-react";
import React, { useEffect, useState } from "react";

export type GeometryProperty = "x" | "y" | "width" | "height";

export interface InspectedShape {
  id?: string;
  type: string;
  count: number;
  x: number | null;
  y: number | null;
  width?: number | null;
  height?: number | null;
  rotation: number | null;
  opacity: number | null;
  fill?: string | null;
  dash?: string | null;
  color?: string | null;
  frameColor?: string | null;
  radius?: number | null;
  supportsRadius?: boolean;
  font?: string | null;
  fontSize?: string | null;
  weight?: "regular" | "bold" | null;
  textAlign?: string | null;
}

export interface PageProperties {
  background: string;
  opacity: number;
  grid: boolean;
}

export interface StudioInspectorProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  selectedShape: InspectedShape | null;
  page: PageProperties;
  onUpdate: (property: GeometryProperty | "rotation" | "opacity" | "radius", value: number) => void;
  onPageChange: (page: PageProperties) => void;
  onFramePreset: (width: number, height: number) => void;
  onTextStyle: (property: "font" | "size" | "weight" | "textAlign", value: string) => void;
  onShapeStyle: (property: "fill" | "dash" | "color" | "frameColor", value: string) => void;
  onExport: () => void;
  onExportPage?: (format: "png" | "svg" | "json", scale: 1 | 2) => void;
  onExportFrame?: () => void;
  panelWidth: number;
  panelHeight: number;
}

export function StudioInspector({
  className,
  isOpen,
  onClose,
  selectedShape,
  page,
  onUpdate,
  onPageChange,
  onFramePreset,
  onTextStyle,
  onShapeStyle,
  onExport,
  onExportPage,
  onExportFrame,
  panelWidth,
  panelHeight
}: StudioInspectorProps) {
  const [pageFormat, setPageFormat] = useState<"png" | "svg" | "json">("png");
  const [pageScale, setPageScale] = useState<1 | 2>(2);
  if (!isOpen) return null;

  return (
    <aside
      className={className}
      id="studio-inspector"
      aria-label="Canvas inspector"
      style={
        {
          "--studio-panel-width": `${panelWidth}px`,
          "--studio-mobile-panel-size": `${panelHeight}px`
        } as React.CSSProperties
      }
    >
      <header className="studio-inspector__header">
        <div>
          <div className="studio-inspector__title">
            {selectedShape?.type === "frame" ? "Frame" : selectedShape ? "Selection" : "Page"}
          </div>
          {selectedShape && (
            <div className="studio-inspector__selection-count">
              {selectedShape.count === 1 ? "1 object selected" : `${selectedShape.count} objects selected`}
            </div>
          )}
        </div>
        <button className="studio-panel-close" type="button" aria-label="Close inspector" onClick={onClose}>
          <X size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      {selectedShape ? (
        <div className="studio-inspector__body">
          <div className="studio-inspector__section-title">Position and size</div>
          <div className="studio-inspector__geometry">
            <NumericProperty
              label="X"
              value={selectedShape.x}
              min={-1_000_000}
              max={1_000_000}
              onCommit={(value) => onUpdate("x", value)}
            />
            <NumericProperty
              label="Y"
              value={selectedShape.y}
              min={-1_000_000}
              max={1_000_000}
              onCommit={(value) => onUpdate("y", value)}
            />
            {selectedShape.width !== undefined && (
              <NumericProperty
                label="W"
                value={selectedShape.width}
                min={1}
                max={1_000_000}
                onCommit={(value) => onUpdate("width", value)}
              />
            )}
            {selectedShape.height !== undefined && (
              <NumericProperty
                label="H"
                value={selectedShape.height}
                min={1}
                max={1_000_000}
                onCommit={(value) => onUpdate("height", value)}
              />
            )}
            <NumericProperty
              label="Rotation"
              value={selectedShape.rotation === null ? null : Math.round((selectedShape.rotation * 180) / Math.PI)}
              min={-360}
              max={360}
              onCommit={(value) => onUpdate("rotation", (value * Math.PI) / 180)}
            />
            <NumericProperty
              label="Opacity"
              value={selectedShape.opacity === null ? null : Math.round(selectedShape.opacity * 100)}
              min={0}
              max={100}
              onCommit={(value) => onUpdate("opacity", value / 100)}
            />
          </div>
          {selectedShape.type === "frame" && (
            <>
              <div className="studio-inspector__section-title">Frame</div>
              <div className="studio-inspector__presets">
                {[
                  ["Desktop", 1440, 900],
                  ["Presentation", 1600, 900],
                  ["Tablet", 768, 1024],
                  ["Phone", 390, 844]
                ].map(([label, width, height]) => (
                  <button key={label} type="button" onClick={() => onFramePreset(Number(width), Number(height))}>
                    {label}
                  </button>
                ))}
              </div>
              <StyleSelect
                label="Fill"
                value={selectedShape.frameColor}
                options={SHAPE_COLORS}
                onChange={(value) => onShapeStyle("frameColor", value)}
              />
              <div className="studio-inspector__property-status">
                <span className="studio-inspector__status-dot" aria-hidden="true" />
                Content clipped to frame
              </div>
              {onExportFrame && (
                <button className="studio-inspector__export" type="button" onClick={onExportFrame}>
                  Export frame
                </button>
              )}
            </>
          )}
          {selectedShape.fill !== undefined && (
            <StyleSelect
              label="Fill"
              value={selectedShape.fill}
              options={["none", "semi", "solid", "pattern"]}
              onChange={(value) => onShapeStyle("fill", value)}
            />
          )}
          {selectedShape.dash !== undefined && (
            <StyleSelect
              label="Stroke style"
              value={selectedShape.dash}
              options={["draw", "solid", "dashed", "dotted"]}
              onChange={(value) => onShapeStyle("dash", value)}
            />
          )}
          {selectedShape.color !== undefined && selectedShape.type === "geo" && (
            <StyleSelect
              label="Stroke color"
              value={selectedShape.color}
              options={SHAPE_COLORS}
              onChange={(value) => onShapeStyle("color", value)}
            />
          )}
          {selectedShape.supportsRadius && (
            <NumericProperty
              label="Corner radius"
              value={selectedShape.radius ?? null}
              min={0}
              max={1000}
              onCommit={(value) => onUpdate("radius", value)}
            />
          )}
          {selectedShape.type === "text" && (
            <>
              <div className="studio-inspector__section-title">Text</div>
              <StyleSelect
                label="Font"
                value={selectedShape.font}
                options={["draw", "sans", "serif", "mono"]}
                onChange={(value) => onTextStyle("font", value)}
              />
              <StyleSelect
                label="Size"
                value={selectedShape.fontSize}
                options={["s", "m", "l", "xl"]}
                onChange={(value) => onTextStyle("size", value)}
              />
              <StyleSelect
                label="Weight"
                value={selectedShape.weight}
                options={["regular", "bold"]}
                onChange={(value) => onTextStyle("weight", value)}
              />
              <StyleSelect
                label="Alignment"
                value={selectedShape.textAlign}
                options={["start", "middle", "end"]}
                onChange={(value) => onTextStyle("textAlign", value)}
              />
            </>
          )}
          <dl className="studio-inspector__metadata">
            <dt>Type</dt>
            <dd>{selectedShape.type}</dd>
          </dl>
        </div>
      ) : (
        <div className="studio-inspector__body studio-inspector__body--page">
          <section className="studio-inspector__section">
            <div className="studio-inspector__section-title">Background</div>
            <div className="studio-inspector__background-row">
              <HexColorProperty
                value={page.background}
                onCommit={(background) => onPageChange({ ...page, background })}
              />
              <NumericProperty
                label="Opacity"
                value={page.opacity}
                min={0}
                max={100}
                suffix="%"
                onCommit={(opacity) => onPageChange({ ...page, opacity })}
              />
            </div>
            <label className="studio-inspector__toggle-row">
              <span>Dot grid</span>
              <input
                aria-label="Show dot grid"
                type="checkbox"
                role="switch"
                checked={page.grid}
                onChange={(event) => onPageChange({ ...page, grid: event.target.checked })}
              />
            </label>
          </section>
          <div className="studio-inspector__rule" />
          <section className="studio-inspector__section studio-inspector__section--presets">
            <div className="studio-inspector__section-title">New frame presets</div>
            <div className="studio-inspector__presets">
              {[
                ["Desktop", 1440, 1024],
                ["Tablet", 834, 1194],
                ["Mobile", 390, 844]
              ].map(([label, width, height]) => (
                <button key={label} type="button" onClick={() => onFramePreset(Number(width), Number(height))}>
                  <span>{label}</span>
                  <span>
                    {width} × {height}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <div className="studio-inspector__rule" />
          <section className="studio-inspector__section studio-inspector__section--export">
            <div className="studio-inspector__section-title">Export</div>
            <div className="studio-inspector__export-row">
              <label>
                <span className="sr-only">Export format</span>
                <select
                  aria-label="Export format"
                  value={pageFormat}
                  onChange={(event) => setPageFormat(event.target.value as "png" | "svg" | "json")}
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Export scale</span>
                <select
                  aria-label="Export scale"
                  value={pageScale}
                  disabled={pageFormat !== "png"}
                  onChange={(event) => setPageScale(event.target.value === "1" ? 1 : 2)}
                >
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                </select>
              </label>
            </div>
            <button
              className="studio-inspector__export"
              type="button"
              onClick={() => (onExportPage ? onExportPage(pageFormat, pageScale) : onExport())}
            >
              Export page
            </button>
          </section>
        </div>
      )}
      {!selectedShape && (
        <p className="studio-inspector__hint">Select a layer to edit its position, size, fill and type.</p>
      )}
    </aside>
  );
}

const SHAPE_COLORS = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white"
];

function StyleSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null | undefined;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="studio-inspector__field-label">
      {label}
      <select
        aria-label={label}
        value={value ?? ""}
        disabled={value === undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {value === null && <option value="">Mixed</option>}
        {value === undefined && <option value="">Unavailable</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function HexColorProperty({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const valid = /^#[0-9a-fA-F]{6}$/.test(draft);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (valid) onCommit(draft.toLowerCase());
    else setDraft(value);
  };

  return (
    <label className="studio-inspector__field-label studio-inspector__color-property">
      Background
      <span className="studio-inspector__color-control">
        <input
          aria-label="Background color swatch"
          type="color"
          value={valid ? draft : value}
          onChange={(event) => {
            setDraft(event.target.value);
            onCommit(event.target.value);
          }}
        />
        <input
          aria-label="Page background"
          className="studio-inspector__field"
          value={draft}
          maxLength={7}
          spellCheck={false}
          aria-invalid={!valid}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
        />
      </span>
      {!valid && (
        <span className="studio-inspector__validation" role="status">
          Enter a hex color such as #2B2B2B.
        </span>
      )}
    </label>
  );
}

function NumericProperty({
  label,
  value,
  min,
  max,
  suffix,
  onCommit
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const serializedValue = value === null ? "" : String(Math.round(value));
  const [draft, setDraft] = useState(serializedValue);
  const [isEditing, setIsEditing] = useState(false);
  const scrubStart = React.useRef<{ pointerId: number; startX: number; startValue: number } | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(serializedValue);
  }, [isEditing, serializedValue]);

  const commit = () => {
    setIsEditing(false);
    if (!draft.trim()) {
      setDraft(serializedValue);
      return;
    }
    const nextValue = Number(draft);
    if (Number.isFinite(nextValue) && nextValue >= min && nextValue <= max) {
      onCommit(nextValue);
      return;
    }
    setDraft(serializedValue);
  };

  return (
    <label className="studio-inspector__field-label">
      <span className="studio-inspector__field-heading">
        <span>{label}</span>
        <button
          className="studio-inspector__scrubber"
          type="button"
          aria-label={`Scrub ${label}`}
          title="Drag to adjust · arrow keys also work"
          disabled={value === null}
          onPointerDown={(event) => {
            if (event.button !== 0 || value === null) return;
            event.preventDefault();
            scrubStart.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = scrubStart.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const next = Math.min(
              max,
              Math.max(min, Math.round(start.startValue + (event.clientX - start.startX) / 4))
            );
            setDraft(String(next));
            onCommit(next);
          }}
          onPointerUp={() => {
            scrubStart.current = null;
          }}
          onPointerCancel={() => {
            scrubStart.current = null;
          }}
          onLostPointerCapture={() => {
            scrubStart.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = Math.min(max, Math.max(min, (value ?? min) + delta * (event.shiftKey ? 10 : 1)));
            setDraft(String(next));
            onCommit(next);
          }}
        >
          <GripHorizontal size={12} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={1}
        value={draft}
        placeholder={value === null ? "Mixed" : ""}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(serializedValue);
            event.currentTarget.blur();
          }
        }}
        className="studio-inspector__field"
      />
      {suffix ? <span className="studio-inspector__suffix">{suffix}</span> : null}
    </label>
  );
}

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
  panelWidth,
  panelHeight
}: StudioInspectorProps) {
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
          <div className="studio-inspector__title">Inspector</div>
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
              label="X position"
              value={selectedShape.x}
              min={-1_000_000}
              max={1_000_000}
              onCommit={(value) => onUpdate("x", value)}
            />
            <NumericProperty
              label="Y position"
              value={selectedShape.y}
              min={-1_000_000}
              max={1_000_000}
              onCommit={(value) => onUpdate("y", value)}
            />
            {selectedShape.width !== undefined && (
              <NumericProperty
                label="Width"
                value={selectedShape.width}
                min={1}
                max={1_000_000}
                onCommit={(value) => onUpdate("width", value)}
              />
            )}
            {selectedShape.height !== undefined && (
              <NumericProperty
                label="Height"
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
            {selectedShape.id && (
              <>
                <dt>ID</dt>
                <dd>{selectedShape.id}</dd>
              </>
            )}
          </dl>
        </div>
      ) : (
        <div className="studio-inspector__body">
          <div className="studio-inspector__section-title">Page</div>
          <HexColorProperty value={page.background} onCommit={(background) => onPageChange({ ...page, background })} />
          <NumericProperty
            label="Background opacity"
            value={page.opacity}
            min={0}
            max={100}
            onCommit={(opacity) => onPageChange({ ...page, opacity })}
          />
          <label className="studio-inspector__field-label">
            Grid
            <input
              aria-label="Show grid"
              type="checkbox"
              checked={page.grid}
              onChange={(event) => onPageChange({ ...page, grid: event.target.checked })}
            />
          </label>
          <button className="studio-inspector__export" type="button" onClick={onExport}>
            Export
          </button>
        </div>
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
  onCommit
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
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
    </label>
  );
}

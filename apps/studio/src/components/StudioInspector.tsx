import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

export type GeometryProperty = "x" | "y" | "width" | "height";

export interface InspectedShape {
  id?: string;
  type: string;
  count: number;
  x: number | null;
  y: number | null;
  width?: number | null;
  height?: number | null;
}

export interface StudioInspectorProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  selectedShape: InspectedShape | null;
  onUpdate: (property: GeometryProperty, value: number) => void;
  panelWidth: number;
  panelHeight: number;
}

export function StudioInspector({
  className,
  isOpen,
  onClose,
  selectedShape,
  onUpdate,
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
        <button
          className="studio-panel-close"
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      {selectedShape ? (
        <div className="studio-inspector__body">
          <div className="studio-inspector__section-title">
            Position and size
          </div>
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
          </div>
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
        <p className="studio-inspector__empty">
          Select a shape on the canvas to inspect and edit its geometry.
        </p>
      )}
    </aside>
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
      {label}
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

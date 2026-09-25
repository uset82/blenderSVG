import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Editor, type TLShape, type TLShapeId, useValue } from "tldraw";
import {
  buildLayerForest,
  flattenLayerForest,
  type LayerShape,
  layerWindow,
  reorderSiblingIndexes
} from "./layerTree.js";

const ROW_HEIGHT = 30;

export function LayerPanel({ editor }: { editor: Editor }) {
  const pageId = useValue("studio layer page", () => String(editor.getCurrentPageId()), [editor]);
  const shapes = useValue("studio layer shapes", () => editor.getCurrentPageShapes(), [editor]);
  const selectedIds = useValue("studio layer selection", () => editor.getSelectedShapeIds(), [editor]);
  const selected = new Set(selectedIds.map(String));
  const rows = useMemo(() => flattenLayerForest(buildLayerForest(shapes.map(toLayerShape), pageId)), [shapes, pageId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(420);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const finishedRenameRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const window = layerWindow(rows.length, scrollTop, viewport, ROW_HEIGHT);
  const visible = rows.slice(window.start, window.end);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setViewport(element.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing pages must reset the virtual list's scroll window.
  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pageId]);

  useEffect(() => {
    if (!editingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingId]);

  const commitRename = (row: LayerShape) => {
    if (finishedRenameRef.current === row.id) return;
    finishedRenameRef.current = row.id;
    const next = draft.trim();
    setEditingId(null);
    if (!next || next === row.label) return;
    const shape = editor.getShape(row.id as TLShapeId);
    if (!shape) return;
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      ...(shape.type === "frame" ? { props: { name: next } } : {}),
      meta: { ...shape.meta, studioName: next }
    } as Parameters<Editor["updateShape"]>[0]);
  };

  return (
    <div className="studio-left-tabs__body">
      {rows.length === 0 ? <p className="studio-left-tabs__empty">This page has no shapes yet.</p> : null}
      <div
        ref={scrollRef}
        className="studio-layer-scroll"
        onScroll={(event) => {
          setScrollTop(event.currentTarget.scrollTop);
          setViewport(event.currentTarget.clientHeight);
        }}
      >
        <ul className="studio-layer-canvas" style={{ ["--layer-canvas" as string]: `${rows.length * ROW_HEIGHT}px` }}>
          {visible.map((row, offset) => {
            const top = (window.start + offset) * ROW_HEIGHT;
            return (
              <li
                key={row.id}
                className={`studio-layer-row${selected.has(row.id) ? " studio-layer-row--selected" : ""}`}
                aria-roledescription="Layer; drag to reorder"
                aria-label={row.label}
                style={{ ["--layer-top" as string]: `${top}px`, ["--layer-depth" as string]: String(row.depth) }}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = event.dataTransfer.getData("text/plain");
                  const next = reorderSiblingIndexes(shapes.map(toLayerShape), draggedId, row.id);
                  if (!next) return;
                  editor.updateShapes(
                    next.flatMap((item) => {
                      const shape = editor.getShape(item.id as TLShapeId);
                      return shape
                        ? [
                            { id: shape.id, type: shape.type, index: item.index } as Parameters<
                              Editor["updateShapes"]
                            >[0][number]
                          ]
                        : [];
                    })
                  );
                }}
              >
                {editingId === row.id ? (
                  <input
                    className="studio-layer-row__rename"
                    ref={renameInputRef}
                    aria-label={`Rename ${row.label}`}
                    value={draft}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    onBlur={() => commitRename(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        finishedRenameRef.current = row.id;
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="studio-layer-row__label"
                    aria-current={selected.has(row.id) ? "true" : undefined}
                    onClick={() => editor.select(row.id as TLShapeId)}
                    onDoubleClick={() => {
                      finishedRenameRef.current = null;
                      setEditingId(row.id);
                      setDraft(row.label);
                    }}
                  >
                    {row.label}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={row.hidden ? `Show ${row.label}` : `Hide ${row.label}`}
                  aria-pressed={row.hidden}
                  onClick={() => toggleHidden(editor, row.id)}
                >
                  {row.hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  aria-label={row.locked ? `Unlock ${row.label}` : `Lock ${row.label}`}
                  aria-pressed={row.locked}
                  onClick={() => editor.toggleLock([row.id as TLShapeId])}
                >
                  {row.locked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="studio-layer-hint">Double-click to rename · drag to reorder</p>
    </div>
  );
}

function toLayerShape(shape: TLShape): LayerShape {
  const meta = shape.meta as { studioHidden?: unknown };
  return {
    id: String(shape.id),
    parentId: String(shape.parentId),
    type: shape.type,
    index: shape.index,
    label: layerLabel(shape),
    opacity: shape.opacity,
    locked: shape.isLocked,
    hidden: meta.studioHidden === true
  };
}

function layerLabel(shape: TLShape): string {
  const meta = shape.meta as { studioName?: unknown };
  if (typeof meta.studioName === "string" && meta.studioName.trim()) return meta.studioName;
  const props = shape.props as { name?: unknown; text?: unknown };
  if (typeof props.name === "string" && props.name.trim()) return props.name;
  if (typeof props.text === "string" && props.text.trim()) return props.text.slice(0, 40);
  return shape.type;
}

function toggleHidden(editor: Editor, id: string): void {
  const shape = editor.getShape(id as TLShapeId);
  if (!shape) return;
  const meta = shape.meta as { studioHidden?: unknown; studioOpacity?: unknown };
  const hidden = meta.studioHidden === true;
  const stored = typeof meta.studioOpacity === "number" ? meta.studioOpacity : 1;
  editor.updateShape({
    id: shape.id,
    type: shape.type,
    opacity: hidden ? stored : 0,
    meta: { ...shape.meta, studioHidden: !hidden, studioOpacity: hidden ? stored : shape.opacity }
  } as Parameters<Editor["updateShape"]>[0]);
}

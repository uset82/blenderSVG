import {
  ArrowDown,
  ArrowUp,
  Files,
  Layers,
  MessageSquare,
  Palette,
  PanelLeftClose,
  Plus,
  Shapes,
  Trash2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Editor, useValue } from "tldraw";
import { IconButton } from "../ui/index.js";
import { collectCanvasAssets, encodeAssetDrag, placeCanvasAsset } from "./canvasAssets.js";
import { LayerPanel } from "./LayerPanel.js";
import { LEFT_PANEL_TABS, type LeftPanelTab } from "./leftPanelTab.js";
import { movePageIndexes } from "./pageOrder.js";
import { type ProjectStyle, readProjectStyle, toStyleChoice, withProjectStyle } from "./projectStyle.js";
import { isSessionScratchpad } from "./sessionScratchpad.js";

const TAB_ICONS = {
  agent: MessageSquare,
  layers: Layers,
  pages: Files,
  assets: Shapes,
  styles: Palette
} as const;

const TAB_LABELS: Record<LeftPanelTab, string> = {
  agent: "Agent",
  layers: "Layers",
  pages: "Pages",
  assets: "Assets",
  styles: "Styles"
};

export function LeftPanelTabBar({
  tab,
  onTab,
  onCollapse
}: {
  tab: LeftPanelTab;
  onTab: (tab: LeftPanelTab) => void;
  onCollapse: () => void;
}) {
  return (
    <div className="studio-left-tabs" role="tablist" aria-label="Panels">
      {LEFT_PANEL_TABS.map((item) => {
        const Icon = TAB_ICONS[item];
        return (
          <IconButton
            key={item}
            className={`studio-left-tabs__tab${item === "agent" ? " studio-left-tabs__tab--labeled" : ""}`}
            icon={<Icon size={15} strokeWidth={1.75} />}
            label={TAB_LABELS[item]}
            role="tab"
            aria-selected={tab === item}
            onClick={() => onTab(item)}
          />
        );
      })}
      <span className="studio-left-tabs__spacer" />
      <IconButton icon={<PanelLeftClose size={15} strokeWidth={1.75} />} label="Collapse panel" onClick={onCollapse} />
    </div>
  );
}

export function LeftPanelTabBody({
  tab,
  editor,
  onOpenPage,
  onDeletePage
}: {
  tab: Exclude<LeftPanelTab, "agent">;
  editor: Editor | null;
  onOpenPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}) {
  if (!editor) {
    return <p className="studio-left-tabs__empty">The canvas is still starting.</p>;
  }
  if (tab === "layers") return <LayerPanel editor={editor} />;
  if (tab === "pages") return <PagesPanel editor={editor} onOpenPage={onOpenPage} onDeletePage={onDeletePage} />;
  if (tab === "assets") return <AssetsPanel editor={editor} />;
  return <StylesPanel editor={editor} />;
}

function PagesPanel({
  editor,
  onOpenPage,
  onDeletePage
}: {
  editor: Editor;
  onOpenPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}) {
  const pages = useValue(
    "studio page list",
    () =>
      editor
        .getPages()
        .slice()
        .sort((left, right) => compareIndexKeys(left.index, right.index)),
    [editor]
  );
  const current = useValue("studio current page", () => String(editor.getCurrentPageId()), [editor]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const finishedRenameRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const move = (pageId: string, direction: -1 | 1) => {
    const pinnedIds = new Set(pages.filter(isSessionScratchpad).map((page) => String(page.id)));
    const next = movePageIndexes(
      pages.map((page) => ({ id: String(page.id), index: page.index })),
      pageId,
      direction,
      pinnedIds
    );
    if (!next) return;
    editor.run(() => {
      for (const item of next) {
        editor.updatePage({
          id: item.id as (typeof pages)[number]["id"],
          index: item.index as (typeof pages)[number]["index"]
        });
      }
    });
  };
  const commitRename = (page: (typeof pages)[number]) => {
    const id = String(page.id);
    if (finishedRenameRef.current === id) return;
    finishedRenameRef.current = id;
    const next = draft.trim();
    setEditingId(null);
    if (next && next !== page.name) editor.renamePage(page.id, next);
  };

  useEffect(() => {
    if (!editingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingId]);

  return (
    <div className="studio-left-tabs__body">
      <button
        className="studio-left-tabs__add"
        type="button"
        onClick={() => {
          const existingIds = new Set(pages.map((page) => page.id));
          const existingNames = new Set(pages.map((page) => page.name.toLocaleLowerCase()));
          let ordinal = pages.length + 1;
          while (existingNames.has(`page ${ordinal}`)) ordinal += 1;
          editor.createPage({ name: `Page ${ordinal}` });
          const created = editor.getPages().find((page) => !existingIds.has(page.id));
          if (created) onOpenPage(String(created.id));
        }}
      >
        <Plus size={15} aria-hidden="true" />
        Add page
      </button>
      <ul className="studio-left-tabs__list">
        {pages.map((page, index) => {
          const id = String(page.id);
          const pinned = isSessionScratchpad(page);
          const previousPage = pages[index - 1];
          const nextPage = pages[index + 1];
          return (
            <li key={page.id} className="studio-page-row">
              {editingId === id ? (
                <input
                  className="studio-layer-row__rename"
                  ref={renameInputRef}
                  aria-label={`Rename ${page.name}`}
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  onBlur={() => commitRename(page)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      finishedRenameRef.current = id;
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="studio-page-row__select"
                  aria-current={page.id === current ? "page" : undefined}
                  onClick={() => onOpenPage(id)}
                  onDoubleClick={() => {
                    if (pinned) return;
                    finishedRenameRef.current = null;
                    setEditingId(id);
                    setDraft(page.name);
                  }}
                >
                  {page.name}
                  {pinned ? " · Pinned" : ""}
                </button>
              )}
              <div className="studio-page-row__actions">
                <button
                  type="button"
                  className="studio-page-row__action"
                  aria-label={`Move ${page.name} up`}
                  title="Move up"
                  disabled={pinned || !previousPage || isSessionScratchpad(previousPage)}
                  onClick={() => move(id, -1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="studio-page-row__action"
                  aria-label={`Move ${page.name} down`}
                  title="Move down"
                  disabled={pinned || !nextPage || isSessionScratchpad(nextPage)}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                {!pinned && pages.length > 1 && (
                  <button
                    type="button"
                    className="studio-page-row__action studio-page-row__action--danger"
                    aria-label={`Delete page ${page.name}`}
                    title="Delete page"
                    onClick={() => {
                      if (window.confirm(`Delete page “${page.name}”? This cannot be undone.`)) onDeletePage(id);
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssetsPanel({ editor }: { editor: Editor }) {
  const items = useValue(
    "studio canvas assets",
    () =>
      collectCanvasAssets({
        assets: editor
          .getAssets()
          .map((asset) => ({ id: String(asset.id), type: asset.type, label: assetLabel(asset) })),
        shapes: editor.store.allRecords().flatMap((record) => {
          if (record.typeName !== "shape") return [];
          const shape = record as { id: string; type: string; props: object };
          return [{ id: String(shape.id), type: shape.type, label: shapeLabel(shape) }];
        })
      }),
    [editor]
  );
  return (
    <div className="studio-left-tabs__body">
      <button
        className="studio-left-tabs__add"
        type="button"
        onClick={() => {
          const center = editor.getViewportPageBounds().center;
          editor.createShape({
            type: "avatar",
            x: center.x - 170,
            y: center.y - 240,
            props: {
              w: 340,
              h: 480,
              character: "cholita-3d",
              avatarState: "idle",
              speech: "Local illustration preview only. This does not animate a character rig."
            }
          });
        }}
      >
        Add avatar
      </button>
      {items.length === 0 ? (
        <p className="studio-left-tabs__empty">
          No images, SVGs, or avatars are stored in this canvas yet. Add an avatar or import an image, then drag it from
          this list onto the canvas.
        </p>
      ) : (
        <ul className="studio-left-tabs__list">
          {items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <button
                type="button"
                draggable
                aria-label={`Add ${item.kind} ${item.label} to the canvas`}
                title={`Click or drag ${item.label} onto the canvas`}
                onClick={() => placeCanvasAsset(editor, item, editor.getViewportPageBounds().center)}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", encodeAssetDrag(item));
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                {item.kind === "image" ? "Image" : item.kind === "svg" ? "SVG" : "Avatar"} · {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StylesPanel({ editor }: { editor: Editor }) {
  const style = useValue("studio project style", () => readProjectStyle(editor.getDocumentSettings()?.meta), [editor]);
  const choice = toStyleChoice(style);
  const commit = (next: ProjectStyle): boolean => {
    const document = editor.getDocumentSettings();
    if (!document) return false;
    const meta = withProjectStyle(document.meta, next);
    if (!meta) return false;
    editor.updateDocumentSettings({ meta: meta as typeof document.meta });
    return true;
  };
  return (
    <div className="studio-left-tabs__body">
      <p className="studio-left-tabs__note">{choice.label} is saved with this canvas.</p>
      <StyleTextField label="Style name" value={style.name} onCommit={(name) => commit({ ...style, name })} />
      <StyleColorField
        label="Canvas"
        value={style.colors.canvas}
        onCommit={(canvas) => commit({ ...style, colors: { ...style.colors, canvas } })}
      />
      <StyleColorField
        label="Surface"
        value={style.colors.surface}
        onCommit={(surface) => commit({ ...style, colors: { ...style.colors, surface } })}
      />
      <StyleColorField
        label="Text"
        value={style.colors.text}
        onCommit={(text) => commit({ ...style, colors: { ...style.colors, text } })}
      />
      <StyleColorField
        label="Accent"
        value={style.colors.accent}
        onCommit={(accent) => commit({ ...style, colors: { ...style.colors, accent } })}
      />
      <StyleTextField
        label="Sans"
        ariaLabel="Sans font"
        value={style.type.sans}
        onCommit={(sans) => commit({ ...style, type: { ...style.type, sans } })}
      />
      <StyleTextField
        label="Mono"
        ariaLabel="Mono font"
        value={style.type.mono}
        onCommit={(mono) => commit({ ...style, type: { ...style.type, mono } })}
      />
    </div>
  );
}

function StyleTextField({
  label,
  ariaLabel = label,
  value,
  onCommit
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const cancelOnBlurRef = useRef(false);
  const errorId = `style-${ariaLabel.toLowerCase().replaceAll(" ", "-")}-error`;

  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const finish = () => {
    if (cancelOnBlurRef.current) {
      cancelOnBlurRef.current = false;
      setDraft(value);
      setInvalid(false);
      return;
    }
    if (draft.trim() === value) {
      setDraft(value);
      setInvalid(false);
      return;
    }
    if (!onCommit(draft)) {
      setDraft(value);
      setInvalid(true);
      return;
    }
    setInvalid(false);
  };

  return (
    <label className="studio-style-field">
      {label}
      <input
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        value={draft}
        maxLength={40}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelOnBlurRef.current = true;
            event.currentTarget.blur();
          }
        }}
      />
      {invalid && (
        <span className="studio-style-field__error" id={errorId}>
          Enter a non-empty value up to 40 characters.
        </span>
      )}
    </label>
  );
}

function StyleColorField({
  label,
  value,
  onCommit
}: {
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const cancelOnBlurRef = useRef(false);
  const errorId = `style-${label.toLowerCase()}-hex-error`;

  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const finish = () => {
    if (cancelOnBlurRef.current) {
      cancelOnBlurRef.current = false;
      setDraft(value);
      setInvalid(false);
      return;
    }
    if (draft.toLowerCase() === value.toLowerCase()) {
      setDraft(value);
      setInvalid(false);
      return;
    }
    if (!onCommit(draft)) {
      setDraft(value);
      setInvalid(true);
      return;
    }
    setInvalid(false);
  };

  return (
    <label className="studio-style-field">
      {label}
      <span className="studio-style-color">
        <input
          aria-label={`${label} swatch`}
          type="color"
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
            onCommit(event.target.value);
          }}
        />
        <input
          aria-label={`${label} hex`}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          value={draft}
          spellCheck={false}
          maxLength={7}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelOnBlurRef.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      </span>
      {invalid && (
        <span className="studio-style-field__error" id={errorId}>
          Use a six-digit hex value, such as #B53A17.
        </span>
      )}
    </label>
  );
}

function shapeLabel(shape: { type: string; props: object }): string {
  const props = shape.props as { name?: unknown; text?: unknown; character?: unknown };
  if (typeof props.name === "string" && props.name.trim()) return props.name;
  if (typeof props.character === "string" && props.character.trim()) return props.character;
  if (typeof props.text === "string" && props.text.trim()) return props.text.slice(0, 40);
  return shape.type;
}

function assetLabel(asset: { type: string; props: object }): string {
  const props = asset.props as { name?: unknown; title?: unknown };
  if (typeof props.name === "string" && props.name.trim()) return props.name;
  if (typeof props.title === "string" && props.title.trim()) return props.title;
  return asset.type;
}

function compareIndexKeys(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

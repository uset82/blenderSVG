import { Files, Layers, MessageSquare, Palette, PanelLeftClose, Shapes } from "lucide-react";
import type { Editor, TLShapeId } from "tldraw";
import { IconButton } from "../ui/index.js";
import { isSessionScratchpad } from "./sessionScratchpad.js";
import { LEFT_PANEL_TABS, type LeftPanelTab } from "./leftPanelTab.js";

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
  editor
}: {
  tab: Exclude<LeftPanelTab, "agent">;
  editor: Editor | null;
}) {
  if (!editor) {
    return <p className="studio-left-tabs__empty">The canvas is still starting.</p>;
  }
  if (tab === "layers") return <LayersPanel editor={editor} />;
  if (tab === "pages") return <PagesPanel editor={editor} />;
  if (tab === "assets") return <AssetsPanel editor={editor} />;
  return <StylesPanel editor={editor} />;
}

function LayersPanel({ editor }: { editor: Editor }) {
  const pageId = editor.getCurrentPageId();
  const shapes = editor.getCurrentPageShapes();
  const selected = new Set(editor.getSelectedShapeIds());
  const frames = shapes.filter((shape) => shape.type === "frame");
  const childrenOf = (parentId: TLShapeId) => shapes.filter((shape) => shape.parentId === parentId);
  return (
    <div className="studio-left-tabs__body">
      <p className="studio-left-tabs__empty">{shapes.length === 0 ? "This page has no shapes yet." : `${shapes.length} shape${shapes.length === 1 ? "" : "s"} on this page.`}</p>
      <ul className="studio-left-tabs__list">
        {frames.map((frame) => (
          <li key={frame.id}>
            <button type="button" aria-current={selected.has(frame.id) ? "true" : undefined} onClick={() => editor.select(frame.id)}>
              {frameLabel(frame)}
            </button>
            <ul>
              {childrenOf(frame.id).map((child) => (
                <li key={child.id}>
                  <button type="button" aria-current={selected.has(child.id) ? "true" : undefined} onClick={() => editor.select(child.id)}>
                    {frameLabel(child)}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="studio-left-tabs__note">Page {String(pageId)}. Hide, lock, rename, and reorder are still being connected.</p>
    </div>
  );
}

function PagesPanel({ editor }: { editor: Editor }) {
  const pages = editor.getPages();
  const current = editor.getCurrentPageId();
  return (
    <div className="studio-left-tabs__body">
      <button
        className="studio-left-tabs__add"
        type="button"
        onClick={() => {
          editor.createPage({ name: `Page ${pages.length + 1}` });
        }}
      >
        Add page
      </button>
      <ul className="studio-left-tabs__list">
        {pages.map((page) => (
          <li key={page.id}>
            <button type="button" aria-current={page.id === current ? "page" : undefined} onClick={() => editor.setCurrentPage(page.id)}>
              {page.name}{isSessionScratchpad(page) ? " · Pinned" : ""}
            </button>
            {!isSessionScratchpad(page) && pages.length > 1 && (
              <button type="button" onClick={() => editor.deletePage(page.id)}>Delete</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetsPanel({ editor }: { editor: Editor }) {
  const assets = editor.getAssets();
  return (
    <div className="studio-left-tabs__body">
      {assets.length === 0 ? (
        <p className="studio-left-tabs__empty">No images, SVGs, or avatars are stored in this canvas yet.</p>
      ) : (
        <ul className="studio-left-tabs__list">
          {assets.map((asset) => (
            <li key={asset.id}>{assetLabel(asset)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StylesPanel({ editor }: { editor: Editor }) {
  const fills = new Set<string>();
  for (const shape of editor.getCurrentPageShapes()) {
    const props = shape.props as { color?: unknown; fill?: unknown };
    if (typeof props.color === "string") fills.add(props.color);
  }
  return (
    <div className="studio-left-tabs__body">
      <p className="studio-left-tabs__empty">Colors used on this page. A saved style library is not stored yet.</p>
      <ul className="studio-left-tabs__list">
        {[...fills].map((color) => <li key={color}>{color}</li>)}
      </ul>
    </div>
  );
}

function assetLabel(asset: { type: string; props: object }): string {
  const props = asset.props as { name?: unknown; title?: unknown };
  if (typeof props.name === "string" && props.name.trim()) return props.name;
  if (typeof props.title === "string" && props.title.trim()) return props.title;
  return asset.type;
}

function frameLabel(shape: { type: string; props: object }): string {
  const props = shape.props as { name?: unknown; text?: unknown };
  if (typeof props.name === "string" && props.name.trim()) return props.name;
  if (typeof props.text === "string" && props.text.trim()) return props.text.slice(0, 40);
  return shape.type;
}

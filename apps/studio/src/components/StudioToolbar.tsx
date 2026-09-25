import {
  ChevronDown,
  Frame,
  Hand,
  ImagePlus,
  Keyboard,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  StickyNote,
  Type,
  X
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { type Editor, GeoShapeGeoStyle, useValue } from "tldraw";

type ToolId = "select" | "hand" | "frame" | "geo" | "draw" | "text" | "note";

interface ToolDefinition {
  id?: ToolId;
  label: string;
  shortcut: string;
  icon: typeof MousePointer2;
  geo?: "rectangle" | "ellipse";
  action?: "import" | "trace";
}

const TOOLS: ToolDefinition[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
  { id: "frame", label: "Frame", shortcut: "F", icon: Frame },
  { id: "geo", label: "Rectangle", shortcut: "R", icon: RectangleHorizontal, geo: "rectangle" },
  { id: "draw", label: "Pen", shortcut: "P", icon: PenLine },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "note", label: "Sticky note", shortcut: "N", icon: StickyNote },
  { label: "Image or SVG", shortcut: "I", icon: ImagePlus, action: "import" },
  // Phase 21 requires Vector asset from the tool rail; Target omits it, but the plan wins.
  { label: "Trace image locally", shortcut: "trace", icon: ImagePlus, action: "trace" }
];

const RAIL_TOOLS = TOOLS;

const FRAME_PRESETS = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "presentation", label: "Presentation", width: 1600, height: 900 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "phone", label: "Phone", width: 390, height: 844 }
] as const;
type FramePreset = (typeof FRAME_PRESETS)[number];

export function StudioToolbar({
  editor,
  onImportAsset,
  onTraceAsset
}: {
  editor: Editor | null;
  onImportAsset: () => void;
  onTraceAsset?: (() => void) | undefined;
}) {
  if (!editor) return null;
  return (
    <MountedStudioToolbar editor={editor} onImportAsset={onImportAsset} {...(onTraceAsset ? { onTraceAsset } : {})} />
  );
}

function MountedStudioToolbar({
  editor,
  onImportAsset,
  onTraceAsset
}: {
  editor: Editor;
  onImportAsset: () => void;
  onTraceAsset?: (() => void) | undefined;
}) {
  const active = useValue(
    "studio active canvas tool",
    () => ({ id: editor.getCurrentToolId(), geo: editor.getStyleForNextShape(GeoShapeGeoStyle) }),
    [editor]
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  const [selectedFramePreset, setSelectedFramePreset] = useState<FramePreset | null>(null);
  const pendingFramePresetRef = useRef<FramePreset | null>(null);

  useEffect(
    () =>
      editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
        const preset = pendingFramePresetRef.current;
        if (!preset || shape.type !== "frame") return;
        pendingFramePresetRef.current = null;
        editor.updateShape({
          id: shape.id,
          type: "frame",
          props: { w: preset.width, h: preset.height, name: preset.label }
        });
      }),
    [editor]
  );

  useEffect(() => {
    if (active.id !== "frame") pendingFramePresetRef.current = null;
  }, [active.id]);

  const activate = useCallback(
    (tool: ToolDefinition) => {
      if (tool.action === "import") {
        pendingFramePresetRef.current = null;
        onImportAsset();
        setShortcutsOpen(false);
        return;
      }
      if (tool.action === "trace") {
        pendingFramePresetRef.current = null;
        onTraceAsset?.();
        setShortcutsOpen(false);
        return;
      }
      if (!tool.id) return;
      pendingFramePresetRef.current = tool.id === "frame" ? selectedFramePreset : null;
      if (tool.geo) editor.setStyleForNextShapes(GeoShapeGeoStyle, tool.geo);
      editor.setCurrentTool(tool.id);
      setShortcutsOpen(false);
    },
    [editor, onImportAsset, onTraceAsset, selectedFramePreset]
  );

  useEffect(() => {
    const byShortcut = new Map(TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool]));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (event.key === "Escape" && frameMenuOpen) {
        setFrameMenuOpen(false);
        pendingFramePresetRef.current = null;
        return;
      }
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target;
        if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;

      const tool = byShortcut.get(event.key.toLowerCase());
      if (!tool) return;
      event.preventDefault();
      activate(tool);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activate, frameMenuOpen, shortcutsOpen]);

  const isActive = (tool: ToolDefinition) =>
    Boolean(tool.id && active.id === tool.id && (!tool.geo || active.geo === tool.geo));

  return (
    <nav className="studio-toolbar" aria-label="Canvas tools">
      <div className="studio-toolbar__items">
        {RAIL_TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const selected = isActive(tool);
          return (
            <Fragment key={`${tool.id}-${tool.label}`}>
              {index === 2 && <span className="studio-toolbar__divider" aria-hidden="true" />}
              <span className={`studio-toolbar__item${tool.id === "frame" ? " studio-toolbar__item--frame" : ""}`}>
                <button
                  type="button"
                  className="studio-toolbar__button"
                  aria-label={`${tool.label} (${tool.shortcut})`}
                  aria-pressed={tool.action ? undefined : selected}
                  title={`${tool.label} · ${tool.shortcut}`}
                  onClick={() => activate(tool)}
                >
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                </button>
                {tool.id === "frame" && (
                  <button
                    type="button"
                    className="studio-toolbar__preset-trigger"
                    aria-label="Frame presets"
                    aria-expanded={frameMenuOpen}
                    aria-controls="studio-frame-presets"
                    title="Frame presets"
                    onClick={() => {
                      setShortcutsOpen(false);
                      setFrameMenuOpen((open) => !open);
                    }}
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                )}
              </span>
            </Fragment>
          );
        })}
        <span className="studio-toolbar__divider" aria-hidden="true" />
        <button
          type="button"
          className="studio-toolbar__button"
          aria-label="Keyboard shortcuts"
          aria-expanded={shortcutsOpen}
          aria-controls="studio-toolbar-shortcuts"
          title="Keyboard shortcuts"
          onClick={() => {
            setFrameMenuOpen(false);
            setShortcutsOpen((open) => !open);
          }}
        >
          <Keyboard size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {frameMenuOpen && (
        <div
          className="studio-toolbar__shortcuts studio-toolbar__frame-presets"
          id="studio-frame-presets"
          role="dialog"
          aria-label="Frame presets"
        >
          <div className="studio-toolbar__shortcuts-header">
            <span>Frame size</span>
            <button type="button" aria-label="Close frame presets" onClick={() => setFrameMenuOpen(false)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <ul>
            <li>
              <button
                type="button"
                aria-pressed={selectedFramePreset === null}
                onClick={() => {
                  setSelectedFramePreset(null);
                  pendingFramePresetRef.current = null;
                  editor.setCurrentTool("frame");
                  setFrameMenuOpen(false);
                }}
              >
                <span>Freeform</span>
                <kbd>Any size</kbd>
              </button>
            </li>
            {FRAME_PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={selectedFramePreset?.id === preset.id}
                  onClick={() => {
                    setSelectedFramePreset(preset);
                    pendingFramePresetRef.current = preset;
                    editor.setCurrentTool("frame");
                    setFrameMenuOpen(false);
                  }}
                >
                  <span>{preset.label}</span>
                  <kbd>
                    {preset.width}×{preset.height}
                  </kbd>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {shortcutsOpen && (
        <div
          className="studio-toolbar__shortcuts"
          id="studio-toolbar-shortcuts"
          role="dialog"
          aria-label="Canvas keyboard shortcuts"
        >
          <div className="studio-toolbar__shortcuts-header">
            <span>Canvas shortcuts</span>
            <button type="button" aria-label="Close keyboard shortcuts" onClick={() => setShortcutsOpen(false)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <ul>
            {TOOLS.map((tool) => (
              <li key={tool.shortcut}>
                <span>{tool.label}</span>
                <kbd>{tool.shortcut}</kbd>
              </li>
            ))}
            <li>
              <span>Command palette</span>
              <kbd>Ctrl+K</kbd>
            </li>
            <li>
              <span>Toggle panels</span>
              <kbd>Ctrl+\</kbd>
            </li>
            <li>
              <span>Undo</span>
              <kbd>Ctrl+Z</kbd>
            </li>
            <li>
              <span>Redo</span>
              <kbd>Ctrl+Shift+Z</kbd>
            </li>
            <li>
              <span>Duplicate</span>
              <kbd>Ctrl+D</kbd>
            </li>
            <li>
              <span>Group</span>
              <kbd>Ctrl+G</kbd>
            </li>
            <li>
              <span>Snapping</span>
              <kbd>Ctrl+Shift+S</kbd>
            </li>
            <li>
              <span>Zoom to fit</span>
              <kbd>Shift+1</kbd>
            </li>
            <li>
              <span>Zoom to selection</span>
              <kbd>Shift+2</kbd>
            </li>
            <li>
              <span>This sheet</span>
              <kbd>?</kbd>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

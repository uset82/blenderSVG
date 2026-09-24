import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { Editor, TLContent } from "tldraw";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { safeExportFileName } from "../projects/exportProjectFile.js";
import { canvasMenuItems, describeSelection, type CanvasMenuAction } from "./canvasContextMenu.js";

function downloadExport(body: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function StudioCanvasMenu({
  editor,
  onAskAboutSelection,
  onNotice,
  children
}: {
  editor: Editor | null;
  onAskAboutSelection: (summary: string) => void;
  onNotice: (message: string) => void;
  children: ReactNode;
}) {
  const clipboardRef = useRef<TLContent | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; selectedCount: number; snapEnabled: boolean } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== "s") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (editor.getEditingShapeId()) return;
      event.preventDefault();
      editor.user.updateUserPreferences({ isSnapMode: !editor.user.getIsSnapMode() });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!editor) return children;

  const items = canvasMenuItems({
    selectedCount: menu?.selectedCount ?? 0,
    canPaste: clipboardRef.current !== null,
    snapEnabled: menu?.snapEnabled ?? editor.user.getIsSnapMode()
  });

  const run = async (action: CanvasMenuAction) => {
    const ids = [...editor.getSelectedShapeIds()];
    const copied = () => editor.getContentFromCurrentPage(ids);
    if (action === "undo") {
      editor.undo();
    } else if (action === "redo") {
      editor.redo();
    } else if (action === "copy" || action === "cut") {
      const next = copied();
      if (!next) return;
      clipboardRef.current = next;
      if (action === "cut") {
        editor.markHistoryStoppingPoint("cut");
        editor.deleteShapes(ids);
      }
    } else if (action === "paste" && clipboardRef.current && menu) {
      editor.markHistoryStoppingPoint("paste");
      editor.putContentOntoCurrentPage(clipboardRef.current, {
        select: true,
        point: editor.screenToPage({ x: menu.x, y: menu.y })
      });
    } else if (action === "duplicate") {
      editor.markHistoryStoppingPoint("duplicate");
      editor.duplicateShapes(ids, { x: 24, y: 24 });
    } else if (action === "delete") {
      editor.markHistoryStoppingPoint("delete");
      editor.deleteShapes(ids);
    } else if (action === "bring-forward") {
      editor.markHistoryStoppingPoint("bring forward");
      editor.bringForward(ids);
    } else if (action === "send-backward") {
      editor.markHistoryStoppingPoint("send backward");
      editor.sendBackward(ids);
    } else if (action === "group") {
      editor.markHistoryStoppingPoint("group");
      editor.groupShapes(ids);
    } else if (
      action === "align-left" ||
      action === "align-center" ||
      action === "align-right" ||
      action === "align-top" ||
      action === "align-middle" ||
      action === "align-bottom"
    ) {
      const alignment = {
        "align-left": "left",
        "align-center": "center-horizontal",
        "align-right": "right",
        "align-top": "top",
        "align-middle": "center-vertical",
        "align-bottom": "bottom"
      } as const;
      editor.markHistoryStoppingPoint("align");
      editor.alignShapes(ids, alignment[action]);
    } else if (action === "distribute-horizontal" || action === "distribute-vertical") {
      editor.markHistoryStoppingPoint("distribute");
      editor.distributeShapes(ids, action === "distribute-horizontal" ? "horizontal" : "vertical");
    } else if (action === "snap") {
      editor.user.updateUserPreferences({ isSnapMode: !editor.user.getIsSnapMode() });
    } else if (action === "export-svg" || action === "export-png-1" || action === "export-png-2") {
      if (action === "export-svg") {
        const exported = await editor.getSvgString(ids);
        if (!exported?.svg) {
          onNotice("The selection could not be exported.");
          return;
        }
        downloadExport(sanitizeSvg(exported.svg), safeExportFileName("selection", "svg"), "image/svg+xml");
      } else {
        const image = await editor.toImage(ids, {
          format: "png",
          pixelRatio: action === "export-png-2" ? 2 : 1,
          background: true,
          padding: 0
        });
        downloadExport(image.blob, safeExportFileName("selection", "png"), "image/png");
      }
    } else if (action === "ask-agent") {
      const summary = describeSelection(
        ids.flatMap((id) => {
          const shape = editor.getShape(id);
          if (!shape) return [];
          const props = shape.props as { name?: unknown; text?: unknown; w?: unknown; h?: unknown };
          const label =
            typeof props.name === "string" && props.name.trim()
              ? props.name
              : typeof props.text === "string" && props.text.trim()
                ? props.text.slice(0, 40)
                : shape.type;
          return [
            {
              type: shape.type,
              label,
              ...(typeof props.w === "number" ? { w: props.w } : {}),
              ...(typeof props.h === "number" ? { h: props.h } : {})
            }
          ];
        })
      );
      if (summary) onAskAboutSelection(summary);
    }
    setMenu(null);
  };

  const openMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    const point = editor.screenToPage({ x: event.clientX, y: event.clientY });
    const hit = editor.getShapeAtPoint(point, { hitInside: true, hitFrameInside: true, hitLabels: true });
    if (hit) {
      if (!editor.getSelectedShapeIds().includes(hit.id)) editor.select(hit.id);
    } else {
      editor.selectNone();
    }
    setMenu({
      x: event.clientX,
      y: event.clientY,
      selectedCount: editor.getSelectedShapeIds().length,
      snapEnabled: editor.user.getIsSnapMode()
    });
  };

  return (
    <div className="studio-canvas-menu-host" onContextMenu={openMenu}>
      {children}
      {menu && (
        <div
          className="studio-canvas-menu"
          role="menu"
          aria-label="Canvas selection"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={!item.enabled}
              title={item.reason ?? ""}
              onClick={() => void run(item.id)}
            >
              <span>{item.label}</span>
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

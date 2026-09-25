import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { Editor, TLContent, TLShape } from "tldraw";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { safeExportFileName, stableExportSvgIds } from "../projects/exportProjectFile.js";
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
  const editStackRef = useRef<Array<{ before: TLShape[]; after: TLShape[] }>>([]);
  const redoStackRef = useRef<Array<{ before: TLShape[]; after: TLShape[] }>>([]);
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
    if (editor.getCurrentToolId() !== "select") {
      editor.setCurrentTool("select");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const ids = [...editor.getSelectedShapeIds()];
    const copied = () => editor.getContentFromCurrentPage(ids);
    const recordCanvasEdit = (name: string, change: () => void) => {
      const before = editor.getCurrentPageShapes().map((shape) => JSON.parse(JSON.stringify(shape)) as TLShape);
      editor.markHistoryStoppingPoint(name);
      change();
      editStackRef.current.push({
        before,
        after: editor.getCurrentPageShapes().map((shape) => JSON.parse(JSON.stringify(shape)) as TLShape)
      });
      redoStackRef.current = [];
    };
    const restoreShapes = (next: TLShape[], removeFrom: TLShape[]) => {
      const keep = new Set(next.map((shape) => shape.id));
      const remove = removeFrom.map((shape) => shape.id).filter((id) => !keep.has(id));
      editor.store.mergeRemoteChanges(() => {
        if (next.length) editor.store.put(next);
        if (remove.length) editor.store.remove(remove);
      });
    };
    if (action === "undo") {
      const entry = editStackRef.current.pop();
      if (entry) {
        restoreShapes(entry.before, entry.after);
        redoStackRef.current.push(entry);
        return;
      }
      editor.undo();
    } else if (action === "redo") {
      const entry = redoStackRef.current.pop();
      if (entry) {
        restoreShapes(entry.after, entry.before);
        editStackRef.current.push(entry);
        return;
      }
      editor.redo();
    } else if (action === "copy" || action === "cut") {
      const next = copied();
      if (!next) return;
      clipboardRef.current = next;
      if (action === "cut") {
        recordCanvasEdit("cut", () => editor.deleteShapes(ids));
      }
    } else if (action === "paste" && clipboardRef.current && menu) {
      recordCanvasEdit("paste", () =>
        editor.putContentOntoCurrentPage(clipboardRef.current!, {
          select: true,
          point: editor.screenToPage({ x: menu.x, y: menu.y })
        })
      );
    } else if (action === "duplicate") {
      recordCanvasEdit("duplicate", () => editor.duplicateShapes(ids, { x: 24, y: 24 }));
    } else if (action === "delete") {
      recordCanvasEdit("delete", () => editor.deleteShapes(ids));
    } else if (action === "bring-forward") {
      recordCanvasEdit("bring forward", () => editor.bringForward(ids));
    } else if (action === "send-backward") {
      recordCanvasEdit("send backward", () => editor.sendBackward(ids));
    } else if (action === "group") {
      recordCanvasEdit("group", () => editor.groupShapes(ids));
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
      recordCanvasEdit("align", () => editor.alignShapes(ids, alignment[action]));
    } else if (action === "distribute-horizontal" || action === "distribute-vertical") {
      recordCanvasEdit("distribute", () =>
        editor.distributeShapes(ids, action === "distribute-horizontal" ? "horizontal" : "vertical")
      );
    } else if (action === "snap") {
      editor.user.updateUserPreferences({ isSnapMode: !editor.user.getIsSnapMode() });
    } else if (action === "export-svg" || action === "export-png-1" || action === "export-png-2") {
      if (action === "export-svg") {
        const exported = await editor.getSvgString(ids);
        if (!exported?.svg) {
          onNotice("The selection could not be exported.");
          return;
        }
        downloadExport(
          sanitizeSvg(stableExportSvgIds(exported.svg)),
          safeExportFileName("selection", "svg"),
          "image/svg+xml"
        );
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
    editor.run(
      () => {
        if (hit) {
          if (!editor.getSelectedShapeIds().includes(hit.id)) editor.select(hit.id);
        } else {
          editor.selectNone();
        }
      },
      { history: "ignore" }
    );
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

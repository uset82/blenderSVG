export type CanvasMenuAction =
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "bring-forward"
  | "send-backward"
  | "group"
  | "undo"
  | "redo"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "snap"
  | "export-svg"
  | "export-png-1"
  | "export-png-2"
  | "ask-agent";

export interface CanvasMenuItem {
  id: CanvasMenuAction;
  label: string;
  enabled: boolean;
  shortcut?: string;
  reason?: string;
}

function item(
  id: CanvasMenuAction,
  label: string,
  enabled: boolean,
  reason: string,
  shortcut?: string
): CanvasMenuItem {
  return enabled
    ? { id, label, enabled, ...(shortcut ? { shortcut } : {}) }
    : { id, label, enabled, reason, ...(shortcut ? { shortcut } : {}) };
}

export function canvasMenuItems(input: {
  selectedCount: number;
  canPaste: boolean;
  snapEnabled: boolean;
}): CanvasMenuItem[] {
  const hasSelection = input.selectedCount > 0;
  const selectionReason = "Select something on the canvas first.";
  const alignReason = "Select at least two shapes.";
  const distributeReason = "Select at least three shapes.";
  const canAlign = input.selectedCount > 1;
  const canDistribute = input.selectedCount > 2;
  return [
    item("undo", "Undo", true, "", "Ctrl+Z"),
    item("redo", "Redo", true, "", "Ctrl+Shift+Z"),
    item("cut", "Cut", hasSelection, selectionReason),
    item("copy", "Copy", hasSelection, selectionReason, "Ctrl+C"),
    item("paste", "Paste", input.canPaste, "Copy a selection in this canvas first.", "Ctrl+V"),
    item("duplicate", "Duplicate", hasSelection, selectionReason, "Ctrl+D"),
    item("delete", "Delete", hasSelection, selectionReason),
    item("bring-forward", "Bring forward", hasSelection, selectionReason),
    item("send-backward", "Send backward", hasSelection, selectionReason),
    item("group", "Group", input.selectedCount > 1, "Select at least two shapes to group them.", "Ctrl+G"),
    item("align-left", "Align left", canAlign, alignReason),
    item("align-center", "Align center", canAlign, alignReason),
    item("align-right", "Align right", canAlign, alignReason),
    item("align-top", "Align top", canAlign, alignReason),
    item("align-middle", "Align middle", canAlign, alignReason),
    item("align-bottom", "Align bottom", canAlign, alignReason),
    item("distribute-horizontal", "Distribute horizontally", canDistribute, distributeReason),
    item("distribute-vertical", "Distribute vertically", canDistribute, distributeReason),
    item("snap", input.snapEnabled ? "Turn snapping off" : "Turn snapping on", true, "", "Ctrl+Shift+S"),
    item("export-svg", "Export SVG", hasSelection, selectionReason),
    item("export-png-1", "Export PNG 1×", hasSelection, selectionReason),
    item("export-png-2", "Export PNG 2×", hasSelection, selectionReason),
    item("ask-agent", "Ask agent about selection", hasSelection, selectionReason)
  ];
}

export function describeSelection(
  shapes: ReadonlyArray<{ type: string; label: string; w?: number; h?: number }>
): string {
  if (shapes.length === 0) return "";
  const shown = shapes.slice(0, 8).map((shape) => {
    const size =
      typeof shape.w === "number" && typeof shape.h === "number"
        ? ` (${Math.round(shape.w)}×${Math.round(shape.h)})`
        : "";
    return `${shape.type} “${shape.label}”${size}`;
  });
  const extra = shapes.length > 8 ? ` and ${shapes.length - 8} more` : "";
  return `About this selection: ${shown.join(", ")}${extra}.`;
}

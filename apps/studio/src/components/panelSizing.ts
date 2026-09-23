export type ResizablePanel = "chat" | "inspector";
export type PanelSizeAxis = "width" | "height";

interface PanelSizeRange {
  initial: number;
  minimum: number;
  maximum: number;
}

const PANEL_SIZE_RANGES: Record<ResizablePanel, Record<PanelSizeAxis, PanelSizeRange>> = {
  chat: {
    width: { initial: 340, minimum: 280, maximum: 520 },
    height: { initial: 380, minimum: 180, maximum: 520 }
  },
  inspector: {
    width: { initial: 280, minimum: 240, maximum: 420 },
    height: { initial: 260, minimum: 140, maximum: 420 }
  }
};

export function getPanelSizeRange(
  panel: ResizablePanel,
  axis: PanelSizeAxis,
  workspaceHeight?: number
): PanelSizeRange {
  const range = PANEL_SIZE_RANGES[panel][axis];
  if (axis !== "height" || workspaceHeight === undefined) return range;
  return {
    ...range,
    maximum: Math.max(range.minimum, Math.floor(Math.min(range.maximum, workspaceHeight * 0.48, workspaceHeight - 188)))
  };
}

export function clampPanelSize(
  panel: ResizablePanel,
  axis: PanelSizeAxis,
  size: number,
  workspaceHeight?: number
): number {
  const range = getPanelSizeRange(panel, axis, workspaceHeight);
  if (!Number.isFinite(size)) return range.initial;
  return Math.round(Math.min(range.maximum, Math.max(range.minimum, size)));
}

export function readPanelSize(
  panel: ResizablePanel,
  axis: PanelSizeAxis,
  storage: Pick<Storage, "getItem"> = window.localStorage
): number {
  const initial = getPanelSizeRange(panel, axis).initial;
  try {
    const stored = storage.getItem(`codex-avatar-studio-panel-${panel}-${axis}`);
    return stored === null ? initial : clampPanelSize(panel, axis, Number(stored));
  } catch {
    return initial;
  }
}

export function writePanelSize(
  panel: ResizablePanel,
  axis: PanelSizeAxis,
  size: number,
  storage: Pick<Storage, "setItem"> = window.localStorage
): void {
  try {
    storage.setItem(`codex-avatar-studio-panel-${panel}-${axis}`, String(clampPanelSize(panel, axis, size)));
  } catch {
    // Panel sizing is a preference; the current workspace still resizes without storage.
  }
}

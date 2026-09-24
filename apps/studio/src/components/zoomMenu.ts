export type ZoomCommand = "fit" | "selection" | "50" | "100" | "200";

export interface ZoomMenuItem {
  id: ZoomCommand;
  label: string;
  shortcut?: string;
  enabled: boolean;
  reason?: string;
}

export function zoomMenuItems(canZoomSelection: boolean): ZoomMenuItem[] {
  return [
    { id: "fit", label: "Zoom to fit", shortcut: "Shift+1", enabled: true },
    canZoomSelection
      ? { id: "selection", label: "Zoom to selection", shortcut: "Shift+2", enabled: true }
      : {
          id: "selection",
          label: "Zoom to selection",
          shortcut: "Shift+2",
          enabled: false,
          reason: "Select something on the canvas first."
        },
    { id: "50", label: "50%", enabled: true },
    { id: "100", label: "100%", enabled: true },
    { id: "200", label: "200%", enabled: true }
  ];
}

export function zoomScale(command: ZoomCommand): number | null {
  if (command === "50") return 0.5;
  if (command === "100") return 1;
  if (command === "200") return 2;
  return null;
}

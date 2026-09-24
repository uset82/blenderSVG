export type ComposerMenuAction = "add-file" | "trace-image" | "add-canvas" | "choose-style" | "pick-skill";

export interface ComposerMenuItem {
  id: ComposerMenuAction;
  label: string;
  enabled: boolean;
  reason?: string;
}

export function composerMenuItems(input: { hasEditor: boolean; selectedCount: number }): ComposerMenuItem[] {
  const canvasEnabled = input.hasEditor && input.selectedCount > 0;
  return [
    { id: "add-file", label: "Add image or file", enabled: true },
    { id: "trace-image", label: "Trace image locally", enabled: true },
    canvasEnabled
      ? { id: "add-canvas", label: "Add from canvas", enabled: true }
      : {
          id: "add-canvas",
          label: "Add from canvas",
          enabled: false,
          reason: input.hasEditor ? "Select something on the canvas first." : "Open a canvas before adding a selection."
        },
    input.hasEditor
      ? { id: "choose-style", label: "Choose a style", enabled: true }
      : {
          id: "choose-style",
          label: "Choose a style",
          enabled: false,
          reason: "Open a canvas before choosing a style."
        },
    {
      id: "pick-skill",
      label: "Pick a skill",
      enabled: false,
      reason: "Skills are not connected to this chat yet."
    }
  ];
}

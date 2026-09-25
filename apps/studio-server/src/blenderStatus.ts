export type BlenderSupportState = "supported" | "unsupported" | "not-found";

export function blenderStatusMessage(
  supportState: BlenderSupportState,
  version: string | null
): {
  supportState: BlenderSupportState;
  message: string;
} {
  if (supportState === "not-found") {
    return {
      supportState,
      message: "Blender was not found. Studio can still edit SVG locally, and no scene file is changed."
    };
  }
  if (supportState === "supported") {
    return {
      supportState,
      message: `Blender ${version ?? "is available"}. Send to Blender writes a new copy and does not modify a source scene.`
    };
  }
  return {
    supportState,
    message: "This Blender install is not supported. No scene file is changed."
  };
}

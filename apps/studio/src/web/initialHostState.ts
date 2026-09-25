import { STUDIO_PROTOCOL_VERSION, type StudioHostKind } from "@codex-avatar-studio/avatar-core";
import { OFFLINE_HOST_MESSAGE } from "../bridge/studioTransports.js";
import { WEB_LIBRARY_STATUS } from "./kurvaTarget.js";

export interface InitialHostInput {
  webEdition: boolean;
  vscode: boolean;
  standalone: boolean;
}

/** The first host state. Web mode does not look for VS Code or a launch token. */
export function createInitialHostState(input: InitialHostInput): {
  protocolVersion: typeof STUDIO_PROTOCOL_VERSION;
  type: "studio:hostState";
  host: StudioHostKind;
  workspaceTrusted: boolean;
  connection: { status: "disconnected" | "checking"; message: string };
} {
  if (input.webEdition) {
    return {
      protocolVersion: STUDIO_PROTOCOL_VERSION,
      type: "studio:hostState",
      host: "web",
      workspaceTrusted: false,
      connection: { status: "disconnected", message: WEB_LIBRARY_STATUS }
    };
  }
  const standalone = !input.vscode && input.standalone;
  return {
    protocolVersion: STUDIO_PROTOCOL_VERSION,
    type: "studio:hostState",
    host: input.vscode ? "vscode" : standalone ? "standalone" : "browser",
    workspaceTrusted: standalone,
    connection: {
      status: standalone ? "checking" : "disconnected",
      message: input.vscode
        ? "Checking the Studio connection…"
        : standalone
          ? "Connecting to the local Studio host…"
          : OFFLINE_HOST_MESSAGE
    }
  };
}

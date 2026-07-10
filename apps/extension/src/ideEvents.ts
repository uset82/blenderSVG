import * as vscode from "vscode";
import {
  mapEventToAvatarState,
  mapEventToAvatarTrigger,
  type AvatarState,
  type AvatarTrigger,
  type IdeAssistantEvent
} from "@codex-avatar-studio/avatar-core";

export type AvatarEventSink = {
  setState(state: AvatarState): void;
  trigger(trigger: AvatarTrigger): void;
  debugEvent(event: string, payload?: unknown): void;
};

export class IdeEventsController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private diagnosticsTimer: ReturnType<typeof setTimeout> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(private readonly sink: AvatarEventSink) {}

  public start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.emit("active_editor_changed", { languageId: editor?.document.languageId });
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!event.document.isClosed && event.contentChanges.length > 0) {
          this.emit(
            "text_document_changed",
            { languageId: event.document.languageId },
            { returnToIdle: true, idleDelayMs: 1200 }
          );
        }
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.emit(
          "file_saved",
          { languageId: document.languageId, fileName: document.fileName },
          { returnToIdle: true }
        );
      }),
      vscode.languages.onDidChangeDiagnostics((event) => {
        this.debounceDiagnostics(event);
      }),
      vscode.debug.onDidStartDebugSession((session) => {
        this.emit("debug_started", { type: session.type, name: session.name });
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.emit("debug_stopped", { type: session.type, name: session.name }, { returnToIdle: true });
      }),
      vscode.tasks.onDidStartTask((event) => {
        this.emit("task_started", { name: event.execution.task.name });
      }),
      vscode.tasks.onDidEndTask((event) => {
        this.emit("task_finished", { name: event.execution.task.name }, { returnToIdle: true });
      })
    );

    this.emit("extension_ready", undefined, { returnToIdle: true, idleDelayMs: 2200 });
  }

  public setManualState(state: AvatarState, trigger?: AvatarTrigger): void {
    this.clearIdleTimer();
    this.sink.setState(state);
    if (trigger) {
      this.sink.trigger(trigger);
    }
    this.sink.debugEvent(`manual:${state}`);

    if (state === "success" || state === "warning" || state === "error") {
      this.scheduleIdle();
    }
  }

  public dispose(): void {
    this.clearDiagnosticsTimer();
    this.clearIdleTimer();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private debounceDiagnostics(event: vscode.DiagnosticChangeEvent): void {
    this.clearDiagnosticsTimer();
    this.diagnosticsTimer = setTimeout(() => {
      const state = this.getDiagnosticsState(event.uris);
      this.applyState(
        state,
        "diagnostics_changed",
        { uriCount: event.uris.length },
        { returnToIdle: state !== "reviewing" }
      );
    }, 350);
  }

  private getDiagnosticsState(uris: readonly vscode.Uri[]): AvatarState {
    const diagnostics = uris.flatMap((uri) => vscode.languages.getDiagnostics(uri));
    if (diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error)) {
      return "error";
    }
    if (diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning)) {
      return "warning";
    }
    return mapEventToAvatarState("diagnostics_changed");
  }

  private emit(
    event: IdeAssistantEvent,
    payload?: unknown,
    options: { returnToIdle?: boolean; idleDelayMs?: number } = {}
  ): void {
    this.applyState(mapEventToAvatarState(event), event, payload, options);
    const trigger = mapEventToAvatarTrigger(event);
    if (trigger) {
      this.sink.trigger(trigger);
    }
  }

  private applyState(
    state: AvatarState,
    event: string,
    payload?: unknown,
    options: { returnToIdle?: boolean; idleDelayMs?: number } = {}
  ): void {
    this.clearIdleTimer();
    this.sink.setState(state);
    this.sink.debugEvent(event, payload);

    if (options.returnToIdle) {
      this.scheduleIdle(options.idleDelayMs);
    }
  }

  private scheduleIdle(delayMs = 1800): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.sink.setState("idle");
      this.sink.debugEvent("idle_timeout");
    }, delayMs);
  }

  private clearDiagnosticsTimer(): void {
    if (this.diagnosticsTimer) {
      clearTimeout(this.diagnosticsTimer);
      this.diagnosticsTimer = undefined;
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }
}

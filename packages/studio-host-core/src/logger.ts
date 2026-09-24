/** Host log sink. A VS Code output channel satisfies this. */
export interface Logger {
  appendLine(value: string): void;
}

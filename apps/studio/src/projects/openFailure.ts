/** Home notice when a saved project exists but its canvas data cannot be loaded. */
export function projectOpenFailureMessage(title: string | null | undefined): string {
  const name = title?.trim() ? `“${title.trim()}”` : "This project";
  return `${name} could not be opened: its file is not a valid Kurva canvas, possibly because another tool wrote it. Delete it from its … menu, or restore a backup.`;
}

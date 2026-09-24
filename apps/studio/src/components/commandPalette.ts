export interface PaletteCommand {
  id: string;
  group: "Tools" | "Actions" | "Projects";
  label: string;
  keywords: string;
}

export function filterPaletteCommands(commands: readonly PaletteCommand[], query: string): PaletteCommand[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...commands];
  return commands.filter((command) =>
    `${command.label} ${command.keywords} ${command.group}`.toLocaleLowerCase().includes(normalized)
  );
}

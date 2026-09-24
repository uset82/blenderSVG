import { useEffect, useMemo, useState } from "react";
import { filterPaletteCommands, type PaletteCommand } from "./commandPalette.js";

export function StudioCommandPalette({
  open,
  commands,
  onRun,
  onClose
}: {
  open: boolean;
  commands: readonly PaletteCommand[];
  onRun: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterPaletteCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="studio-command-palette" role="presentation" onMouseDown={onClose}>
      <div
        className="studio-command-palette__panel"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          aria-label="Search commands"
          placeholder="Search tools, actions, and projects"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && visible[0]) {
              onRun(visible[0].id);
              onClose();
            }
          }}
        />
        <ul role="listbox" aria-label="Commands">
          {visible.length === 0 ? (
            <li>No matching commands.</li>
          ) : (
            visible.map((command) => (
              <li key={command.id}>
                <button
                  type="button"
                  role="option"
                  onClick={() => {
                    onRun(command.id);
                    onClose();
                  }}
                >
                  <span>{command.label}</span>
                  <span>{command.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

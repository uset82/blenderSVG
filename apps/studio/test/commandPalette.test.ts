import { describe, expect, it } from "vitest";
import { filterPaletteCommands, type PaletteCommand } from "../src/components/commandPalette.js";

const commands: PaletteCommand[] = [
  { id: "tool-select", group: "Tools", label: "Select", keywords: "v" },
  { id: "action-export", group: "Actions", label: "Export project", keywords: "download" },
  { id: "project-scratch", group: "Projects", label: "Scratchpad", keywords: "page" }
];

describe("command palette", () => {
  it("lists tools, actions, and projects before a query", () => {
    expect(filterPaletteCommands(commands, "").map((command) => command.group)).toEqual([
      "Tools",
      "Actions",
      "Projects"
    ]);
  });

  it("filters by label across groups", () => {
    expect(filterPaletteCommands(commands, "export").map((command) => command.id)).toEqual(["action-export"]);
    expect(filterPaletteCommands(commands, "scratch")).toEqual([commands[2]]);
  });
});

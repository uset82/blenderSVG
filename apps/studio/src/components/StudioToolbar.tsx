import { Frame, Hand, MousePointer2, PenLine, RectangleHorizontal, Type } from "lucide-react";

export interface StudioToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  onAddShape: (type: "frame" | "avatar" | "vector-studio" | "blender-connector" | "geo" | "text") => void;
}

export function StudioToolbar({ activeTool, onSelectTool, onAddShape }: StudioToolbarProps) {
  const tools = [
    { id: "select", label: "Select (V)", icon: MousePointer2 },
    { id: "hand", label: "Hand (H)", icon: Hand },
    {
      id: "frame",
      label: "Frame (F)",
      icon: Frame,
      action: () => onAddShape("frame")
    },
    {
      id: "geo",
      label: "Rectangle (R)",
      icon: RectangleHorizontal,
      action: () => onAddShape("geo")
    },
    {
      id: "text",
      label: "Text (T)",
      icon: Type,
      action: () => onAddShape("text")
    },
    {
      id: "draw",
      label: "Pen (P)",
      icon: PenLine
    }
  ];

  return (
    <nav
      className="studio-toolbar"
      aria-label="Canvas tools"
    >
      {tools.map((t) => {
        const isSelected = activeTool === t.id;

        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-pressed={t.action ? undefined : isSelected}
            onClick={() => {
              if (t.action) {
                t.action();
                onSelectTool("select");
              } else {
                onSelectTool(t.id);
              }
            }}
            title={t.label}
            className="studio-toolbar__button"
          >
            <t.icon size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

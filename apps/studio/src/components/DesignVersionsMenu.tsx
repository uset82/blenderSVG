import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";
import {
  captureDesignFrames,
  type DesignVersionSummary,
  readEditorDesignVersions,
  restoreDesignVersion,
  summarizeDesignVersions
} from "./designVersions.js";

/** The agent panel's version history: one entry per design reply, each restorable in one step. */
export function DesignVersionsMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DesignVersionSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const toggle = () => {
    if (!open) setVersions(summarizeDesignVersions(readEditorDesignVersions(editor), captureDesignFrames(editor)));
    setOpen(!open);
  };

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div className="studio-agent__versions" ref={containerRef}>
      <button
        ref={triggerRef}
        className="studio-agent__button studio-agent__button--icon"
        type="button"
        aria-label="Design versions"
        title="Design versions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="studio-agent-versions"
        onClick={toggle}
      >
        <History size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="studio-agent-versions"
          className="studio-agent__versions-menu"
          role="menu"
          aria-label="Design versions"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          <p className="studio-agent__versions-note">
            {versions.length === 0
              ? "No versions yet. Each design reply saves one here."
              : "Each design reply saves a version. Restore puts its design frames back; Undo reverses it."}
          </p>
          {versions.map((version) => (
            <button
              key={version.id}
              type="button"
              role="menuitem"
              aria-current={version.current ? "true" : undefined}
              disabled={version.current}
              onClick={() => {
                restoreDesignVersion(editor, version.id);
                close();
              }}
            >
              <span>
                v{version.number} · {version.label}
              </span>
              <span>
                {formatStamp(version.createdAt)} · {version.frameCount} frame{version.frameCount === 1 ? "" : "s"} ·{" "}
                {version.current ? "On the canvas" : "Restore"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

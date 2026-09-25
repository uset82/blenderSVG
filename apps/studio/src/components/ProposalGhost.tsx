import { useEffect, useState } from "react";
import type { Editor } from "tldraw";
import type { CanvasProposal } from "./canvasProposal.js";

interface GhostBox {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface GhostViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function ProposalGhost({ editor, proposal }: { editor: Editor; proposal: CanvasProposal }) {
  const [boxes, setBoxes] = useState<GhostBox[]>([]);
  const [viewport, setViewport] = useState<GhostViewport | null>(null);

  useEffect(() => {
    const update = () => {
      const canvas = document.querySelector(".studio-canvas-content");
      if (!(canvas instanceof HTMLElement)) return;
      const bounds = canvas.getBoundingClientRect();
      setViewport({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });
      setBoxes(
        proposal.shapes.map((shape) => {
          const topLeft = editor.pageToScreen({ x: shape.x, y: shape.y });
          const bottomRight = editor.pageToScreen({ x: shape.x + shape.w, y: shape.y + shape.h });
          return {
            id: shape.id,
            label: shape.label,
            left: topLeft.x - bounds.left,
            top: topLeft.y - bounds.top,
            width: Math.max(1, bottomRight.x - topLeft.x),
            height: Math.max(1, bottomRight.y - topLeft.y)
          };
        })
      );
    };
    update();
    const unlisten = editor.store.listen(update);
    const canvas = document.querySelector(".studio-canvas-content");
    const observer = canvas ? new ResizeObserver(update) : null;
    if (canvas && observer) observer.observe(canvas);
    window.addEventListener("resize", update);
    return () => {
      unlisten();
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [editor, proposal]);

  if (!viewport) return null;

  return (
    <div className="studio-proposal-ghost" style={viewport} aria-hidden="true">
      {boxes.map((box) => (
        <div
          key={box.id}
          className="studio-proposal-ghost__shape"
          data-proposal-shape={box.label}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          <div className="studio-proposal-ghost__caption">
            <span>{box.label}</span>
            <span className="studio-proposal-ghost__badge">Proposed</span>
            <span className="studio-proposal-ghost__note">Apply to keep · Reject to discard</span>
          </div>
        </div>
      ))}
    </div>
  );
}

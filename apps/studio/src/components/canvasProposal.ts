export interface ProposalShape {
  id: string;
  type: "geo" | "text" | "design-frame";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface CanvasProposal {
  id: string;
  summary: string;
  shapes: ProposalShape[];
}

export interface ProposalEditor {
  markHistoryStoppingPoint: (name: string) => void;
  createShape: (shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> }) => void;
}

export function applyProposal(editor: ProposalEditor, proposal: CanvasProposal): void {
  editor.markHistoryStoppingPoint(`apply ${proposal.id}`);
  for (const shape of proposal.shapes) {
    editor.createShape({
      id: shape.id,
      type: shape.type === "geo" ? "geo" : shape.type,
      x: shape.x,
      y: shape.y,
      props: { w: shape.w, h: shape.h, name: shape.label }
    });
  }
}

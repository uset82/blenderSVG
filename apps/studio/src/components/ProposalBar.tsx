import type { CanvasProposal } from "./canvasProposal.js";

export function ProposalBar({
  proposal,
  onApply,
  onReject
}: {
  proposal: CanvasProposal;
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <section className="studio-proposal" aria-label="Pending canvas changes">
      <p>{proposal.summary}</p>
      <ul>
        {proposal.shapes.map((shape) => (
          <li key={shape.id}>
            {shape.label} · {shape.type} · {Math.round(shape.w)}×{Math.round(shape.h)}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onApply}>
        Apply
      </button>
      <button type="button" onClick={onReject}>
        Reject
      </button>
      <p className="studio-proposal__note">Apply to keep · Reject to discard</p>
    </section>
  );
}

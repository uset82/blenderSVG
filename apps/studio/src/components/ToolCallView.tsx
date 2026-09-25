import { argumentSummary, durationLabel, type ToolCallRecord } from "./toolCallCard.js";

export function ToolCallCard({
  call,
  modelName,
  onApprove,
  onReject,
  onUndo
}: {
  call: ToolCallRecord & {
    summary?: string;
    readOnly?: boolean;
    requiresApproval?: boolean;
    imageDataUrl?: string;
  };
  modelName?: string | undefined;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUndo?: (id: string) => void;
}) {
  return (
    <article
      className={`studio-tool-card${call.status === "proposed" ? " studio-tool-card--proposed" : ""}`}
      aria-label={`${call.name} tool call`}
      aria-live="polite"
    >
      <header className="studio-tool-card__header">
        <strong className="studio-tool-card__name">{call.name}</strong>
        <span className="studio-tool-card__meta">
          {call.durationMs !== null ? <span>{durationLabel(call.durationMs)}</span> : null}
          <span
            className={
              call.status === "proposed"
                ? "studio-tool-card__status studio-tool-card__status--approval"
                : "studio-tool-card__status"
            }
          >
            {call.status === "proposed" ? "Needs approval" : call.status}
          </span>
        </span>
      </header>
      {call.summary ? <p>{call.summary}</p> : null}
      <details>
        <summary>Review exact arguments · {argumentSummary(call.arguments)}</summary>
        <pre>{formatArguments(call.arguments)}</pre>
      </details>
      {call.status === "proposed" && (
        <p className="studio-tool-card__privacy">
          {call.requiresApproval === false
            ? `Auto mode applies this local canvas change as one Undo step. Its bounded result will be sent to ${modelName ?? "the selected model"}.`
            : call.name === "screenshot_frame"
              ? `A PNG of this frame will be sent to ${modelName ?? "the selected model"} after approval.`
              : call.readOnly
                ? `This reads local canvas details. Its bounded result will be sent to ${modelName ?? "the selected model"} after approval.`
                : "This changes the local canvas after approval. The bounded result will then be sent to the selected model."}
        </p>
      )}
      {call.imageDataUrl ? <img src={call.imageDataUrl} alt={`PNG from ${call.name.replaceAll("_", " ")}`} /> : null}
      {call.result ? <p className="studio-tool-card__result">{call.result}</p> : null}
      {call.status === "proposed" && call.requiresApproval !== false && (
        <div className="studio-tool-card__actions">
          <button type="button" onClick={() => onApprove(call.id)}>
            Approve and run
          </button>
          <button type="button" onClick={() => onReject(call.id)}>
            Reject
          </button>
        </div>
      )}
      {call.status === "applied" && call.readOnly !== true && onUndo ? (
        <div className="studio-tool-card__actions">
          <button type="button" onClick={() => onUndo(call.id)}>
            Undo
          </button>
        </div>
      ) : null}
    </article>
  );
}

function formatArguments(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

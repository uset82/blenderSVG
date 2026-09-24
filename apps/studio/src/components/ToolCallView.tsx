import { argumentSummary, durationLabel, type ToolCallRecord } from "./toolCallCard.js";

export function ToolCallCard({
  call,
  modelName,
  onApprove,
  onReject
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
}) {
  return (
    <article className="studio-tool-card" aria-label={`${call.name} tool call`} aria-live="polite">
      <header className="studio-tool-card__header">
        <strong>{call.name.replaceAll("_", " ")}</strong>
        <span>{call.status}</span>
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
      {call.durationMs !== null ? <p>{durationLabel(call.durationMs)}</p> : null}
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

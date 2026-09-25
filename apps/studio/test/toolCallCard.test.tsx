import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "../src/components/ToolCallView.js";
import { argumentSummary, withToolTiming } from "../src/components/toolCallCard.js";

describe("tool call card", () => {
  it("shows the exact proposed action and explicit privacy approval", () => {
    expect(argumentSummary(` ${"a".repeat(90)} `).endsWith("…")).toBe(true);
    const html = renderToStaticMarkup(
      <ToolCallCard
        call={{
          id: "call-1",
          name: "get_selection",
          arguments: '{"ids":["shape:1"]}',
          status: "proposed",
          durationMs: 12,
          result: null,
          readOnly: true
        }}
        onApprove={() => undefined}
        onReject={() => undefined}
        modelName="Selected model"
      />
    );
    expect(html).toContain("get_selection");
    expect(html).toContain("studio-tool-card--proposed");
    expect(html).toContain("12 ms");
    expect(html).toContain("Review exact arguments");
    expect(html).toContain("Approve and run");
    expect(html).toContain("Selected model");
    expect(html).not.toContain("Undo");
    const applied = renderToStaticMarkup(
      <ToolCallCard
        call={{
          id: "call-2",
          name: "create_frame",
          arguments: '{"name":"Landing","width":800,"height":600}',
          status: "applied",
          durationMs: 42,
          result: "Applied 1 previewed shapes.",
          readOnly: false
        }}
        onApprove={() => undefined}
        onReject={() => undefined}
        onUndo={() => undefined}
      />
    );
    expect(applied).toContain("42 ms");
    expect(applied).toContain("Undo");
    expect(applied).toContain("Applied 1 previewed shapes.");
    const finished = withToolTiming(
      {
        id: "call-2",
        name: "create_frame",
        arguments: "{}",
        status: "running",
        durationMs: null,
        startedAt: 1_000,
        result: null
      },
      "applied",
      1_048
    );
    expect(finished.durationMs).toBe(48);
  });
});

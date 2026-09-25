/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalBar } from "../src/components/ProposalBar.js";

describe("proposal bar", () => {
  it("applies the pending canvas change from the button", () => {
    const onApply = vi.fn();
    const onReject = vi.fn();
    render(
      <ProposalBar
        proposal={{
          id: "proposal-1",
          summary: "Add a frame",
          shapes: [{ id: "shape:a", type: "frame", x: 0, y: 0, w: 100, h: 40, label: "Title" }]
        }}
        onApply={onApply}
        onReject={onReject}
      />
    );
    expect(screen.getByText("Apply to keep · Reject to discard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onReject).not.toHaveBeenCalled();
  });
});

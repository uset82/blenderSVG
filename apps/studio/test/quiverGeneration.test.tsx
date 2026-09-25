/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuiverSvg, getQuiverStatus, updateQuiverSettings } from "../src/projects/quiverClient.js";
import { VectorAssetDialog } from "../src/components/VectorAssetDialog.js";

vi.mock("../src/projects/quiverClient.js", () => ({
  generateQuiverSvg: vi.fn(),
  getQuiverStatus: vi.fn(),
  updateQuiverSettings: vi.fn()
}));

describe("QuiverAI optional generation", () => {
  beforeEach(() => {
    vi.mocked(getQuiverStatus).mockResolvedValue({
      available: true,
      configured: true,
      enabled: false,
      message: "QuiverAI is connected to the local Studio host."
    });
    vi.mocked(updateQuiverSettings).mockImplementation(async (action) => ({
      available: true,
      configured: true,
      enabled: action === "enable",
      message: action === "enable" ? "QuiverAI enabled for this session." : "QuiverAI disabled."
    }));
    vi.mocked(generateQuiverSvg).mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>',
      usage: { totalTokens: 42 }
    });
  });

  it("starts disabled, reveals the exact outbound prompt, and waits for explicit consent", async () => {
    const onInsert = vi.fn();
    render(<VectorAssetDialog onClose={vi.fn()} onTrace={vi.fn()} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: /Generate with QuiverAI/ }));
    const enable = await screen.findByRole("checkbox", { name: /Enable QuiverAI for this Studio session/ });
    expect(enable).toHaveProperty("checked", false);
    expect(screen.getByText(/may charge your account/)).toBeTruthy();

    const consent = screen.getByRole("checkbox", { name: /reviewed the exact prompt and image disclosure/ });
    expect(consent).toHaveProperty("disabled", true);
    fireEvent.click(enable);
    await waitFor(() => expect(enable).toHaveProperty("checked", true));

    const disclosure = screen.getByText("Review exactly what will be sent");
    fireEvent.click(disclosure);
    const prompt = screen.getByRole("textbox", { name: "QuiverAI generation prompt" }) as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "A blue paper kite, flat geometry" } });
    expect(screen.getAllByText("A blue paper kite, flat geometry")).toHaveLength(2);
    expect(screen.getByText("No image is attached.")).toBeTruthy();
    expect(screen.getByText(/Provider: api\.quiver\.ai/)).toBeTruthy();

    const generate = screen.getByRole("button", { name: "Generate SVG" });
    expect(generate).toHaveProperty("disabled", true);
    fireEvent.click(consent);
    expect(generate).toHaveProperty("disabled", false);
    fireEvent.click(generate);

    await screen.findByAltText("Sanitized generated SVG");
    expect(generateQuiverSvg).toHaveBeenCalledWith({
      model: "arrow-1.1",
      prompt: "A blue paper kite, flat geometry",
      referenceImage: null,
      signal: expect.any(AbortSignal)
    });
    expect(onInsert).not.toHaveBeenCalled();
    expect(screen.getByText(/42 provider tokens reported/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Insert on canvas" }));
    await waitFor(() => expect(onInsert).toHaveBeenCalledWith(expect.stringContaining("<svg"), "quiver-generated.svg"));
  });
});

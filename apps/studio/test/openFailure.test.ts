import { describe, expect, it } from "vitest";
import { projectOpenFailureMessage } from "../src/projects/openFailure.js";

describe("project open failure notice", () => {
  it("names the project and says what to do", () => {
    const message = projectOpenFailureMessage("  Claude desk ");
    expect(message).toContain("“Claude desk” could not be opened");
    expect(message).toContain("Delete it");
  });

  it("falls back when the title is empty", () => {
    expect(projectOpenFailureMessage("")).toMatch(/^This project could not be opened/);
    expect(projectOpenFailureMessage(null)).toMatch(/^This project could not be opened/);
  });
});

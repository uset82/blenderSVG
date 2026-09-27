import { STUDIO_TOOL_ARGUMENT_LIMIT, STUDIO_TOOL_RESULT_LIMIT } from "@codex-avatar-studio/avatar-core";
import { MAX_DESIGN_RESULT_CHARS, MAX_TOOL_ARGUMENT_CHARS } from "@codex-avatar-studio/studio-agent/limits";
import { describe, expect, it } from "vitest";

describe("agent limits", () => {
  it("keeps the bridge protocol limits equal to the agent limits", () => {
    expect(STUDIO_TOOL_ARGUMENT_LIMIT).toBe(MAX_TOOL_ARGUMENT_CHARS);
    expect(STUDIO_TOOL_RESULT_LIMIT).toBe(MAX_DESIGN_RESULT_CHARS);
  });
});

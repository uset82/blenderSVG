import { describe, expect, it } from "vitest";
import { CONNECTOR_SNIPPETS, connectorSnippetsForLaunch } from "../src/components/connectorSnippets.js";

describe("connector snippets", () => {
  it("lists every IDE with a loopback endpoint and no baked-in token", () => {
    expect(CONNECTOR_SNIPPETS.map((item) => item.name)).toEqual([
      "Codex",
      "Claude Code",
      "Cursor",
      "Qoder",
      "WorkBuddy",
      "VS Code"
    ]);
    expect(CONNECTOR_SNIPPETS.find((item) => item.id === "codex")?.file).toBe("~/.codex/config.toml");
    expect(CONNECTOR_SNIPPETS.find((item) => item.id === "cursor")?.file).toBe(".cursor/mcp.json");
    for (const connector of CONNECTOR_SNIPPETS) {
      expect(connector.snippet).toContain("http://127.0.0.1:<port>/mcp");
      expect(connector.snippet).toContain("BLENDERSVG_MCP_TOKEN");
      expect(connector.snippet).not.toMatch(/sk-|Bearer [A-Za-z0-9]{8,}/);
    }
    const live = connectorSnippetsForLaunch("http://127.0.0.1:8787", "launch-token");
    expect(live[0]?.snippet).toContain("http://127.0.0.1:8787/mcp?studioToken=launch-token");
    expect(live[0]?.snippet).not.toContain("<port>");
  });
});

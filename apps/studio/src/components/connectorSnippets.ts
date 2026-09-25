export interface ConnectorSnippet {
  id: string;
  name: string;
  file: string;
  snippet: string;
}

export interface LiveConnectorSnippet extends ConnectorSnippet {
  /** Snippet with the session launch token for clipboard use. */
  copySnippet: string;
}

const endpoint = "http://127.0.0.1:<port>/mcp";

/**
 * Builds Connectors-page snippets. The visible `snippet` keeps the loopback `/mcp`
 * URL without embedding the launch token (Target UI + screenshot safety). `copySnippet`
 * includes `?studioToken=` so Host/Origin + launch-token checks succeed for IDE clients
 * that do not carry the browser session cookie.
 */
export function connectorSnippetsForLaunch(pageOrigin: string, launchToken: string): LiveConnectorSnippet[] {
  const origin = pageOrigin.replace(/\/$/, "");
  const displayUrl = `${origin}/mcp`;
  const copyUrl = `${displayUrl}?studioToken=${encodeURIComponent(launchToken)}`;
  return CONNECTOR_SNIPPETS.map((connector) => ({
    ...connector,
    snippet: connector.snippet.replaceAll(endpoint, displayUrl),
    copySnippet: connector.snippet.replaceAll(endpoint, copyUrl)
  }));
}

export const CONNECTOR_SNIPPETS: readonly ConnectorSnippet[] = [
  {
    id: "codex",
    name: "Codex",
    file: "~/.codex/config.toml",
    snippet: `[mcp_servers.blendersvg]\nurl = "${endpoint}"\nbearer_token_env_var = "BLENDERSVG_MCP_TOKEN"`
  },
  {
    id: "claude",
    name: "Claude Code",
    file: "claude mcp add",
    snippet: `claude mcp add --transport http blendersvg ${endpoint} --header "Authorization: Bearer $BLENDERSVG_MCP_TOKEN"`
  },
  {
    id: "cursor",
    name: "Cursor",
    file: ".cursor/mcp.json",
    snippet: `{\n  "mcpServers": {\n    "blendersvg": {\n      "url": "${endpoint}",\n      "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" }\n    }\n  }\n}`
  },
  {
    id: "qoder",
    name: "Qoder",
    file: "Qoder MCP settings",
    snippet: `{\n  "mcpServers": {\n    "blendersvg": { "url": "${endpoint}", "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" } }\n  }\n}`
  },
  {
    id: "workbuddy",
    name: "WorkBuddy",
    file: "WorkBuddy MCP settings",
    snippet: `{\n  "mcpServers": {\n    "blendersvg": { "url": "${endpoint}", "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" } }\n  }\n}`
  },
  {
    id: "vscode",
    name: "VS Code",
    file: ".vscode/mcp.json",
    snippet: `{\n  "servers": {\n    "blendersvg": {\n      "type": "http",\n      "url": "${endpoint}",\n      "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" }\n    }\n  }\n}`
  }
];

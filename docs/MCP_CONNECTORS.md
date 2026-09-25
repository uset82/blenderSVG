# IDE connectors

Standalone Studio exposes a loopback MCP endpoint at `http://127.0.0.1:<port>/mcp`. It uses the same Host, Origin, and launch-token checks as the rest of the host, plus a per-client bearer token.

Create the token on the Connectors page (`#/connectors`). The page shows the token once. The client list never includes it. Revoke a client from that page when you are done. Do not commit a token or paste one into a repository file. The snippets below use the `BLENDERSVG_MCP_TOKEN` environment variable.

IDEs that prefer stdio can run `blendersvg-mcp`. It refuses any URL that is not HTTP on loopback and forwards each stdin line with the bearer token.

## What an IDE can do

- List and open Studio projects.
- Read the canvas, selection, styles, and frame HTML.
- Ask the open editor for a PNG of a frame.
- Propose or apply shapes, design frames, and SVG inserts, according to the client permission: read, propose, or apply.
- Trace a PNG or JPEG that stays inside the Studio library. Tracing stays local.

Image tracing does not create a rigged character. Send to Blender writes a new `.working.blend` and does not modify a source scene. Blender is optional.

OpenRouter chat is separate from MCP. The user picks a model from their own catalog. There is no built-in free-model list and no provider key in these snippets.

## Codex

`~/.codex/config.toml`

```toml
[mcp_servers.blendersvg]
url = "http://127.0.0.1:<port>/mcp"
bearer_token_env_var = "BLENDERSVG_MCP_TOKEN"
```

## Claude Code

```bash
claude mcp add --transport http blendersvg http://127.0.0.1:<port>/mcp --header "Authorization: Bearer $BLENDERSVG_MCP_TOKEN"
```

## Cursor

`.cursor/mcp.json`

```json
{
  "mcpServers": {
    "blendersvg": {
      "url": "http://127.0.0.1:<port>/mcp",
      "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" }
    }
  }
}
```

## Qoder and WorkBuddy

Use the same HTTP server entry as Cursor, with the header `Authorization: Bearer $BLENDERSVG_MCP_TOKEN`.

## VS Code

`.vscode/mcp.json`

```json
{
  "servers": {
    "blendersvg": {
      "type": "http",
      "url": "http://127.0.0.1:<port>/mcp",
      "headers": { "Authorization": "Bearer $BLENDERSVG_MCP_TOKEN" }
    }
  }
}
```

Replace `<port>` with the port printed when the Studio host starts.

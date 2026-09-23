# IDE Connectors via MCP (Model Context Protocol)

`blenderSVG` provides an MCP server (`@codex-avatar-studio/mcp-server`) that gives AI coding assistants (Cursor, Claude Code, Codex, Workbuddy AI, Qoder) direct control over:
- **High-fidelity vectorization** (local zero-cost Bézier splines via `@visioncortex/vtracer` WebAssembly).
- **Free generative AI vector models** via OpenRouter free tier (`google/gemini-2.0-flash-exp:free`, `deepseek/deepseek-r1:free`, `meta-llama/llama-3.3-70b-instruct:free`).
- **3D & 2D exports from Blender 4.5.3 LTS** (Grease Pencil/Freestyle Line-Art SVG and optimized WebGL GLB).
- **Infinite Canvas & Avatar control** (setting avatar emotion states and speech).

---

## Zero-Cost Architecture (No QuiverAI Key Needed)

| Task | Engine | Cost / API Key |
|---|---|---|
| **Image-to-SVG Vectorization** | `@visioncortex/vtracer` (WASM) | **$0.00 / Zero API key** (runs 100% offline) |
| **Multimodal Vision Vectorization** | OpenRouter `google/gemini-2.0-flash-exp:free` | **$0.00** (Free tier) |
| **Text-to-SVG Generation** | OpenRouter (`gemini-2.0-flash-exp:free`, `deepseek-r1:free`, `llama-3.3-70b:free`) | **$0.00** (Free tier) |
| **3D Line Art & GLB Export** | Headless Blender 4.5.3 LTS | **$0.00 / Zero API key** (local Blender engine) |

> **Note on QuiverAI:** QuiverAI requires paid cloud subscription credits. Our project defaults to **OpenRouter free models** and **local VTracer WASM**, providing superior curve smoothness at zero cost.

---

## 1. Cursor IDE Setup

Cursor automatically reads `.cursor/mcp.json`. The configuration is already present in your project:

```json
{
  "mcpServers": {
    "blender-svg": {
      "command": "node",
      "args": ["d:/Proyectos/Blender/packages/mcp-server/dist/src/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-free-openrouter-key-if-using-ai"
      }
    }
  }
}
```

---

## 2. Claude Code / Claude Desktop Setup

### Using the Claude CLI
```bash
claude mcp add blender-svg node d:/Proyectos/Blender/packages/mcp-server/dist/src/index.js
```

### Or add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "blender-svg": {
      "command": "node",
      "args": ["d:/Proyectos/Blender/packages/mcp-server/dist/src/index.js"],
      "env": {
        "OPENROUTER_API_KEY": ""
      }
    }
  }
}
```

---

## 3. Workbuddy AI & Qoder Setup

Add a Custom MCP Server:
- **Server Name:** `blender-svg`
- **Transport:** `stdio`
- **Command:** `node`
- **Arguments:** `["d:/Proyectos/Blender/packages/mcp-server/dist/src/index.js"]`

---

## Available MCP Tools

1. `studio_status` — Verifies health of local VTracer, OpenRouter free models, and Blender 4.5.3 LTS.
2. `vectorize_image` — Turns any PNG/JPG/WebP into clean Bézier spline SVG (`engine: 'vtracer'` or `'openrouter'`).
3. `generate_svg` — Generates raw SVG from a natural prompt using free models.
4. `avatar_set_state` — Sets avatar emotion (`idle`, `thinking`, `speaking`, `coding`, `celebrate`, `error`) and speech bubble.
5. `blender_export_lineart` — Exports 3D scene contours into 2D SVG vector curves.

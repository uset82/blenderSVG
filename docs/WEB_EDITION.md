# Kurva web edition

> Status: in progress (track W0–W10 in [`docs/plan/futureplan.md`](plan/futureplan.md)). This page is the user-facing guide to what the web edition at `https://app.kurva.agency` does and where your data lives. It is completed in W10.4.

The web edition is Kurva running as a static site. There is **no account and no Kurva server**: your projects, images, SVGs, thumbnails and conversations are stored in your own browser (IndexedDB). AI chat is optional and uses your own OpenRouter account, connected with a one-click OAuth sign-in; the key stays in your browser and is sent only to `openrouter.ai`.

## Feature matrix

| Area | Web edition | Desktop / local editions |
| --- | --- | --- |
| Home, Recents, editor canvas, tools | Yes | Yes |
| Layers, Pages, Assets, Styles, inspector | Yes | Yes |
| Image → SVG (local vtracer) | Yes | Yes |
| SVG/PNG/JPEG import, PNG/SVG/JSON export | Yes | Yes |
| Avatar builder and avatar-package ZIP | Yes (download) | Yes (install into VS Code) |
| Agent chat, modes, proposals, variants, skills | Yes, with your OpenRouter key | Yes, key held by the host |
| Themes, command palette, shortcuts | Yes | Yes |
| Project storage | Your browser (IndexedDB) | The host's local library on disk |
| Blender connector | No — desktop only | Yes, optional |
| MCP IDE connectors | No — desktop only | Yes |
| QuiverAI "Generate SVG" | No — desktop only | Optional, off by default |
| VS Code integration | No | Yes |
| "Reveal in folder" | No | Yes |

## Notes

- Use **Export all projects** in Settings → Storage for backups; browser storage can be evicted, and Safari can remove data after seven days without a visit unless Kurva is added to the Home Screen.
- The web edition has no analytics and no third-party scripts.

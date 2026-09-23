# blenderSVG Studio

> **Working name.** A new product name is being chosen. The repository, package and extension names will change with it (plan step R6).

blenderSVG Studio is a local-first design canvas where you and AI agents design together. It is an infinite [tldraw](https://tldraw.dev/) canvas with an agent chat that uses any model from your own [OpenRouter](https://openrouter.ai/) account. It also traces pictures into editable SVG on your computer, builds animated avatars, and hands work to Blender. It ships with a VS Code extension that adds an animated avatar to your editor.

> [!NOTE]
> The Studio is in active development. The avatar extension is the finished, tested part. The Studio is being rebuilt step by step against the Target UI design; see [the plan](docs/PLAN_CHECKLIST.md) for exactly what is done.

## What's in this repository

| Part | Folder | Status |
| --- | --- | --- |
| Studio canvas app (React + tldraw) | `apps/studio` | In progress. Design system and Home dashboard are in; the editor shell, chat panel and agents are next. |
| VS Code extension | `apps/extension` | Working. Avatar sidebar, picture → SVG, avatar library, Blender tools. It also hosts the Studio in an editor tab for now. |
| Avatar sidebar UI | `apps/webview` | Working. The compact avatar panel inside VS Code. |
| Shared packages | `packages/` | `avatar-core` (avatar manifest, state machine, Studio messages), `asset-pipeline` (local tracing and SVG safety), `runtime-pixi` (PixiJS avatars), `mcp-server` (MCP tools). |
| Blender scripts | `scripts/blender` | Working. Local SVG, GLB and PNG export and the SVG-to-scene handoff. |
| Docs and plan | `docs/` | [Plan](docs/PLAN_CHECKLIST.md), [design brief](docs/STUDIO_DESIGN_BRIEF.md), [Target UI artboards](docs/design/target-ui/README.md). |

## Where it is going

The ordered roadmap lives in [docs/PLAN_CHECKLIST.md](docs/PLAN_CHECKLIST.md). In short:

1. A pen.dev-style editor: floating toolbars, layers, pages and a properties panel.
2. A standalone local app that runs without VS Code, on your computer only (`127.0.0.1`).
3. Real saving, reopening and export of projects.
4. An agent panel where you pick any OpenRouter model, with streaming chat and saved conversations.
5. Design agents that propose changes on the canvas, which you apply or undo in one step.
6. An image → SVG dialog, the avatar builder, and the Blender connector.
7. Connectors so coding agents (Codex, Claude Code, Cursor, WorkBuddy, Qoder) can work on the canvas over MCP.

## Quick start

You need Git, Node.js 22 and pnpm 11.7.0. VS Code 1.96+ and Blender 3.6+ are optional.

```bash
git clone https://github.com/uset82/blenderSVG.git
cd blenderSVG
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
```

### Try the Studio in your browser

```bash
pnpm dev:studio
```

Open `http://127.0.0.1:5174`. The browser preview keeps everything in memory, so nothing is saved, and the AI chat is off. Saving and chat work in the VS Code tab until the standalone app is ready.

### Run it inside VS Code

```bash
pnpm build
```

Open the folder in VS Code and press **F5** to start an Extension Development Host. Then, from the Command Palette:

- **Codex Avatar: Open Studio** opens the Studio in an editor tab. Projects are saved under `.codex-avatar/studio/projects` in your workspace.
- **Codex Avatar: Open Assistant** opens the avatar sidebar.

### Build and install the extension

```bash
pnpm package:vsix
code --install-extension dist/codex-avatar-studio-0.1.0.vsix --force
```

## Using the AI chat

1. Open the Studio in VS Code and open the conversation panel.
2. Select **Connect** and paste your own OpenRouter key into VS Code's password prompt. The key is kept in VS Code's secret storage and never reaches the page.
3. Pick any model from your account's live catalog. You can filter by publisher, price, context size and capabilities.
4. Review what will be sent, then send. Only your message and what you choose to attach go to OpenRouter.

## Using the avatar extension

- **Built-in avatar.** A coder orb reacts to your work, with no setup. Commands such as **Codex Avatar: Set State**, **Codex Avatar: Mark Success** and **Codex Avatar: Trigger Nod** preview its states.
- **Create from a picture.** Choose a PNG, JPG or JPEG, adjust the tracing, review the SVG, fill in the name and license, then select **Save & Use**. Tracing makes a static SVG; it does not rig or animate a character by itself.
- **Avatar library.** Import, validate, activate, export (`.codex-avatar.zip`) and remove avatar packages. See the [Avatar Package Specification](docs/AVATAR_PACKAGE_SPEC.md).
- **Blender tools (optional).** Auto-detect or browse to Blender 3.6+, test the connection, export GLB, SVG or PNG from a `.blend` file, or turn an SVG into an editable Blender scene. Your source `.blend` is never overwritten. Details are in [Blender Pipeline](docs/BLENDER_PIPELINE.md).
- **Blender MCP for contributors.** A restricted, local-only Blender MCP setup for coding agents is included:

  ```bash
  pnpm setup:blender-mcp
  pnpm verify:blender-mcp
  ```

## Privacy and security

- Pictures, SVG, avatars and Blender scenes are processed on your computer.
- The AI chat is opt-in. It sends only what you submit to OpenRouter, using your own key, and it shows the request before sending.
- Keys stay in the host (VS Code secret storage) and never reach the browser page, local storage or logs.
- SVG is sanitized before it is shown, and the page cannot read arbitrary files.
- Workspace trust gates file changes and Blender runs.

See [Security and Privacy](docs/SECURITY_PRIVACY.md) for the threat model.

## Development

```bash
pnpm typecheck
pnpm test:unit
pnpm run ci
pnpm validate:docs
pnpm smoke:webview
pnpm smoke:vsix
pnpm smoke:blender
```

`pnpm smoke:blender` is skipped when Blender is not installed. Release packages never include `.codex-avatar/` workspace data, private artwork, `.blend` files or avatar GLBs.

More documentation:

- [Developer Setup](docs/DEVELOPER_SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [User Guide](docs/USER_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Repository agent skills](.agents/README.md) and [agent rules](AGENTS.md)

## License

MIT; see [LICENSE](LICENSE). Third-party software, fonts and agent skills are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The development workspace's private character artwork is not part of the repository or the extension package.

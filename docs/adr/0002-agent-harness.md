# ADR 0002 — Agent harness

**Status:** accepted as a boundary for Phase 20. No ZCode source has been copied into this repository.

## Decision

The design agent runs inside the Studio host, not in the browser. It is a small turn machine written for this project. Ideas may be taken from ZCode at commit `328c1a0`, which is Apache-2.0. That commit is the only allowed source pin.

A file may be ported only after it is audited, and only if it is one of these:

- `core/src/agent/turn-machine.ts`
- `core/src/tool/registry.ts`
- `core/src/tool/scheduler.ts`
- `core/src/permission/` for the permission modes
- `core/src/compact/policy.ts`
- `core/src/subagent/profile*.ts`
- `adapters/src/model/streaming-tool-call-assembler.ts`

Each ported file keeps a header that names ZCode, commit `328c1a0`, and the Apache-2.0 license. `THIRD_PARTY_NOTICES.md` gains one entry per ported file. No file from that list is ported by this decision.

These parts of ZCode stay out of the repository:

- the ZCode CLI and the Electron app
- its bash, edit, and git tools
- its `node:sqlite` store
- its Zhipu account code

The host turn states are input, model, streaming, schedule tools, await permission, execute, aggregate, and done or error. Tool calls use OpenRouter's OpenAI-compatible `tools` and `tool_choice` fields and streamed `delta.tool_calls`. The browser receives typed events only. Provider keys stay on the host.

Canvas tools are the Studio registry, not ZCode's tools. Agent HTML is rendered in a sandboxed iframe `srcdoc` with no scripts and no network. File tools and Blender tools always wait for approval. Ask mode does not call tools. Plan mode uses read tools only. Build mode previews writes. Auto mode may apply canvas-only changes as one undo step.

## Consequences

- Phase 20 implements `packages/studio-agent` in this repository instead of vendoring the ZCode application.
- A port that is not on the list above is rejected.
- Until a file is actually ported, `THIRD_PARTY_NOTICES.md` does not claim ZCode source is present.

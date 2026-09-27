# ADR 0002 — Agent harness

**Status:** accepted as a boundary for Phase 20, and amended on 2026-09-27 (see the amendment below). Seven audited ZCode files are now ported.

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

## Amendment (2026-09-27): the pin, the audit, and what was ported

**The pin.** Commit `328c1a0` cannot be found in `zai-org/ZCode`. The public repository has three commits, and its `main` and tag `v3.14.3` point at `29628c9acdb81b703bbd4080c207a0e7ce5e276e`. That commit is now the only allowed source pin. Its `LICENSE` is Apache-2.0, Copyright 2026 Z.AI Co., Ltd.

**The allowlist is extended** with the validation and turn-state files the turn machine needs (owner decision for Phase 25). The audit covered imports, Node built-ins, network access, and what each file does:

| Upstream file (under `apps/zcode-cli/packages/`) | Decision | Reason |
| --- | --- | --- |
| `core/src/agent/turn-machine.ts` | Ported | Pure state machine; imports only its state file and contracts helpers. |
| `core/src/agent/turn-state.ts` | Ported | Types and the transition table the machine needs. |
| `core/src/tool/scheduler.ts` | Ported | Pure scheduling; groups read-only calls, runs changes one at a time. |
| `core/src/tool/json-schema.ts` | Ported | Pure JSON Schema validator for tool arguments. |
| `core/src/tool/tool-input-validation-issues.ts` | Ported | Pure issue types and constructors used by the validator. |
| `core/src/tool/input-validation-model-content.ts` | Ported in part | Only the formatter that turns issues into a tool error the model can read. The projection of Zod runtime issues is not needed. |
| `adapters/src/model/tool-input-normalization.ts` | Ported | Pure recovery of malformed tool-argument JSON. |
| `adapters/src/model/streaming-tool-call-assembler.ts` | Not ported | Built on AI SDK stream events; Kurva parses OpenRouter SSE itself. |
| `core/src/tool/registry.ts` | Not ported | Pulls in ZCode's runtime task registry. Canvas tools stay the Studio registry. |
| `core/src/compact/policy.ts` | Deferred | Design turns stay within the context window for now. |
| `core/src/permission/` | Not ported | Only re-exports; Kurva's approval rules live in `toolPolicy.ts`. |

None of the ported files use Node built-ins, the network, or storage, so they run in the browser as well as in the desktop host. Each keeps a header naming ZCode, the commit, the upstream path, the license, and Kurva's changes. `packages/studio-agent/src/zcode/contracts.ts` is Kurva code that stands in for the `@zcode/contracts` helpers. `THIRD_PARTY_NOTICES.md` has one row per ported file, and `pnpm validate:notices` checks the headers, the rows, and the license file.

**Behavior changes to the ported machine.** A failed or declined tool call goes back to the model as a tool result, so the model can correct it, instead of ending the turn. A streaming round may keep streaming, and an allowed call returns to `scheduled`.

**Where the host runs.** On the desktop, the harness runs in the Studio host process. In the web edition there is no Kurva server, so the host is the page itself: the OpenRouter key stays in the visitor's browser (see `AGENTS.md`), and the same turn machine runs there.

**Rendering.** Agent HTML is no longer rendered through `srcdoc`, because an `about:srcdoc` document inherits the page's `style-src 'self'` and every inline style would be refused. The page fills a sandboxed iframe (`allow-same-origin` only, no scripts) through the DOM and applies the design's CSS through the CSSOM. See `apps/studio/src/shapes/designFrameRenderer.ts`.

**Approval rules.** Design (auto) applies canvas changes without asking, as one undo step per turn, and still asks before sending a frame screenshot. Plan offers read tools only. Review (build) reads freely and asks before each change. Ask (chat) offers no tools.

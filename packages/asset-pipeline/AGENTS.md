# packages/asset-pipeline/AGENTS.md — Asset Pipeline Rules

- Keep image decoding, tracing, optimization, and validation local. The sole network exception is the user-enabled QuiverAI SVG generation described in the root `AGENTS.md`; it requires the host-held key and a fresh UI consent, and sends only the disclosed prompt and selected reference images.
- Validate input file types.
- Sanitize output paths.
- Treat bitmap tracing as reference/icon workflow, not final character rig workflow.
- Warn on path explosion and huge SVGs.
- Generate manifest entries.
- Do not call external APIs except for that explicit QuiverAI generation request. Never add another remote engine here.

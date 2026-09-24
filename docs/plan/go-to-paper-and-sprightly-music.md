# Kurva — Reference Scrape → Own Frontend UI + Logo + Tagline

## Context
The Studio (currently "Codex Avatar Studio" / "blenderSVG Studio") is being rebranded as **Kurva**. We want a
research pass over paper.design and pen.dev landing pages, a written compilation ("recopilación") of their
patterns, and then our own landing/frontend UI, logo and a tagline that sits under the logo.
Per `AGENTS.md` and `docs/STUDIO_DESIGN_BRIEF.md`: Paper and pen.dev contribute **layout and interaction
patterns only** — brand, icons, logo, copy stay our own. The existing Target UI canvas
(`docs/design/target-ui/`) already covers the *editor* app; this plan covers the *brand + marketing/front page*
and a visual refresh that the editor can adopt.

### Quick scrape findings (done in planning, read-only)
| | paper.design | pen.dev |
|---|---|---|
| Hero | 2–3 word lowercase headline, one explanatory line (teams + agents + code + data on one canvas) | "Agentic canvas" positioning line, single Download CTA |
| Type | Heavy bold sans headlines, regular body, big size contrast | Clean tech sans, regular/bold mix |
| Color | White/light neutrals, near-black text, 8%-opacity grey accents, desaturated imagery | Light + dark toggleable previews, mono UI, nib motif |
| Logo | One mark shown in many treatments (halftone, CMYK, dots, gooey) — logo as a playground | Nib/pen glyph repeated as a brand device |
| Imagery | Same demo app ("Overflow" playlist) reused across every section; papercut/halftone decor | Real product screenshots light/dark; named theme carousel (Drift, Echo, Flare, Nova, Onyx) |
| Structure | Nav → hero → staggered L/R feature rows → integration dock → CTA | Nav → hero → theme carousel → alternating feature rows → feature grid → perf callout → CTA → footer |
| CTAs | Download / Open in browser / Sign up; secondary "→" text links | Download (repeated), Sign in, X/Discord |
| Proof | Roadmap, build log, changelog | "Backed by…" badge, model logo lockup |
| Features | MCP agents, design↔code, real data, tokens, comments, responsive | Multi-model AI, WebGL perf, HTML/Figma import, components, shaders, pen tool, MCP, export, variables, open JSON format |

Takeaways for Kurva: one recurring demo subject (our avatar/SVG character) through every section; the mark
rendered in several "material" treatments; restrained neutral base with one sharp accent; alternating
feature rows; honest proof (changelog/roadmap), no fake social proof.

### ⚠ Naming risk to confirm before logo work
"kurva" is a strong profanity in Hungarian, Czech, Slovak, Polish, Serbian/Croatian and other Slavic
languages. Recommend confirming the name (or a variant like "Kurv", "Kurvo", "Kurvā") before Phase 4.

## Deliverable location
Per session setup, the visual output is a **Design artifact** (type_url
`https://claude.ai/code/artifact/bcd2878f-a88d-4094-a616-8e39d8a5fd8a`, title "Kurva — Brand & Front Page").
Written research + plan also land in repo: `docs/brand/KURVA_REFERENCE_SCRAPE.md` and
`docs/brand/KURVA_BRAND_PLAN.md`, linked from `docs/STUDIO_DESIGN_BRIEF.md`. No logos/copy from Paper/pen.dev
are saved into the repo — only our notes and screenshots kept local (git-ignored `.codex-avatar/refs/`).

## Task checklist

### Phase 1 — Deep scrape (read-only)
- [x] 1.1 Open paper.design in the built-in browser at 1440×900 and 375×812; capture full-page screenshots per section (local, git-ignored)
- [x] 1.2 Same for pen.dev, light and dark previews
- [x] 1.3 Extract computed tokens via `javascript_tool`: font families/sizes/weights, colors, radii, spacing, shadows, section heights
- [x] 1.4 Record motion: hero load, hover states, scroll reveals, carousel behaviour
- [x] 1.5 Note nav, CTA hierarchy, footer, and mobile collapse behaviour

> Phase 1 evidence (2026-09-24): both sites captured at 1440 + 375 px in the built-in browser; tokens pulled from computed styles. Correction: both sites are dark-first; pen.dev names (Drift, Echo…) are agent cursors, not themes.

### Phase 2 — Compilation (recopilación)
- [x] 2.1 Write `docs/brand/KURVA_REFERENCE_SCRAPE.md`: side-by-side table (above, expanded), token tables, section maps
- [x] 2.2 "Adopt / Adapt / Avoid" list — patterns only, explicitly no copy/logos/icons
- [x] 2.3 Gap analysis vs existing Target UI artboards (`docs/design/target-ui/`)

> Phase 2 evidence: `docs/brand/KURVA_REFERENCE_SCRAPE.md` (tokens, section maps, motion, Adopt/Adapt/Avoid, gaps vs Target UI).

### Phase 3 — Brand strategy
- [x] 3.1 Confirm name "Kurva" (see naming risk) and one-sentence positioning (local-first avatar/SVG + Blender studio with opt-in AI)
- [x] 3.2 Tagline shortlist (8–10), pick 1. Seeds: "Every line finds its curve." · "Draw it. Rig it. Ship it." · "From sketch to character, locally." · "Bend pixels into characters."
- [x] 3.3 Aesthetic direction: e.g. *technical-drafting meets warm studio* — off-white paper, ink black, one hot accent (vermilion or electric chartreuse), a distinctive display face (e.g. Fraunces / Instrument Serif / Unbounded) + refined body face (not Inter/Roboto)
- [x] 3.4 Write `docs/brand/KURVA_BRAND_PLAN.md` with decisions

> Phase 3 evidence: owner kept the name "Kurva" (risk accepted) and chose the warm paper light theme; tagline "every line finds its curve."; decisions in `docs/brand/KURVA_BRAND_PLAN.md`.

### Phase 4 — Logo
- [x] 4.1 3–4 mark concepts built from a single Bézier curve (the "K" drawn as one path with visible handles / a curve that becomes a character silhouette)
- [x] 4.2 Wordmark "kurva" + lockups: horizontal, stacked, mark-only, with tagline beneath
- [x] 4.3 Treatments playground (ink, outline, halftone, handle-view, animated draw-on) — our own take on the "one mark, many materials" idea
- [ ] 4.4 Pick final; export SVG (sanitized, `currentColor`), favicon 16/32, app icon 128/512, VS Code extension icon
- [x] 4.5 Clear-space, min size, colour variants, misuse rules

> Phase 4 evidence: concepts A–D, lockups on paper/ink/vermilion grounds, treatments, sizes and rules are on the Logo artboard. 4.4 (exported SVG, favicon and icon files) is still open.

### Phase 5 — Design system tokens
- [x] 5.1 Colour tokens light + dark (CSS vars), contrast ≥ WCAG AA
- [x] 5.2 Type scale, spacing, radii, shadows, motion durations; honor `prefers-reduced-motion`
- [ ] 5.3 Map tokens onto existing `apps/studio/src/styles/shell.css`, `editor.css`, `agent.css` variables (plan only, no forced refactor)

> Phase 5 evidence: light and dark token tables plus the type, shape and motion specs are in the brand plan. The text-safe accent #B53A17 was added for AA contrast. 5.3 (mapping onto the Studio CSS) is still open.

### Phase 6 — Front page UI design (Design artifact)
- [x] 6.1 Create Design artifact from the Design type; add artboards
- [x] 6.2 Artboard: logo + tagline sheet
- [x] 6.3 Artboard: landing page desktop — nav, hero with animated curve-draw of the mark, recurring demo character, alternating feature rows (Canvas, SVG→Blender handoff, Agent/MCP, Local-first privacy), honest roadmap/changelog strip, CTA, footer
- [x] 6.4 Artboard: landing page mobile (375)
- [x] 6.5 Artboard: Studio Home + editor shell reskinned with Kurva tokens (layout from existing Target UI)
- [x] 6.6 Copy review: only features that actually work; no claim that tracing makes a rigged character

> Phase 6 evidence: https://claude.ai/artifact/W58r7M5XaMbzEz4Zt2irnc (v2) has 4 artboards: Logo, Landing desktop, Landing mobile, Studio Home. Roadmap statuses come from the PLAN_CHECKLIST counts (14–15 done, 16 at 16/17, 17 at 6/10).

### Phase 7 — Implementation (after design approval)
- [ ] 7.1 Add logo assets + icons to `apps/studio` and `apps/extension` (package.json icon/displayName)
- [ ] 7.2 Apply tokens to Studio CSS; rename visible "blenderSVG Studio"/"Codex Avatar Studio" strings
- [ ] 7.3 Optional static landing page (`apps/site/`, plain HTML/CSS) if wanted
- [ ] 7.4 Add Phase entry + evidence to `docs/PLAN_CHECKLIST.md`

### Phase 8 — Verification
- [ ] 8.1 `pnpm test` / typecheck pass; CSP still strict (no remote fonts in Webview — self-host)
- [ ] 8.2 Visual check in browser pane at 1440×900 and 375×812, light + dark, reduced motion
- [ ] 8.3 Logo legible at 16px; SVG passes existing sanitizer
- [ ] 8.4 Confirm no Paper/pen.dev assets or copy in repo (`git grep -i "paper\|pen.dev"` in new files)

## Verification (end-to-end)
Design artifact reviewed by user → implement Phase 7 → run tests + open Studio via the `run` skill,
screenshot each artboard-equivalent screen, compare against the artifact.

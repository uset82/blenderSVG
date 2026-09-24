# Kurva — Reference scrape: paper.design and pen.dev

Captured 2026-09-24 from the live landing pages at 1440 px and 375 px wide, using the built-in browser.
These notes list **layout and interaction patterns only**. Per `AGENTS.md`, we do not reuse either
product's logo, name, icons, illustrations or copy. No screenshots or assets are committed.

## Tokens measured (computed styles)

| Token | paper.design | pen.dev |
|---|---|---|
| Page background | Near-black, about `lab(8% 0 0)` ≈ `#141414`, with a faint radial glow behind the hero | `rgb(10,10,10)` fading to a dark grey gradient |
| Primary text | Warm off-white, `lab(94% -1.4 5.3)` ≈ `#EFEFE6` | Pure white |
| Secondary text | A second headline line in mid-grey (`lab(60%)`) | Headline tail at 50% white; body copy `#666` |
| Neutral ramp | Cool greys, `oklch(0.15 → 0.90, hue 258)` | Greys plus white at 3%, 44%, 50% and 55% |
| Accent | Almost none; a periwinkle-blue logo square and one blue download button | Almost none; pastel cursor tags (pink, blue, orange, green) |
| Display font | Custom geometric grotesk at **weight 360**, 48/48, tracking −0.96 px, all lowercase | Inter Display at weight 400, 32/36, tracking −0.64 px |
| Body font | The same grotesk at 18/28, tracking +0.18 px | Inter Display at 20/24 (lead text) and Rubik at 16/24 |
| Monospace | Custom mono, used for terminal and code snippets inside the hero mock | Custom cursor font for labels |
| Radii | Mostly 4–6 px; pills at 9999 px | Mostly 4 px; 12 px cards; pill buttons |
| Page length | about 9,300 px | about 15,300 px |

## Section maps

**paper.design**
1. Slim nav: logo on the left, five text links in the center, "sign up" on the right. On mobile the links collapse into a hamburger.
2. Hero, left-aligned: a bright lowercase line followed by 2–3 dimmer lines (**a two-tone headline**), one paragraph, one cream-filled primary button and one "→" text link.
3. A full-width product mock that overlaps the hero's bottom edge: the editor UI with a terminal that types an agent prompt. **The same demo app (a playlist UI) appears in every later section.**
4. A centered "desktop app" block with an app-icon dock (the integrations) and a platform-aware download button ("for Windows").
5. Feature rows placed on a **hairline grid with visible cell borders**. Each cell holds a small heading and 1–2 lines of copy under a large mock.
6. The same pattern repeats for data, agents and "anti-slop workflow".
7. Honest proof: roadmap, changelog, "what's new" and funding news cards.

**pen.dev**
1. A dismissible announcement bar, then a sticky nav: logo, three links, social icons, "Sign in" and a white pill "Download".
2. Hero, centered: a 3D metallic brand glyph, a two-tone one-sentence headline and a single white pill CTA.
3. A live, interactive canvas embed in which **named agent cursors** (Drift, Echo, Flare, Nova, Onyx) move around and build frames. It shows a "Loading canvas…" state.
4. A segmented toggle (Website / Mobile App / Socials & Marketing) that switches the example set.
5. A "Made in …" gallery in a masonry grid.
6. "Bring any model" with a lockup of model logos.
7. A **huge feature list** (about 28 items) in a grid, with the self-aware closing item "the list goes on…".
8. A performance brag with concrete numbers, then the final CTA, then the footer.

## Motion and interaction
- Paper: a subtle radial light behind the hero, an agent prompt typed into the terminal mock, and app icons that pop into the dock.
- pen.dev: the live canvas with animated multiplayer-style agent cursors, the segmented example switcher and hover-lit feature cards.
- Both keep motion inside the product mock. The page chrome itself stays still.

## Adopt / Adapt / Avoid

| Adopt (pattern) | Adapt (make it ours) | Avoid |
|---|---|---|
| Dark-first page with one warm off-white text color | Offer a light "paper" theme as a first-class alternative instead of dark only | Any of their logos, glyphs, product names, copy lines or demo apps |
| Two-tone headline (bright line plus dim continuation) | Use the dim line for the honest "what it really does" clause | Grey-on-black body text below AA contrast (pen.dev's `#666` on `#0A0A0A` is about 3.6:1) |
| One recurring demo subject across all sections | Our demo subject is **one character**, followed from sketch to SVG to Blender preview to agent edit | Fake social proof, funding brags or "backed by" badges |
| Hairline grid for feature cells | Draw the grid as Bézier "construction lines" with visible handles | A 28-item feature wall that lists things we don't ship |
| Live product mock inside the hero | Show our real Studio canvas, with a curve drawing itself into the Kurva mark | Implying that bitmap tracing produces a rigged, animated character |
| Platform-aware single download CTA | "Install for VS Code" plus "Open Studio" | Remote asset services, and telemetry on the page |
| Roadmap and changelog as proof | Link `PLAN_CHECKLIST.md` progress | |
| Named agent cursors | Our agents appear as labeled pen nibs or handles on the canvas | Copying their cursor names or tag colors |

## Gaps compared with the existing Target UI (`docs/design/target-ui/`)
- The Target UI covers the **editor app** (dashboard, editor, pages, Recents). It has no marketing or front page, no logo and no brand tokens. This work adds those three.
- Kurva tokens should replace the Studio's neutral palette without changing the Target UI layouts.

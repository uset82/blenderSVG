# Kurva — Brand plan

Status: the owner confirmed the name on 2026-09-24 (this unblocks rename track R6 in `PLAN_CHECKLIST.md`).
The research behind these choices is in [`KURVA_REFERENCE_SCRAPE.md`](KURVA_REFERENCE_SCRAPE.md).
The visual canvas is the Design artifact "Kurva — Brand & Front Page".

## Name and positioning
- **Name:** Kurva, always written lowercase as `kurva` in the wordmark. It comes from *curve*: the Bézier path is the atom of everything the product makes.
- **Known risk, accepted by the owner:** "kurva" is a swear word in Hungarian, Czech, Slovak, Polish and Serbo-Croatian. To keep the intended reading clear, the brand always shows the curve. Where space allows, the mark and the tagline appear together.
- **Positioning:** a local-first design canvas for characters, SVG and Blender, with agents only when you ask for them.

## Tagline
**Every line finds its curve.**

Other candidates, in case the owner prefers one:
- Draw the line. Find the curve.
- From sketch to character, on your machine.
- Bend pixels into vectors.
- Your canvas, your curves, your keys.
- Curves first. Agents when asked.
- Sketch. Vector. Blender. Local.
- Make the line yours.

## Aesthetic direction: "drafting table"
Warm paper, ink, and construction lines with visible Bézier handles. It is light-first on purpose, to stand apart from both references, which are dark-first. It has a technical feel without the cold, template-like look of a generic SaaS page.

| Token | Light "paper" (default) | Dark "ink" |
|---|---|---|
| `--k-paper` (ground) | `#F3EEE3` | `#16150F` |
| `--k-paper-2` (raised) | `#FBF8F1` | `#201E17` |
| `--k-ink` (text) | `#1B1A17` | `#EFE9DC` |
| `--k-ink-2` (secondary text) | `#5A554B` (≈ 6.9:1 on paper) | `#A9A294` |
| `--k-rule` (hairlines) | `#1B1A17` at 14% opacity | `#EFE9DC` at 14% opacity |
| `--k-vermilion` (single accent) | `#D2461E`: the mark, large fills, and text at ≥ 24 px only | `#F0623A` |
| `--k-vermilion-deep` (text-safe accent) | `#B53A17`: buttons with paper-colored text and small accent text (≥ 4.5:1) | `#F0623A` |
| `--k-blueprint` (handles and guides only) | `#2E5E8C` | `#7FA8D1` |

- **Type:** display is **Fraunces** (variable, with high `SOFT` and a touch of `WONK`, so the letters carry curves). Body is **Hanken Grotesk**. Labels, code and handle coordinates use **IBM Plex Mono**. The Webview self-hosts all three, because its CSP blocks remote fonts.
- **Scale:** 12 / 14 / 16 / 20 / 28 / 40 / 64 / 104 px. Display tracking is −2%; mono tracking is +2% in uppercase.
- **Shape:** 6 px radius on controls, 14 px on cards, pills for primary CTAs. Borders are hairlines; the page uses almost no shadows.
- **Motion:** paths draw on with a `stroke-dashoffset` animation of 900 ms (easing `cubic-bezier(.2,.7,.2,1)`), and handles fade in after the path. With `prefers-reduced-motion`, everything renders already drawn.

## Logo
- **Mark:** a straight ink stem next to one vermilion Bézier curve. Together they read as a **K**, and the curve bows in until it touches the stem. It is exactly one path and one stroke: the product's atom.
- **Handle view:** the same mark with its two control handles showing, drawn in blueprint blue. We use it for hero and loading states, never at small sizes.
- **Lockups:** horizontal (mark plus wordmark), stacked (tagline underneath), and the mark alone for app icons and favicons.
- **Rules:** keep clear space equal to the stem width × 2. The minimum size is 16 px for the mark alone and 72 px wide for the horizontal lockup. The curve stays vermilion or single-color, and handles are never shown below 48 px. Never stretch, rotate, outline-only below 24 px, or put the logo on busy imagery.

## Honest-copy rules
- Describe only features that work today. For anything else, use "on the roadmap" and link the plan.
- Tracing produces clean vector layers, not a rig. Blender is optional and always works on copies.
- Remote AI is opt-in, uses the user's own key, and the UI shows what will be sent.

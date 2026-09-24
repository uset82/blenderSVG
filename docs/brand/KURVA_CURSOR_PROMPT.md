# Prompt for Cursor: execute the Kurva brand plan

> Paste everything below the line into Cursor Agent, or send just this line:
> `Read docs/brand/KURVA_CURSOR_PROMPT.md and execute it exactly.`

---

## 0. Your role

Act as a **senior software architect and design engineer** who is an expert in visual design, UI/UX, design systems, accessibility (WCAG 2.2 AA) and front-end performance. You turn an approved design into production code without changing its intent. Work like someone who ships:
- Read before you write.
- Keep each change small and reversible.
- Verify every step before claiming it is done.
- Never invent features, copy or data.

You are **not** designing from scratch. The brand, logo, tagline, tokens and screens are already decided and approved by the owner. Your job is to **implement them faithfully and polish the details**.

## 1. Read these first, in this order

1. `AGENTS.md` (root) and the scoped ones: `apps/extension/AGENTS.md` and `apps/webview/AGENTS.md`. Its rules override anything in this prompt.
2. `docs/brand/KURVA_TASK_PLAN.md`: the task checklist you will execute and tick.
3. `docs/brand/KURVA_BRAND_PLAN.md`: name, tagline, color tokens, type, logo rules and honest-copy rules.
4. `docs/brand/KURVA_REFERENCE_SCRAPE.md`: why the design looks the way it does, and what to **avoid**.
5. `docs/design/kurva/*.dc.html` and its `README.md`: the approved artboards, which are the visual spec. Read the inline styles and inline SVG as exact values.
6. `docs/PLAN_CHECKLIST.md` → section **"Repository organization and rename track (R1–R7)"**, especially **R6**. That file is the canonical project plan. `KURVA_TASK_PLAN.md` is an owner-approved sub-checklist for the brand track, and every change must also be recorded against R6 there.
7. `docs/STUDIO_DESIGN_BRIEF.md` and `apps/studio/src/styles/tokens.css`.

## 2. Design toolkit: the owner's webdesigner skills

Cursor does not have Claude's design plugins. Use the owner's skill suite instead: **https://github.com/uset82/webdesigner**.

Setup:
- Clone it **next to** this repo, not inside it: `git clone https://github.com/uset82/webdesigner D:\Proyectos\webdesigner`.
- Only read its skill files (`skills/<name>/SKILL.md` and anything they reference). Do **not** copy its code, templates or vendor files into this repo.
- Do **not** run its installer or edit `~/.cursor/mcp.json` or `.cursor/mcp.json`. If you think its MCP server would help, ask the owner first.
- Before each phase, `@`-mention the relevant `SKILL.md` files in Cursor so they are in context.

**Use these skills:**

| Skill | Use it for |
|---|---|
| `skills/frontend-design` | Craft discipline: typography, spacing, composition, avoiding a generic "AI template" look. The aesthetic direction is **already fixed** (section 3), so do not pick a new one. |
| `skills/ui-skills` | The WCAG AA audit, spacing and typography rhythm, 60 fps motion, and focus states. Run its checklist on every screen you touch. |
| `skills/frontend-skill` | Polish passes on the landing page. Density is "calm", motion is "low". |
| `skills/friction-vector` | Only for the logo's draw-on SVG animation (CSS `stroke-dashoffset`, with no new runtime dependency). |
| `skills/security-audit` | The final pass: CSP, SVG sanitization, and no remote fonts or scripts inside the Webview. |
| `skills/understand-anything` | Optional. Map where brand strings and tokens are used before you rename anything. |

**Do not use these skills here:**
- `webdesigner-design-system`: it applies the "Nightglass" look, which conflicts with Kurva. You may borrow its QA checklist, but never its palette or type.
- `stitch-design`: it uses a remote design provider, which `AGENTS.md` forbids.
- `framework-selector`, `project-scaffolder`, `code-generator`, `deploy-advisor`: the app already exists, a React + Vite pnpm monorepo. Do not scaffold anything.
- `threeui`, `gsap-animation`, `animate-ui` (which needs Tailwind; we don't use it), `3d-scroll-website`, `web-shader-extractor`, `img2threejs`: they would add heavy dependencies or copy other sites.

This repo also has its own skills in `.agents/skills/` (`svg-vector-pipeline`, `vscode-extension-architect`, `webview-avatar-designer`, `qa-release-engineer`). Use them for SVG, extension, Webview and QA work, as `AGENTS.md` requires.

## 3. The approved design (don't change it)

- **Name:** `kurva`, written lowercase in the wordmark and "Kurva" in sentences. The owner confirmed it on 2026-09-24 and knows it is a swear word in several Slavic languages and Hungarian. Do not reopen that decision.
- **Tagline:** `every line finds its curve.` (lowercase, with the final period).
- **Mark:** a straight ink line (the stem) plus one vermilion Bézier curve, forming a K. Use this exact geometry:

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Kurva">
    <line x1="18" y1="10" x2="18" y2="54" stroke="#1B1A17" stroke-width="8" stroke-linecap="round"/>
    <path d="M48 10 C16 28 16 36 48 54" fill="none" stroke="#D2461E" stroke-width="8" stroke-linecap="round"/>
  </svg>
  ```

  - **Small-size variants:** at 32 px use a stroke width of 9, and at 16 px use 11. The dark version uses a stem of `#EFE9DC` and a curve of `#F0623A`. The one-color version uses `currentColor` for both. The app icon is the mark in `#FBF8F1` on a `#B53A17` rounded square (radius 22% of the size).
  - **Handle view:** handles `(48,10)→(16,28)` and `(48,54)→(16,36)`, drawn in `#2E5E8C`, only at 48 px and above.
- **Tokens:** use the light "paper" and dark "ink" tables in `KURVA_BRAND_PLAN.md` exactly.
  - `#D2461E` is only for the mark, large fills, and text at 24 px or larger.
  - `#B53A17` (vermilion-deep) is the text-safe accent for buttons and small text.
  - Blueprint `#2E5E8C` is only for handles and guides.
- **Type:**
  - **Fraunces** (variable, with the `SOFT` axis at 100 and `WONK` at 1 on display text) for headlines and the wordmark.
  - **Hanken Grotesk** for the UI and body text.
  - **IBM Plex Mono** for labels, paths and metadata.
- **Shape and motion:** 6 px radius on controls, 14 px on cards, pills for primary CTAs, hairline borders and almost no shadows. The path draw-on animation runs about 900 ms with easing `cubic-bezier(.2,.7,.2,1)`. Every animation must be disabled under `prefers-reduced-motion`.

## 4. Hard rules (from `AGENTS.md`, not negotiable)

- **Webview:** keep its CSP strict. **Fonts must be self-hosted** through `@fontsource` packages, like the existing `@fontsource/geist-*`. Never load Google Fonts or any CDN inside the Studio or the Webview.
- **SVG:** every SVG must pass the existing sanitizer. It must contain no `<script>`, `foreignObject`, external `href`, or event attributes.
- **Local-first:** do not add remote services, analytics or telemetry.
- **Honest copy:** name only features that work today. Never imply that tracing makes a rigged or animated character, or that Blender turns pictures into production 3D avatars.
- **No copying Paper or pen.dev:** no copy, logos, icons, names or assets from paper.design or pen.dev.
- **Other people's work:** preserve unrelated uncommitted changes, since the working tree already has many. Never run `git reset`, `git checkout -- .`, `git clean` or force-push. **Do not commit or push** unless the owner asks.
- **Rename track:** make sure no other coding agent is editing this folder while you work (rule R1.1).
- **Stop and report:** if a check fails twice in a row, stop and report instead of guessing.

## 5. Tasks, in order

Tick a checkbox in `docs/brand/KURVA_TASK_PLAN.md` **only after** the task is implemented **and** verified. Add a one-line evidence note under the phase, with the commands and results. Mirror the same result on the matching R6 items in `docs/PLAN_CHECKLIST.md`.

### Phase A: logo assets (4.4, R6.3)

1. Create `docs/design/brand/` with these files:
   - `kurva-mark.svg`
   - `kurva-mark-small.svg`, the 16–32 px stroke version
   - `kurva-mark-mono.svg`, using `currentColor`
   - `kurva-mark-dark.svg`
   - `kurva-app-icon.svg`
   - `kurva-lockup-horizontal.svg`, with the wordmark outlined as paths **or** set in Fraunces with a note
   - `kurva-lockup-stacked-tagline.svg`

   Use clean, hand-written SVG with a `viewBox`, no editor metadata, and a `role="img"` plus `aria-label` on each root.
2. Replace `apps/studio/src/assets/brand-mark.svg` with the mark (`aria-label="Kurva"`). Keep the file name so imports still work.
3. Generate the PNG icons at 16, 32, 180 and 512 px, plus the 128 px extension icon, into `docs/design/brand/png/`. Then replace `apps/extension/media/icon.png` with a 128 px or larger PNG of the **app icon** version.
   - For rasterizing, first check whether the workspace already has `sharp`, `@resvg/resvg-js` or Playwright. If it has none, add `@resvg/resvg-js` as a root devDependency and write a small script, `scripts/render-brand-icons.mjs`.
4. Add an SVG favicon plus a PNG fallback to `apps/studio/index.html`.
5. **Verify:**
   - Open each SVG in the browser at 16, 32 and 64 px. The mark must still read as a K at 16 px.
   - Run the SVG sanitizer tests: `pnpm test:unit`.

### Phase B: design tokens in the Studio (5.1, 5.2, 5.3)

1. Install the fonts: `@fontsource-variable/fraunces` (use the file that includes the `SOFT`/`WONK` axes; check its `package.json` exports), `@fontsource/hanken-grotesk` and `@fontsource/ibm-plex-mono`. Import them where `geist` is imported today. Remove the `geist` packages only if nothing uses them any more.
2. In `apps/studio/src/styles/tokens.css`, add `--k-*` brand tokens and **remap** the existing `--studio-*` variables:
   - Kurva "ink" feeds the dark theme.
   - Kurva "paper" feeds `[data-theme="light"]`.
   - `--studio-accent` becomes vermilion-deep in light and `#F0623A` in dark, with a matching `--studio-accent-contrast`.
   - Keep every variable name that components already use. Change values, not names.
3. **Do not change which theme is the default.** Kurva is light-first, but switching the Studio's default theme is a product decision. List it as a question in your report.
4. Add the `prefers-reduced-motion` guard to any animation you add.
5. **Verify with the `ui-skills` checklist:**
   - Body text is at least 4.5:1 and large text at least 3:1, in both themes.
   - Focus rings are visible.
   - Nothing hardcodes the old palette (`grep` for `#7aa7ff`, `#151516` and similar).

### Phase C: visible rename to Kurva (7.1, 7.2, R6.2)

1. Change only the **user-visible** strings:
   - The Studio `index.html` `<title>`, `StudioWindowBar.tsx` and `RecentsDashboard.tsx`.
   - The `displayName` and `description` in `apps/extension/package.json`, plus its `icon`.
   - Webview titles, `README.md` headings, and `AGENTS.md` titles.
2. **Do not rename**:
   - the extension `name`, publisher, command IDs, configuration keys (`codexAvatar.*` and similar), view IDs, or the storage folder `.codex-avatar/`;
   - the `@codex-avatar-studio/*` package scope (that is R6.4, which is out of scope until the owner asks).

   Renaming any of these breaks user settings and installs.
3. Leave `docs/design/target-ui/*.dc.html` unchanged. They mirror a canvas you can't edit, so note this in your report.
4. Update the tests that assert the old names, such as `apps/studio-server/test/server.test.ts` and `apps/webview/test/avatar-library-panel.test.tsx`.
5. **Verify:** `git grep -n -i "blenderSVG Studio\|Codex Avatar Studio" -- apps README.md` shows only IDs you intentionally kept. List them in the report.

### Phase D: Studio Home restyle (6.5 → code)

1. Bring the Home screen (`RecentsDashboard.tsx` and `home.css`) close to `docs/design/kurva/StudioHome.dc.html`. The spec covers:
   - the left rail with a pinned Scratchpad;
   - the Fraunces headline "what are we *drawing* today?";
   - category chips;
   - the composer with its "local only" chip;
   - three import cards;
   - a Recents grid.
2. Reuse existing components and wiring. **Every control must do something real, or it must not be shown.** Show bracketed placeholders like `[TIME]` from the artboard only where real data exists; otherwise show an honest empty state.
3. **Verify:**
   - Run `pnpm dev:studio` and open it in the browser at 1440×900 and 375×812, in light and dark, with reduced motion on and off.
   - Compare side by side with the artboard, and fix spacing, type and color drift.

### Phase E: static landing page (7.3, optional)

Do this only after Phases A–D pass.

1. Build `apps/site/` as **plain HTML and CSS**: `index.html`, `styles.css`, and `assets/` holding the self-hosted font files and SVGs. Use no framework, no build step and no external requests.
2. Implement `docs/design/kurva/Main.dc.html` for desktop and `Mobile.dc.html` for widths of 390 px and below as **one responsive page**, with breakpoints at about 1100 px and 640 px.
3. Keep these details:
   - the hero with the draw-on mark;
   - the product mock (inline SVG plus HTML);
   - the four-step "one character, all the way through" grid;
   - three alternating feature rows;
   - the dark "stays on your machine" band;
   - the "built in the open" roadmap, **with statuses re-read from `PLAN_CHECKLIST.md` on the day you build it**;
   - the CTA and footer.
4. Use real `<a>` and `<button>` elements, visible focus states, a skip link, `lang="en"` and alt text. There must be no horizontal scroll at 375 px.
5. Keep `apps/site/` out of the VSIX and out of the pnpm workspace build, and confirm with `pnpm validate:vsix` if it applies.

### Phase F: record and verify (7.4, 8.1–8.4)

1. Run and paste the results of each of these:

   ```
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test:unit
   pnpm validate:docs
   pnpm validate:notices
   pnpm build:studio
   ```

   Then `pnpm smoke:webview` if the Webview changed.
2. Add the new font packages and any new devDependency to `THIRD_PARTY_NOTICES.md`. The fonts are OFL-1.1; `@resvg/resvg-js` is MPL-2.0.
3. Run `git grep -n -i "paper.design\|pen.dev"` on the new files. The only allowed hits are the reference doc and this prompt.
4. Run the `security-audit` skill pass: CSP unchanged, no remote fonts or scripts, and every SVG sanitized.
5. Tick the finished items in `KURVA_TASK_PLAN.md` and R6 in `PLAN_CHECKLIST.md`, with evidence.

## 6. Quality bar ("a nice job")

- **Pixel faithfulness:** spacing, type sizes, tracking and radii match the artboards within about 2 px.
- **Typography:** use Fraunces only for display and the wordmark, never for body text. Italic vermilion appears only on the one emphasized word per headline.
- **Restraint:** one accent color per screen area. No gradients (except the Blender shading illustration), no glassmorphism, no emoji and no stock icons. Use the existing `lucide-react` icons at a 1.5–1.75 stroke to match.
- **Motion:** only the draw-on mark and subtle hover or focus transitions of 150 ms or less. Reduced motion shows the final state.
- **States:** hover, focus-visible, active, disabled, empty and loading for everything interactive. Touch targets are at least 44 px on mobile.

## 7. Final report format

When you stop, reply with:
1. The tasks completed, with IDs, and the evidence (commands plus results).
2. The files changed or added, grouped by phase.
3. Anything skipped or blocked, and why.
4. Questions for the owner. At minimum:
   - Should the default Studio theme become light?
   - Should the package scope be renamed (R6.4)?
   - Should the trademark and domain search for R6.1 be done?
5. Screenshots, or a description of them, at 1440×900 and 375×812.

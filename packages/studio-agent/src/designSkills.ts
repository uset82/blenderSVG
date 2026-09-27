export interface DesignSkill {
  id: string;
  name: string;
  prompt: string;
}

/**
 * Design skills from `skills/design/`. The picker sends a skill's id and the host adds its guide to the
 * system prompt. Tests keep these strings equal to the Markdown files.
 */
export const DESIGN_SKILLS: readonly DesignSkill[] = [
  {
    id: "landing",
    name: "Landing page",
    prompt:
      "Design a complete marketing landing page as one 1440-wide design frame. Sections, in order: a slim nav with the brand and 3–4 links plus a call to action; a hero with a specific headline, one supporting sentence, a primary and a secondary button, and an inline SVG or gradient visual; a proof strip (logos, numbers or a quote); 3–6 feature or offering cards with icons; a detailed section that fits the subject (schedule, pricing, gallery, menu or how it works); a testimonial; an FAQ or final call to action; and a footer with contact details. Pick one accent color and a warm or cool neutral palette that suits the subject, a display type and a body type, and an 8px spacing scale. Write real copy for the subject."
  },
  {
    id: "mobile",
    name: "Mobile app",
    prompt:
      "Design phone screens as 390-wide design frames placed side by side: typically onboarding or home, a detail screen and one action screen. Include a status-bar area (44px), a top app bar, content in 16–20px side padding, and a bottom tab bar or a primary action within thumb reach. Tap targets at least 44px, body text at least 16px, and one accent color used for primary actions only. Use realistic content, avatars as SVG initials and icons as inline SVG."
  },
  {
    id: "web-app",
    name: "Web app",
    prompt:
      "Design a product screen as a 1440-wide design frame: a left sidebar with navigation and the product mark, a top bar with search and the user menu, and a main area with a page title, primary action, filters or tabs, and the core content (a table, list, board or editor) populated with realistic records. Show states that matter: a selected row, a badge, an empty or loading hint. Use a neutral surface palette with one accent, 13–14px UI text, and clear hierarchy."
  },
  {
    id: "dashboard",
    name: "Dashboard",
    prompt:
      "Design an analytics dashboard as a 1440-wide design frame: a header with the title, date range and export; 3–4 KPI cards with a value, a change versus last period and a sparkline drawn in inline SVG; a main chart (line or bar, inline SVG with axes, gridlines and labels); a breakdown (donut or ranked bars); and a recent-activity table. Use plausible, internally consistent sample numbers and say in the footer that they are sample data."
  },
  {
    id: "slides",
    name: "Slides",
    prompt:
      "Design a short deck as 1280×720 design frames placed left to right, one slide per frame: a title slide, 3–6 content slides (one idea each: a statement, a list of at most 4 points, a comparison, a chart in inline SVG, a quote) and a closing slide. Use a consistent grid, large type (titles 48–64px, body 24–28px), one accent color and generous margins."
  },
  {
    id: "illustration",
    name: "Illustration",
    prompt:
      "Draw the subject as one detailed, layered SVG with insert_svg: a 512×512 viewBox, grouped parts (for example body, head, face, details), base shapes first, then shading with gradients, highlights, texture strokes and a soft ground shadow. Use a harmonious 4–7 color palette, rounded line caps and joins, correct proportions and a recognizable silhouette with expressive details. Never a single-stroke doodle."
  },
  {
    id: "icon-set",
    name: "Icon set",
    prompt:
      "Draw a set of 6–12 matching icons as one SVG with insert_svg, on a 24px grid scaled up (for example a 4×3 grid of 96px cells in the viewBox). Use the same stroke width (1.5–2 at 24px), rounded caps and joins, consistent corner radii and optical size, and label nothing inside the icons. Keep them clearly related to the user's subject."
  },
  {
    id: "logo",
    name: "Logo",
    prompt:
      "Design a logo as one SVG with insert_svg: a symbol and a wordmark set in a system font stack, shown on a light background and repeated on a dark background, plus the symbol alone at a small size. Keep the mark simple, balanced and memorable, with one or two brand colors. Do not imitate existing brands."
  },
  {
    id: "avatar",
    name: "Avatar",
    prompt:
      "Draw a character avatar as one detailed, layered SVG with insert_svg: a 512×512 viewBox, head and shoulders, grouped layers for face, hair, eyes, mouth and clothing, gradients for depth and a simple background shape. Say plainly that it is a static illustration, not a rigged or animated character."
  }
];

export function designSkill(id: string | undefined): DesignSkill | undefined {
  return id ? DESIGN_SKILLS.find((skill) => skill.id === id) : undefined;
}

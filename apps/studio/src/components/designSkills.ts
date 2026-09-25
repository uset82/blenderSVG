export interface DesignSkill {
  id: string;
  name: string;
  prompt: string;
}

/** Prompt packs from `skills/design/`. The picker test checks these strings against those files. */
export const DESIGN_SKILLS: readonly DesignSkill[] = [
  {
    id: "landing",
    name: "Landing",
    prompt: "Lay out one desktop frame, a short headline, and a single next step. Keep the page to one screen."
  },
  {
    id: "mobile",
    name: "Mobile",
    prompt: "Lay out a phone frame at 390×844. Keep controls in reach of one thumb and leave space for the status bar."
  },
  {
    id: "dashboard",
    name: "Dashboard",
    prompt: "Lay out a frame with a title, a short summary, and a few labeled regions. Do not invent live numbers."
  },
  {
    id: "icon-set",
    name: "Icon set",
    prompt: "Draw a small set of matching icons on one grid. Use the same stroke weight for every icon."
  },
  {
    id: "avatar",
    name: "Avatar",
    prompt: "Place an avatar preview in a frame. Do not claim the picture is a rigged character."
  },
  {
    id: "logo",
    name: "Logo",
    prompt: "Place a simple wordmark in a square frame. Use the project type tokens and one accent color."
  }
];

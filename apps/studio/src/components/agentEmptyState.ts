export const AGENT_EMPTY_HEADLINE = "Ask me to design anything";

export const AGENT_SUGGESTIONS = [
  "Frame a landing page at 1440×900",
  "Lay out a phone screen at 390×844",
  "Turn this sketch into simple shapes",
  "Name the layers so they export cleanly",
  "Propose a small set of matching icons",
  "Check spacing and alignment on this canvas"
] as const;

export const AGENT_EMPTY_TIPS = [
  {
    title: "Export",
    body: "Export a selection as PNG or SVG from the canvas menu. The file name stays on this computer."
  },
  {
    title: "Attach context",
    body: "Attach a screenshot only when you want it sent. Review & send shows the image before anything leaves this page."
  }
] as const;

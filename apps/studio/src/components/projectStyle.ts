export const PROJECT_STYLE_META_KEY = "studioStyle";

export interface ProjectStyleColors {
  canvas: string;
  surface: string;
  text: string;
  accent: string;
}

export interface ProjectStyleType {
  sans: string;
  mono: string;
}

/** Color and type tokens stored on the canvas document. Choose a style reads this record. */
export interface ProjectStyle {
  name: string;
  colors: ProjectStyleColors;
  type: ProjectStyleType;
}

export interface StyleChoice {
  name: string;
  label: string;
  colors: ProjectStyleColors;
  type: ProjectStyleType;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_PROJECT_STYLE: ProjectStyle = {
  name: "Studio",
  colors: {
    canvas: "#16150f",
    surface: "#201e17",
    text: "#efe9dc",
    accent: "#f0623a"
  },
  type: {
    sans: "Hanken Grotesk",
    mono: "IBM Plex Mono"
  }
};

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 40) return null;
  return name;
}

function cleanFamily(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const family = value.trim();
  if (!family || family.length > 40 || /[<>]/.test(family)) return null;
  return family;
}

function cleanHex(value: unknown): string | null {
  if (typeof value !== "string" || !HEX.test(value)) return null;
  return value.toLowerCase();
}

export function parseProjectStyle(value: unknown): ProjectStyle | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = cleanName(record.name);
  const colors = record.colors;
  const type = record.type;
  if (!name || !colors || typeof colors !== "object" || !type || typeof type !== "object") return null;
  const colorRecord = colors as Record<string, unknown>;
  const typeRecord = type as Record<string, unknown>;
  const canvas = cleanHex(colorRecord.canvas);
  const surface = cleanHex(colorRecord.surface);
  const text = cleanHex(colorRecord.text);
  const accent = cleanHex(colorRecord.accent);
  const sans = cleanFamily(typeRecord.sans);
  const mono = cleanFamily(typeRecord.mono);
  if (!canvas || !surface || !text || !accent || !sans || !mono) return null;
  return { name, colors: { canvas, surface, text, accent }, type: { sans, mono } };
}

export function readProjectStyle(meta: unknown): ProjectStyle {
  if (!meta || typeof meta !== "object") return DEFAULT_PROJECT_STYLE;
  return parseProjectStyle((meta as Record<string, unknown>)[PROJECT_STYLE_META_KEY]) ?? DEFAULT_PROJECT_STYLE;
}

/** Returns the next document meta, keeping unrelated keys. Invalid styles are refused. */
export function withProjectStyle(meta: object, style: ProjectStyle): Record<string, unknown> | null {
  const parsed = parseProjectStyle(style);
  if (!parsed) return null;
  return { ...meta, [PROJECT_STYLE_META_KEY]: parsed };
}

export const STYLE_PRESETS: readonly ProjectStyle[] = [
  DEFAULT_PROJECT_STYLE,
  {
    name: "Paper",
    colors: { canvas: "#f4f1ea", surface: "#fffdf8", text: "#1c1915", accent: "#2d62d6" },
    type: { sans: "Geist Sans", mono: "Geist Mono" }
  },
  {
    name: "Ink",
    colors: { canvas: "#101114", surface: "#181a1f", text: "#f2f3f5", accent: "#7aa7ff" },
    type: { sans: "Geist Sans", mono: "Geist Mono" }
  }
];

export function toStyleChoice(style: ProjectStyle): StyleChoice {
  const parsed = parseProjectStyle(style) ?? DEFAULT_PROJECT_STYLE;
  return {
    name: parsed.name,
    label: `Style: ${parsed.name}`,
    colors: parsed.colors,
    type: parsed.type
  };
}

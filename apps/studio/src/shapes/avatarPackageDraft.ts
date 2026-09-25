import { validateAvatarManifest, type AvatarManifest } from "@codex-avatar-studio/avatar-core";

const PACKAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="kurva-avatar-aura" x1="20" y1="12" x2="108" y2="116" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9eafff" />
      <stop offset="1" stop-color="#d5c2ff" />
    </linearGradient>
    <linearGradient id="kurva-avatar-coat" x1="64" y1="77" x2="64" y2="122" gradientUnits="userSpaceOnUse">
      <stop stop-color="#303a67" />
      <stop offset="1" stop-color="#202743" />
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="58" fill="#f2f4fb" />
  <circle cx="64" cy="64" r="49" fill="url(#kurva-avatar-aura)" />
  <path d="M20 118c5-22 20-34 44-34s39 12 44 34" fill="url(#kurva-avatar-coat)" />
  <path d="M42 82h44l-4 13c-10 8-26 8-36 0z" fill="#f4b28e" />
  <path d="M34 52c0-23 13-37 30-37s30 14 30 37v12H34z" fill="#292331" />
  <path d="M40 50c0-18 10-29 24-29s24 11 24 29v13c0 17-10 29-24 29S40 80 40 63z" fill="#f4b28e" />
  <path d="M38 54c2-20 13-32 27-32 13 0 23 9 27 24-12-2-21-7-28-15-5 9-14 16-26 23z" fill="#292331" />
  <path d="M51 60h.1M77 60h.1" fill="none" stroke="#292331" stroke-linecap="round" stroke-width="5" />
  <path d="M55 75c5 5 13 5 18 0" fill="none" stroke="#a85460" stroke-linecap="round" stroke-width="3" />
  <path d="m47 95 17 11 17-11-3 23H50z" fill="#f6efe6" />
  <path d="m58 104 6 5 6-5-3 14h-6z" fill="#bb563f" />
</svg>`;

export function avatarPackageManifest(name: string): AvatarManifest {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const manifest = {
    schemaVersion: 1 as const,
    id: id || "studio-avatar",
    name: name.trim() || "Studio avatar",
    version: "1.0.0",
    author: "blenderSVG Studio",
    license: "CC-BY-4.0",
    preferredRuntime: "svg" as const,
    fallbackRuntime: "svg" as const,
    entrypoints: { svg: "svg/avatar.svg" },
    capabilities: ["state-animation"] as const,
    states: { idle: "idle" }
  };
  const result = validateAvatarManifest(manifest);
  if (!result.valid || !result.manifest) throw new Error(result.errors.join(" "));
  return result.manifest;
}

export function avatarPackageSvg(): string {
  return PACKAGE_SVG;
}

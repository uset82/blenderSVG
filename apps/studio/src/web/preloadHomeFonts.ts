import hankenLatin from "@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff2?url";
import plexLatin from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import frauncesLatin from "@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2?url";

const HOME_FONTS = [frauncesLatin, hankenLatin, plexLatin];

/** Preload the Latin faces Home uses. Drawing fonts stay with the editor chunk. */
export function preloadHomeFonts(): void {
  if (typeof document === "undefined") return;
  for (const href of HOME_FONTS) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.append(link);
  }
}

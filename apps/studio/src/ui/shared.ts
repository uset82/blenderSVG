export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Keep portal content inside the themed Studio root. */
export function studioPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".studio-app") ?? undefined;
}

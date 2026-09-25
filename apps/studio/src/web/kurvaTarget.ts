/** Build marker. Web mode inlines this as "web"; desktop builds leave it unset. */
export function isWebEdition(target: unknown = import.meta.env.VITE_KURVA_TARGET): boolean {
  return target === "web";
}

export const WEB_LIBRARY_STATUS = "Saved in this browser";

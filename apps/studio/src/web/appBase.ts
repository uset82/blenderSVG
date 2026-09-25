/**
 * The web app's path prefix: "/" when it owns a whole host, "/app/" when it is served
 * under kurva.agency/app/. Every absolute in-app URL (the OpenRouter return page, the
 * redirect back into the app) must include it, or it lands on the landing site instead.
 */
export function appBasePath(base: string = import.meta.env.BASE_URL): string {
  if (!base || base === "./") return "/";
  const withLeading = base.startsWith("/") ? base : `/${base}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

/** An absolute path inside the app, e.g. appPath("/oauth/openrouter") → "/app/oauth/openrouter". */
export function appPath(path: string, base?: string): string {
  return `${appBasePath(base)}${path.replace(/^\/+/, "")}`;
}

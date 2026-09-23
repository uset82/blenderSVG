import { useCallback, useEffect, useState } from "react";

export type StudioRoute =
  | { name: "home" }
  | { name: "project"; projectId: string }
  | { name: "connectors" }
  | { name: "settings" }
  | { name: "gallery" }
  | { name: "unknown"; hash: string };

const NAMED_ROUTES = {
  "#/connectors": { name: "connectors" },
  "#/settings": { name: "settings" },
  "#/gallery": { name: "gallery" }
} as const;

export function parseStudioHash(hash: string): StudioRoute {
  const normalized = hash.trim();
  if (normalized === "" || normalized === "#" || normalized === "#/") return { name: "home" };
  const named = NAMED_ROUTES[normalized as keyof typeof NAMED_ROUTES];
  if (named) return named;
  const project = /^#\/p\/([^/]+)$/.exec(normalized);
  if (!project?.[1]) return { name: "unknown", hash: normalized };
  try {
    const projectId = decodeURIComponent(project[1]);
    if (!projectId || projectId.includes("/")) return { name: "unknown", hash: normalized };
    return { name: "project", projectId };
  } catch {
    return { name: "unknown", hash: normalized };
  }
}

export function formatStudioHash(route: StudioRoute): string {
  if (route.name === "home") return "#/";
  if (route.name === "project") return `#/p/${encodeURIComponent(route.projectId)}`;
  if (route.name === "unknown") return route.hash || "#/";
  return `#/${route.name}`;
}

export function useStudioRoute(): readonly [StudioRoute, (route: StudioRoute) => void] {
  const [route, setRoute] = useState<StudioRoute>(() =>
    parseStudioHash(typeof window === "undefined" ? "" : window.location.hash)
  );

  useEffect(() => {
    const sync = () => setRoute(parseStudioHash(window.location.hash));
    if (!window.location.hash) window.history.replaceState(null, "", "#/");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((next: StudioRoute) => {
    const hash = formatStudioHash(next);
    if (window.location.hash === hash) {
      setRoute(parseStudioHash(hash));
      return;
    }
    window.location.hash = hash;
  }, []);

  return [route, navigate] as const;
}

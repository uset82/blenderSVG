const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function studioHostToken(search: string): string | null {
  const token = new URLSearchParams(search).get("studioToken")?.trim();
  return token ? token : null;
}

export function hostSaveTarget(input: {
  vscode: boolean;
  standaloneHost: boolean;
  browserLibrary?: boolean;
  projectId: string | null;
}): "vscode" | "host" | "browser" | "offline" {
  if (input.vscode) return "vscode";
  if (input.browserLibrary && input.projectId && PROJECT_ID.test(input.projectId)) return "browser";
  if (input.standaloneHost && input.projectId && PROJECT_ID.test(input.projectId)) return "host";
  return "offline";
}

export function shouldBootstrapStandaloneProject(input: {
  standaloneHost: boolean;
  routeName: string;
  projectId: string | null;
  routedHostProject: boolean;
}): boolean {
  return input.standaloneHost && input.routeName === "project" && !input.projectId && !input.routedHostProject;
}

export function hostProjectSaveRequest(input: { id: string; title: string; snapshot: string }): {
  url: string;
  body: string;
} {
  return {
    url: "/api/projects",
    body: JSON.stringify({ id: input.id, title: input.title, snapshot: input.snapshot })
  };
}

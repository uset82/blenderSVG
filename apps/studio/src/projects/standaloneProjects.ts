import type { StudioProjectMeta, StudioProjectsState } from "../bridge/studioHost.js";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStandaloneProjectId(value: string): boolean {
  return PROJECT_ID.test(value);
}

export interface StandaloneProject extends StudioProjectMeta {
  formatVersion: 1;
  snapshot: string;
}

export async function listStandaloneProjects(): Promise<Pick<StudioProjectsState, "projects" | "corruptCount">> {
  const response = await fetch(projectPath, { credentials: "same-origin" });
  const value = await readResponse<{ projects?: unknown; corruptCount?: unknown }>(response);
  const projects = Array.isArray(value.projects) ? value.projects.filter(isProjectMeta) : null;
  if (!projects) throw new Error("Studio returned an invalid project list.");
  return {
    projects,
    corruptCount: typeof value.corruptCount === "number" && Number.isFinite(value.corruptCount) ? value.corruptCount : 0
  };
}

export async function openStandaloneProject(id: string): Promise<StandaloneProject> {
  const response = await fetch(`${projectPath}/${safeId(id)}`, {
    credentials: "same-origin"
  });
  const project = await readResponse<unknown>(response);
  if (!isStandaloneProject(project, id)) throw new Error("Studio returned an invalid project file.");
  return project;
}

export async function renameStandaloneProject(id: string, title: string): Promise<StudioProjectMeta> {
  return requestProjectAction<StudioProjectMeta>(id, "rename", { title });
}

export async function duplicateStandaloneProject(id: string): Promise<StudioProjectMeta> {
  return requestProjectAction<StudioProjectMeta>(id, "duplicate");
}

export async function deleteStandaloneProject(id: string): Promise<void> {
  await requestProjectAction<{ deleted: boolean }>(id, "delete", { confirm: true });
}

const projectPath = "/api/projects";

function safeId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("This project identifier is invalid.");
  }
  return encodeURIComponent(id);
}

async function requestProjectAction<T>(
  id: string,
  action: "rename" | "duplicate" | "delete",
  body?: Record<string, string | boolean>
): Promise<T> {
  const response = await fetch(
    `${projectPath}/${safeId(id)}/${action}`,
    body
      ? {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }
      : { method: "POST", credentials: "same-origin" }
  );
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  const value = (await response.json().catch(() => null)) as T | { message?: unknown } | null;
  if (!response.ok) {
    const message =
      value && typeof value === "object" && "message" in value && typeof value.message === "string"
        ? value.message
        : null;
    throw new Error(message ?? "Studio could not access this project.");
  }
  if (!value || typeof value !== "object") throw new Error("Studio returned an empty response.");
  return value as T;
}

function isProjectMeta(value: unknown): value is StudioProjectMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<StudioProjectMeta>;
  return (
    typeof project.id === "string" &&
    typeof project.title === "string" &&
    typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string"
  );
}

function isStandaloneProject(value: unknown, id: string): value is StandaloneProject {
  if (!isProjectMeta(value)) return false;
  const project = value as Partial<StandaloneProject>;
  return project.id === id && project.formatVersion === 1 && typeof project.snapshot === "string";
}

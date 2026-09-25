import type { StudioProjectDocument, StudioProjectMeta } from "@codex-avatar-studio/studio-host-core/projectEnvelope";
import {
  deleteBrowserProject,
  duplicateBrowserProject,
  ensureBrowserScratchpad,
  listBrowserProjects,
  openBrowserProject,
  renameBrowserProject,
  saveBrowserProject
} from "../web/browserProjects.js";
import {
  deleteStandaloneProject,
  duplicateStandaloneProject,
  listStandaloneProjects,
  openStandaloneProject,
  renameStandaloneProject
} from "./standaloneProjects.js";

export type ProjectLibraryKind = "vscode" | "standalone" | "browser" | "session";

export function projectLibraryKind(input: {
  webEdition: boolean;
  standaloneHost: boolean;
  vscodeTrusted: boolean;
}): ProjectLibraryKind {
  if (input.webEdition) return "browser";
  if (input.standaloneHost) return "standalone";
  if (input.vscodeTrusted) return "vscode";
  return "session";
}

export interface ProjectBackend {
  kind: "vscode" | "standalone" | "browser";
  list(): Promise<{ projects: StudioProjectMeta[]; corruptCount: number }>;
  open(id: string): Promise<StudioProjectDocument>;
  save(id: string, title: string, snapshot: string): Promise<StudioProjectMeta>;
  rename(id: string, title: string): Promise<StudioProjectMeta>;
  duplicate(id: string): Promise<StudioProjectMeta>;
  delete(id: string): Promise<void>;
  ensureScratchpad(snapshot: string): Promise<StudioProjectMeta>;
}

export interface VsCodeProjectBridge {
  list(): void;
  open(id: string): void;
  save(id: string, title: string, snapshot: string): void;
  rename(id: string, title: string): void;
  duplicate(id: string): void;
  delete(id: string): void;
  ensureScratchpad(snapshot: string): void;
}

export function createVsCodeProjectBackend(bridge: VsCodeProjectBridge): ProjectBackend {
  return {
    kind: "vscode",
    async list() {
      bridge.list();
      return { projects: [], corruptCount: 0 };
    },
    async open(id) {
      bridge.open(id);
      return Promise.reject(new Error("VS Code opens this project through the host."));
    },
    async save(id, title, snapshot) {
      bridge.save(id, title, snapshot);
      return { id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async rename(id, title) {
      bridge.rename(id, title);
      return { id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async duplicate(id) {
      bridge.duplicate(id);
      return { id, title: "Copy", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async delete(id) {
      bridge.delete(id);
    },
    async ensureScratchpad(snapshot) {
      bridge.ensureScratchpad(snapshot);
      return {
        id: "scratchpad",
        title: "Scratchpad",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  };
}

export const standaloneProjectBackend: ProjectBackend = {
  kind: "standalone",
  async list() {
    const listed = await listStandaloneProjects();
    return { projects: listed.projects, corruptCount: listed.corruptCount };
  },
  async open(id) {
    return openStandaloneProject(id);
  },
  async save(id, title, snapshot) {
    const response = await fetch("/api/projects", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, title, snapshot })
    });
    if (!response.ok) throw new Error("Save failed – Retry");
    return { id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  },
  rename: renameStandaloneProject,
  duplicate: duplicateStandaloneProject,
  delete: deleteStandaloneProject,
  async ensureScratchpad() {
    throw new Error("The standalone host creates Scratchpad.");
  }
};

export const browserProjectBackend: ProjectBackend = {
  kind: "browser",
  list: listBrowserProjects,
  open: openBrowserProject,
  save: saveBrowserProject,
  rename: renameBrowserProject,
  duplicate: duplicateBrowserProject,
  delete: deleteBrowserProject,
  ensureScratchpad: ensureBrowserScratchpad
};

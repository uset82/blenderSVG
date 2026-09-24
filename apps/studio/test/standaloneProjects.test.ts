import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteStandaloneProject,
  duplicateStandaloneProject,
  listStandaloneProjects,
  openStandaloneProject,
  renameStandaloneProject
} from "../src/projects/standaloneProjects.js";

const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";
const meta = {
  id,
  title: "Canvas",
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z"
};

afterEach(() => vi.unstubAllGlobals());

describe("standalone Studio projects", () => {
  it("lists and opens library projects through the authenticated host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [meta], corruptCount: 1 }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...meta, formatVersion: 1, snapshot: '{"document":{"schema":{},"store":{}}}' }), {
          status: 200
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listStandaloneProjects()).resolves.toEqual({ projects: [meta], corruptCount: 1 });
    await expect(openStandaloneProject(id)).resolves.toMatchObject({ id, formatVersion: 1 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/projects", `/api/projects/${id}`]);
  });

  it("posts rename, duplicate, and confirmed delete actions", async () => {
    const duplicateId = "55b5363d-6cd6-42f7-8c8c-79b8a847d8e6";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(meta), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...meta, id: duplicateId, title: "Canvas copy" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await renameStandaloneProject(id, "Renamed");
    await duplicateStandaloneProject(id);
    await deleteStandaloneProject(id);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      [`/api/projects/${id}/rename`, "POST", JSON.stringify({ title: "Renamed" })],
      [`/api/projects/${id}/duplicate`, "POST", undefined],
      [`/api/projects/${id}/delete`, "POST", JSON.stringify({ confirm: true })]
    ]);
  });
});

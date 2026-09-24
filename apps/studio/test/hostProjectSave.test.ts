import { describe, expect, it } from "vitest";
import {
  hostProjectSaveRequest,
  hostSaveTarget,
  shouldBootstrapStandaloneProject,
  studioHostToken
} from "../src/projects/hostProjectSave.js";

const id = "44a4252c-5bc5-41e6-b7b7-68a79736c7d5";

describe("host project save", () => {
  it("saves through VS Code, the standalone host, or stays offline", () => {
    expect(hostSaveTarget({ vscode: true, standaloneHost: false, projectId: id })).toBe("vscode");
    expect(hostSaveTarget({ vscode: false, standaloneHost: true, projectId: id })).toBe("host");
    expect(hostSaveTarget({ vscode: false, standaloneHost: false, projectId: "page:page" })).toBe("offline");
    expect(studioHostToken("?studioToken=abc")).toBe("abc");
  });

  it("posts versioned project fields through the HttpOnly host session", () => {
    const request = hostProjectSaveRequest({ id, title: "Board", snapshot: '{"document":{}}' });
    expect(request.url).toBe("/api/projects");
    expect(JSON.parse(request.body)).toEqual({ id, title: "Board", snapshot: '{"document":{}}' });
  });

  it("does not create a hidden project while the standalone library route is open", () => {
    expect(
      shouldBootstrapStandaloneProject({
        standaloneHost: true,
        routeName: "home",
        projectId: null,
        routedHostProject: false
      })
    ).toBe(false);
    expect(
      shouldBootstrapStandaloneProject({
        standaloneHost: true,
        routeName: "project",
        projectId: null,
        routedHostProject: false
      })
    ).toBe(true);
    expect(
      shouldBootstrapStandaloneProject({
        standaloneHost: true,
        routeName: "project",
        projectId: null,
        routedHostProject: true
      })
    ).toBe(false);
  });
});

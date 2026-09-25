import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStudioApp } from "../../studio-server/src/server.js";
import { AvatarPackageRegistry } from "../src/avatarPackages.js";

describe("Studio avatar package handoff", () => {
  it("imports a Studio export with the Phase 4 registry and activates it", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "studio-avatar-roundtrip-"));
    const archivePath = path.join(workspaceRoot, "cholita-3d-1.0.0.codex-avatar.zip");
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#bb563f"/></svg>';
    try {
      const app = createStudioApp(path.join(workspaceRoot, "missing-studio-build"), "test-token");
      const response = await app.fetch(
        new Request("http://127.0.0.1/api/avatar-package?studioToken=test-token", {
          method: "POST",
          headers: { origin: "http://127.0.0.1", "content-type": "application/json" },
          body: JSON.stringify({ name: "Cholita 3D", svg })
        })
      );
      expect(response.status).toBe(200);
      await writeFile(archivePath, new Uint8Array(await response.arrayBuffer()));

      const registry = new AvatarPackageRegistry(
        () => workspaceRoot,
        () => ".codex-avatar"
      );
      const imported = await registry.importPackage(archivePath);
      expect(imported.id).toBe("cholita-3d");
      expect(imported.manifest.entrypoints.svg).toBe("svg/avatar.svg");
      expect(await readFile(path.join(imported.rootPath, "svg", "avatar.svg"), "utf8")).toBe(svg);

      const active = await registry.activateAvatar(imported.id);
      expect(active?.id).toBe("cholita-3d");
      expect((await registry.getActivePackage())?.manifest.name).toBe("Cholita 3D");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});

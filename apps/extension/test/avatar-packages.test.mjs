import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AvatarPackageRegistry, validateAvatarPackage } from "../dist/avatarPackages.js";

const extensionRoot = path.join(import.meta.dirname, "..");

function manifest(entrypoint = "avatar.svg", checksums) {
  return {
    schemaVersion: 1,
    id: "local-test-avatar",
    name: "Local Test Avatar",
    version: "1.0.0",
    author: "Test Author",
    license: "MIT",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: entrypoint },
    capabilities: ["state-animation"],
    states: { idle: "idle_loop" },
    checksums
  };
}

test("validates the built-in manifest and imports, activates, then removes a local package", async () => {
  const builtIn = await validateAvatarPackage(path.join(extensionRoot, "media", "avatars"));
  assert.equal(builtIn.valid, true, builtIn.errors.join("\n"));

  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-package-"));
  const source = path.join(root, "source");
  const workspace = path.join(root, "workspace");
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, "avatar.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const svgHash = createHash("sha256")
    .update(await readFile(path.join(source, "avatar.svg")))
    .digest("hex");
  await writeFile(
    path.join(source, "avatar.manifest.json"),
    JSON.stringify(manifest("avatar.svg", { "avatar.svg": svgHash }))
  );

  try {
    const registry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    const imported = await registry.importPackage(source);
    assert.equal(imported.id, "local-test-avatar");
    assert.equal((await registry.listPackages()).length, 1);
    await registry.activateAvatar(imported.id);
    assert.equal((await registry.getActivePackage())?.id, imported.id);
    assert.equal(await registry.removeAvatar(imported.id), true);
    assert.equal(await registry.getActivePackage(), undefined);
    assert.equal((await registry.listPackages()).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects traversal, remote entrypoints, and bad checksums", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-invalid-"));
  try {
    await writeFile(path.join(root, "avatar.manifest.json"), JSON.stringify(manifest("../outside.svg")));
    const traversal = await validateAvatarPackage(root);
    assert.equal(traversal.valid, false);
    assert.match(traversal.errors.join("\n"), /safe local relative path|escapes/);

    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("https://example.com/avatar.svg"))
    );
    const remote = await validateAvatarPackage(root);
    assert.equal(remote.valid, false);
    assert.match(remote.errors.join("\n"), /safe local relative path/);

    await writeFile(path.join(root, "avatar.svg"), "<svg/>");
    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("avatar.svg", { "avatar.svg": "0".repeat(64) }))
    );
    const checksum = await validateAvatarPackage(root);
    assert.equal(checksum.valid, false);
    assert.match(checksum.errors.join("\n"), /Checksum mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
